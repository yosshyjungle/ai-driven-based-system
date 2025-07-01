'use client'

import { useEffect, useState, useRef } from 'react'

interface CodeDiffViewerProps {
    teacherCode: string
    studentCode: string
    isTeacher: boolean
    onTeacherCodeChange?: (code: string) => void
    onStudentCodeChange?: (code: string) => void
}

export default function CodeDiffViewer({
    teacherCode,
    studentCode,
    isTeacher,
    onTeacherCodeChange,
    onStudentCodeChange,
}: CodeDiffViewerProps) {
    const [localTeacherCode, setLocalTeacherCode] = useState(teacherCode)
    const [localStudentCode, setLocalStudentCode] = useState(studentCode)
    const [diffLines, setDiffLines] = useState<Array<{
        type: 'same' | 'added' | 'removed'
        teacher: string
        student: string
        index: number
    }>>([])
    const debounceTimerRef = useRef<NodeJS.Timeout>()

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

            let type: 'same' | 'added' | 'removed' = 'same'
            if (teacherLine !== studentLine) {
                if (teacherLine && !studentLine) {
                    type = 'removed'
                } else if (!teacherLine && studentLine) {
                    type = 'added'
                } else {
                    type = 'added' // 変更は追加として扱う
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
                    <div className="bg-green-50 px-4 py-2 border-b border-gray-200">
                        <h3 className="font-semibold text-green-900">差分比較</h3>
                        <p className="text-sm text-green-700">
                            <span className="inline-block w-3 h-3 bg-red-200 mr-1 rounded"></span>削除・変更
                            <span className="inline-block w-3 h-3 bg-green-200 ml-3 mr-1 rounded"></span>追加
                        </p>
                    </div>
                    <div className="h-full overflow-auto bg-gray-50 p-4" style={{ minHeight: '500px' }}>
                        <div className="font-mono text-sm space-y-1">
                            {diffLines.map((line, index) => (
                                <div key={index} className="flex">
                                    <div className="w-8 text-gray-400 text-right mr-2 flex-shrink-0">
                                        {index + 1}
                                    </div>
                                    <div className="flex-1">
                                        {line.type === 'same' && (
                                            <div className="text-gray-800">
                                                {line.teacher || line.student || ' '}
                                            </div>
                                        )}
                                        {line.type === 'removed' && (
                                            <div className="bg-red-100 text-red-800 px-1 rounded">
                                                - {line.teacher}
                                            </div>
                                        )}
                                        {line.type === 'added' && (
                                            <div className="bg-green-100 text-green-800 px-1 rounded">
                                                + {line.student}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 学生のコード */}
                <div>
                    <div className="bg-orange-50 px-4 py-2 border-b border-gray-200">
                        <h3 className="font-semibold text-orange-900">
                            {isTeacher ? '学生のコード（参照）' : 'あなたのコード'}
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