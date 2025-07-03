'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth, useUser } from '@clerk/nextjs'

interface RealtimeTextCompareProps {
    sessionId?: string
}

export default function RealtimeTextCompare({ sessionId = 'test-session-123' }: RealtimeTextCompareProps) {
    const { isSignedIn, userId } = useAuth()
    const { user } = useUser()
    const [teacherCode, setTeacherCode] = useState('')
    const [studentCode, setStudentCode] = useState('')
    const [isConnected, setIsConnected] = useState(false)
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
    const eventSourceRef = useRef<EventSource | null>(null)

    // ユーザーの役割を確認
    const userRole = user?.publicMetadata?.role as string || 'student'
    const isTeacher = userRole === 'teacher'

    useEffect(() => {
        if (isSignedIn && sessionId) {
            // 初期データの取得
            fetchInitialData()
            // SSE接続の確立
            setupRealtimeConnection()
        }

        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close()
            }
        }
    }, [isSignedIn, sessionId, userRole])

    const fetchInitialData = async () => {
        try {
            // 教師のコード取得（すべてのユーザーが取得）
            const teacherCodeResponse = await fetch(`/api/code-diff/sessions/${sessionId}/teacher-code`)
            if (teacherCodeResponse.ok) {
                const teacherCodeData = await teacherCodeResponse.json()
                setTeacherCode(teacherCodeData.teacherCode?.content || '')
            }

            // 学生のコード取得（学生の場合のみ）
            if (!isTeacher) {
                const studentCodeResponse = await fetch(`/api/code-diff/sessions/${sessionId}/student-code`)
                if (studentCodeResponse.ok) {
                    const studentCodeData = await studentCodeResponse.json()
                    setStudentCode(studentCodeData.studentCode?.content || '')
                }
            }
        } catch (error) {
            console.error('Failed to fetch initial data:', error)
        }
    }

    const setupRealtimeConnection = () => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close()
        }

        console.log(`Setting up SSE connection to /api/code-diff/sessions/${sessionId}/live`)
        const eventSource = new EventSource(`/api/code-diff/sessions/${sessionId}/live`)
        eventSourceRef.current = eventSource

        eventSource.onopen = () => {
            console.log('SSE connection established')
            setIsConnected(true)
        }

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)
                console.log('SSE message received:', data)

                if (data.type === 'code_update') {
                    if (data.codeType === 'teacher') {
                        // 学生の場合のみ先生のコードを更新
                        if (!isTeacher) {
                            setTeacherCode(data.content)
                        }
                    } else if (data.codeType === 'student') {
                        // 先生の場合のみ学生のコードを更新
                        if (isTeacher) {
                            setStudentCode(data.content)
                        }
                    }
                }
            } catch (error) {
                console.error('Error parsing SSE message:', error)
            }
        }

        eventSource.onerror = (error) => {
            console.error('SSE connection error:', error)
            setIsConnected(false)

            // 5秒後に再接続を試行
            setTimeout(() => {
                if (isSignedIn && sessionId) {
                    setupRealtimeConnection()
                }
            }, 5000)
        }
    }

    const handleTeacherCodeChange = (newCode: string) => {
        if (!isTeacher) return

        setTeacherCode(newCode)

        // デバウンス処理でサーバーに送信
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
        }

        debounceTimerRef.current = setTimeout(() => {
            sendCodeUpdate('teacher', newCode)
        }, 1000)
    }

    const handleStudentCodeChange = (newCode: string) => {
        if (isTeacher) return

        setStudentCode(newCode)

        // デバウンス処理でサーバーに送信
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
        }

        debounceTimerRef.current = setTimeout(() => {
            sendCodeUpdate('student', newCode)
        }, 1000)
    }

    const sendCodeUpdate = async (type: 'teacher' | 'student', content: string) => {
        try {
            const endpoint = type === 'teacher' ? 'teacher-code' : 'student-code'
            const response = await fetch(`/api/code-diff/sessions/${sessionId}/${endpoint}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content }),
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                console.error(`Failed to update ${type} code: ${response.status}`, errorData)
                throw new Error(`Failed to update ${type} code: ${response.status}`)
            } else {
                console.log(`Successfully updated ${type} code`)
            }
        } catch (error) {
            console.error(`Error sending ${type} code update:`, error)
            throw error
        }
    }

    const generateSimpleDiff = () => {
        const teacherLines = teacherCode.split('\n')
        const studentLines = studentCode.split('\n')
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

        return diff
    }

    const diffLines = generateSimpleDiff()

    if (!isSignedIn) {
        return (
            <div className="max-w-6xl mx-auto px-4 py-8">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">ログインが必要です</h1>
                    <p className="text-gray-600">リアルタイム機能を利用するにはログインしてください。</p>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            <div className="text-center mb-8">
                <h1 className="text-4xl font-bold text-gray-900 mb-4">Compare text</h1>
                <p className="text-gray-600 mb-6">Find the difference between two text files</p>

                {/* 接続状態とユーザー情報 */}
                <div className="flex justify-center items-center gap-4 mb-6">
                    <div className={`text-sm ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                        {isConnected ? '🟢 リアルタイム接続中' : '🔴 接続なし'}
                    </div>
                    <div className={`px-3 py-1 rounded text-sm ${isTeacher
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700'
                        }`}
                    >
                        {isTeacher ? '先生モード' : '学生モード'}
                    </div>
                    <div className="text-xs text-gray-500">
                        セッション: {sessionId}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* Teacher Code */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="text-lg font-semibold text-blue-700">教師のコード</label>
                        <span className="text-sm text-blue-600">
                            {isTeacher ? '編集可能' : '参照のみ'}
                        </span>
                    </div>
                    <textarea
                        value={teacherCode}
                        onChange={(e) => handleTeacherCodeChange(e.target.value)}
                        className={`w-full h-80 p-4 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm ${isTeacher
                            ? 'bg-white'
                            : 'bg-gray-50 text-gray-600 cursor-not-allowed'
                            }`}
                        placeholder={isTeacher ? "ここにコードを入力してください..." : "先生のコードが表示されます"}
                        readOnly={!isTeacher}
                    />
                </div>

                {/* Diff Display */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="text-lg font-semibold text-green-700">差分表示</label>
                        <div className="text-xs text-gray-500">
                            <span className="inline-block w-3 h-3 bg-red-200 mr-1 rounded"></span>削除
                            <span className="inline-block w-3 h-3 bg-green-200 ml-2 mr-1 rounded"></span>追加
                        </div>
                    </div>
                    <div className="h-80 overflow-auto bg-gray-50 p-4 border border-gray-300 rounded-lg font-mono text-sm">
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

                {/* Student Code */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="text-lg font-semibold text-orange-700">
                            {isTeacher ? '学生のコード（参照）' : 'あなたのコード'}
                        </label>
                        <span className="text-sm text-orange-600">
                            {isTeacher ? '参照のみ' : '編集可能'}
                        </span>
                    </div>
                    <textarea
                        value={studentCode}
                        onChange={(e) => handleStudentCodeChange(e.target.value)}
                        className={`w-full h-80 p-4 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-orange-500 focus:border-transparent font-mono text-sm ${!isTeacher
                            ? 'bg-white'
                            : 'bg-gray-50 text-gray-600 cursor-not-allowed'
                            }`}
                        placeholder={!isTeacher ? "ここにあなたのコードを入力してください..." : "学生のコードが表示されます"}
                        readOnly={isTeacher}
                    />
                </div>
            </div>
        </div>
    )
} 