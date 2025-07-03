'use client'

import { useEffect, useState, useRef } from 'react'

interface CodeDiffViewerProps {
    teacherCode: string
    studentCode: string
    isTeacher: boolean
    onTeacherCodeChange?: (code: string) => void
    onStudentCodeChange?: (code: string) => void
    selectedStudentName?: string
}

export default function CodeDiffViewer({
    teacherCode,
    studentCode,
    isTeacher,
    onTeacherCodeChange,
    onStudentCodeChange,
    selectedStudentName,
}: CodeDiffViewerProps) {
    const [localTeacherCode, setLocalTeacherCode] = useState(teacherCode)
    const [localStudentCode, setLocalStudentCode] = useState(studentCode)
    const [diffLines, setDiffLines] = useState<Array<{
        type: 'same' | 'added' | 'removed' | 'modified'
        teacher: string
        student: string
        index: number
    }>>([])
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

    useEffect(() => {
        setLocalTeacherCode(teacherCode)
    }, [teacherCode])

    useEffect(() => {
        setLocalStudentCode(studentCode)
    }, [studentCode])

    useEffect(() => {
        generateSimpleDiff()
    }, [localTeacherCode, localStudentCode])

    const generateSimpleDiff = () => {
        const teacherLines = localTeacherCode.split('\n')
        const studentLines = localStudentCode.split('\n')
        const maxLength = Math.max(teacherLines.length, studentLines.length)

        const diff = []
        for (let i = 0; i < maxLength; i++) {
            const teacherLine = teacherLines[i] || ''
            const studentLine = studentLines[i] || ''

            let type: 'same' | 'added' | 'removed' | 'modified' = 'same'
            if (teacherLine !== studentLine) {
                if (teacherLine && !studentLine) {
                    type = 'removed'
                } else if (!teacherLine && studentLine) {
                    type = 'added'
                } else {
                    type = 'modified' // 変更された行
                }
            }

            diff.push({
                type,
                teacher: teacherLine,
                student: studentLine,
                index: i
            })
        }

        setDiffLines(diff)
    }

    const handleTeacherCodeChange = (newCode: string) => {
        setLocalTeacherCode(newCode)

        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
        }

        debounceTimerRef.current = setTimeout(() => {
            onTeacherCodeChange?.(newCode)
        }, 1000)
    }

    const handleStudentCodeChange = (newCode: string) => {
        setLocalStudentCode(newCode)

        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
        }

        debounceTimerRef.current = setTimeout(() => {
            onStudentCodeChange?.(newCode)
        }, 1000)
    }

    return (
        <div className="h-full">
            <div className="grid grid-cols-1 lg:grid-cols-3 h-full min-h-[600px]">
                {/* 教師のコード */}
                <div className="border-r border-gray-200">
                    <div className="bg-blue-50 px-4 py-2 border-b border-gray-200">
                        <h3 className="font-semibold text-blue-900">教師のコード</h3>
                        <p className="text-sm text-blue-700">
                            {isTeacher ? '編集可能' : '参照のみ'}
                        </p>
                    </div>
                    <div className="h-full">
                        <textarea
                            value={localTeacherCode}
                            onChange={(e) => handleTeacherCodeChange(e.target.value)}
                            disabled={!isTeacher}
                            className={`w-full h-full resize-none p-4 font-mono text-sm border-0 focus:outline-none focus:ring-0 ${isTeacher
                                ? 'bg-white'
                                : 'bg-gray-50 text-gray-600 cursor-not-allowed'
                                }`}
                            placeholder={isTeacher ? 'ここにコードを入力してください...' : ''}
                            style={{ minHeight: '500px' }}
                        />
                    </div>
                </div>

                {/* 差分表示 */}
                <div className="border-r border-gray-200">
                    <div className="bg-purple-50 px-4 py-2 border-b border-gray-200">
                        <h3 className="font-semibold text-purple-900">差分比較</h3>
                        <div className="text-xs text-purple-700 mt-1 space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="inline-block w-3 h-3 bg-red-200 border border-red-300 rounded"></span>
                                <span>削除された行</span>
                                <span className="inline-block w-3 h-3 bg-green-200 border border-green-300 rounded ml-2"></span>
                                <span>追加された行</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="inline-block w-3 h-3 bg-yellow-200 border border-yellow-300 rounded"></span>
                                <span>変更された行</span>
                                <span className="inline-block w-3 h-3 bg-gray-100 border border-gray-300 rounded ml-2"></span>
                                <span>同じ行</span>
                            </div>
                        </div>
                    </div>
                    <div className="h-full overflow-auto bg-gray-50 p-4" style={{ minHeight: '500px' }}>
                        <div className="font-mono text-sm space-y-1">
                            {diffLines.length === 0 ? (
                                <div className="text-center text-gray-500 py-8">
                                    <p>コードを入力すると差分が表示されます</p>
                                </div>
                            ) : (
                                diffLines.map((line, index) => (
                                    <div key={index} className="flex hover:bg-gray-100 rounded transition-colors">
                                        <div className="w-10 text-gray-400 text-right mr-3 flex-shrink-0 py-1">
                                            {index + 1}
                                        </div>
                                        <div className="flex-1 py-1">
                                            {line.type === 'same' && (
                                                <div className="text-gray-800 px-2 py-1">
                                                    {line.teacher || line.student || '\u00A0'}
                                                </div>
                                            )}
                                            {line.type === 'removed' && (
                                                <div className="bg-red-100 border-l-4 border-red-400 text-red-800 px-2 py-1 rounded-r">
                                                    <span className="text-red-600 font-bold mr-1">-</span>
                                                    {line.teacher}
                                                </div>
                                            )}
                                            {line.type === 'added' && (
                                                <div className="bg-green-100 border-l-4 border-green-400 text-green-800 px-2 py-1 rounded-r">
                                                    <span className="text-green-600 font-bold mr-1">+</span>
                                                    {line.student}
                                                </div>
                                            )}
                                            {line.type === 'modified' && (
                                                <div className="space-y-1">
                                                    <div className="bg-red-50 border-l-4 border-red-300 text-red-700 px-2 py-1 rounded-r">
                                                        <span className="text-red-500 font-bold mr-1">-</span>
                                                        {line.teacher}
                                                    </div>
                                                    <div className="bg-green-50 border-l-4 border-green-300 text-green-700 px-2 py-1 rounded-r">
                                                        <span className="text-green-500 font-bold mr-1">+</span>
                                                        {line.student}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* 学生のコード */}
                <div>
                    <div className="bg-orange-50 px-4 py-2 border-b border-gray-200">
                        <h3 className="font-semibold text-orange-900">
                            {isTeacher ?
                                (selectedStudentName ? `${selectedStudentName}のコード（参照）` : '学生のコード（参照）') :
                                'あなたのコード'
                            }
                        </h3>
                        <p className="text-sm text-orange-700">
                            {isTeacher ? '参照のみ' : '編集可能'}
                        </p>
                    </div>
                    <div className="h-full">
                        <textarea
                            value={localStudentCode}
                            onChange={(e) => handleStudentCodeChange(e.target.value)}
                            disabled={isTeacher}
                            className={`w-full h-full resize-none p-4 font-mono text-sm border-0 focus:outline-none focus:ring-0 ${!isTeacher
                                ? 'bg-white'
                                : 'bg-gray-50 text-gray-600 cursor-not-allowed'
                                }`}
                            placeholder={!isTeacher ? 'ここにあなたのコードを入力してください...' : ''}
                            style={{ minHeight: '500px' }}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
} 