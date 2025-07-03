'use client'

import { useEffect, useState, use } from 'react'
import { useAuth, useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import CodeDiffViewer from '@/components/CodeDiffViewer'

interface Session {
    id: string
    title: string
    teacherId: string
    teacher?: {
        firstName?: string
        lastName?: string
        email: string
    }
}

interface TeacherCode {
    content: string
    updatedAt: string
}

interface StudentCode {
    content: string
    updatedAt: string
}

interface Student {
    id: string
    firstName?: string
    lastName?: string
    email: string
}

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
    const { isSignedIn, userId } = useAuth()
    const { user } = useUser()
    const router = useRouter()
    const [session, setSession] = useState<Session | null>(null)
    const [teacherCode, setTeacherCode] = useState<TeacherCode>({ content: '', updatedAt: '' })
    const [studentCode, setStudentCode] = useState<StudentCode>({ content: '', updatedAt: '' })
    const [students, setStudents] = useState<Student[]>([])
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [eventSource, setEventSource] = useState<EventSource | null>(null)

    const resolvedParams = use(params)
    const userRole = user?.publicMetadata?.role as string || 'student'
    const isTeacher = userRole === 'teacher'

    useEffect(() => {
        if (isSignedIn && resolvedParams.id) {
            fetchSessionData()
        }

        // コンポーネントのアンマウント時にSSE接続をクリーンアップ
        return () => {
            if (eventSource) {
                eventSource.close()
                setEventSource(null)
            }
        }
    }, [isSignedIn, resolvedParams.id, userId])

    // リアルタイム接続は別のuseEffectで管理（isTeacherが確定してから）
    useEffect(() => {
        if (isSignedIn && resolvedParams.id && userRole) {
            setupRealtimeConnection()
        }

        return () => {
            if (eventSource) {
                eventSource.close()
                setEventSource(null)
            }
        }
    }, [isSignedIn, resolvedParams.id, userRole, isTeacher])

    // リアルタイム接続のセットアップ
    const setupRealtimeConnection = () => {
        if (!resolvedParams.id) return

        // 既存の接続があれば閉じる
        if (eventSource) {
            eventSource.close()
        }

        // SSE接続を確立
        const newEventSource = new EventSource(`/api/code-diff/sessions/${resolvedParams.id}/live`)
        setEventSource(newEventSource)

        newEventSource.onopen = () => {
            console.log('SSE connection established for session:', resolvedParams.id)
        }

        newEventSource.onmessage = (event) => {
            console.log('SSE message received:', event.data)
            try {
                const data = JSON.parse(event.data)
                console.log('Parsed SSE data:', data)

                if (data.type === 'code_update') {
                    console.log(`Code update received - Type: ${data.codeType}, IsTeacher: ${isTeacher}`)
                    if (data.codeType === 'teacher') {
                        // 学生の場合のみ先生のコードを更新
                        if (!isTeacher) {
                            console.log('Updating teacher code for student:', data.content.substring(0, 50) + '...')
                            setTeacherCode(prev => ({
                                ...prev,
                                content: data.content,
                                updatedAt: data.timestamp
                            }))
                        } else {
                            console.log('Ignoring teacher code update (user is teacher)')
                        }
                    } else if (data.codeType === 'student') {
                        // 先生の場合：選択された学生のコード更新のみ反映
                        if (isTeacher && data.studentId === selectedStudentId) {
                            console.log('Updating student code for teacher:', data.content.substring(0, 50) + '...')
                            setStudentCode(prev => ({
                                ...prev,
                                content: data.content,
                                updatedAt: data.timestamp
                            }))
                        } else if (!isTeacher && data.studentId === userId) {
                            // 学生の場合：自分のコード更新のみ反映（他の学生が編集した場合は無視）
                            console.log('Updating own student code:', data.content.substring(0, 50) + '...')
                            setStudentCode(prev => ({
                                ...prev,
                                content: data.content,
                                updatedAt: data.timestamp
                            }))
                        } else {
                            console.log('Ignoring student code update (not for selected student or not own code)')
                        }
                    }
                } else if (data.type === 'student_joined') {
                    console.log('Student joined notification received:', data.student)
                    // 先生の場合のみ学生リストを更新
                    if (isTeacher) {
                        setStudents(prev => {
                            // 既に存在する学生かチェック
                            const existingStudent = prev.find(s => s.id === data.student.id)
                            if (existingStudent) {
                                return prev // 既に存在する場合は変更なし
                            }
                            // 新しい学生を追加
                            const newStudents = [...prev, data.student]
                            console.log('Student list updated:', newStudents)

                            // 初回の学生が参加した場合、自動選択
                            if (prev.length === 0 && !selectedStudentId) {
                                console.log('Auto-selecting first student:', data.student.id)
                                setSelectedStudentId(data.student.id)
                                // 新しい学生のコードを取得
                                fetchSelectedStudentCode(data.student.id)
                            }

                            return newStudents
                        })
                    }
                }
            } catch (error) {
                console.error('Error parsing SSE message:', error)
            }
        }

        newEventSource.onerror = (error) => {
            console.error('SSE connection error:', error)
            newEventSource.close()
            setEventSource(null)

            // 5秒後に再接続を試行
            setTimeout(() => {
                if (isSignedIn && resolvedParams.id) {
                    setupRealtimeConnection()
                }
            }, 5000)
        }

        // クリーンアップ関数
        return () => {
            newEventSource.close()
        }
    }

    // 選択された学生のコードを取得する関数
    const fetchSelectedStudentCode = async (studentId: string) => {
        try {
            const response = await fetch(`/api/code-diff/sessions/${resolvedParams.id}/student-code?studentId=${studentId}`)
            if (response.ok) {
                const data = await response.json()
                setStudentCode(data.studentCode)
            }
        } catch (err) {
            console.error('Failed to fetch student code:', err)
        }
    }

    const fetchSessionData = async () => {
        try {
            // セッション情報取得
            const sessionResponse = await fetch(`/api/code-diff/sessions/${resolvedParams.id}`)
            if (!sessionResponse.ok) {
                throw new Error('セッション情報の取得に失敗しました')
            }
            const sessionData = await sessionResponse.json()
            setSession(sessionData.session)

            // 教師のコード取得（すべてのユーザーが取得）
            const teacherCodeResponse = await fetch(`/api/code-diff/sessions/${resolvedParams.id}/teacher-code`)
            if (teacherCodeResponse.ok) {
                const teacherCodeData = await teacherCodeResponse.json()
                console.log('Teacher code fetched:', teacherCodeData.teacherCode)
                setTeacherCode(teacherCodeData.teacherCode || { content: '', updatedAt: new Date().toISOString() })
            } else {
                console.error('Failed to fetch teacher code:', teacherCodeResponse.status)
                setTeacherCode({ content: '', updatedAt: new Date().toISOString() })
            }

            // 学生のコード取得
            if (!isTeacher) {
                // 学生の場合は自分のコードを取得
                const studentCodeResponse = await fetch(`/api/code-diff/sessions/${resolvedParams.id}/student-code`)
                if (studentCodeResponse.ok) {
                    const studentCodeData = await studentCodeResponse.json()
                    setStudentCode(studentCodeData.studentCode)
                }
            } else {
                // 先生の場合は学生一覧を取得
                const studentsResponse = await fetch(`/api/code-diff/sessions/${resolvedParams.id}/students`)
                if (studentsResponse.ok) {
                    const studentsData = await studentsResponse.json()
                    setStudents(studentsData.students || [])

                    // 最初の学生を自動選択
                    if (studentsData.students && studentsData.students.length > 0) {
                        const firstStudentId = studentsData.students[0].id
                        setSelectedStudentId(firstStudentId)

                        // 最初の学生のコードを取得
                        await fetchSelectedStudentCode(firstStudentId)
                    }
                }
            }

        } catch (err) {
            setError(err instanceof Error ? err.message : '予期しないエラーが発生しました')
        } finally {
            setLoading(false)
        }
    }

    const handleTeacherCodeChange = async (newCode: string) => {
        if (!isTeacher) return

        setTeacherCode(prev => ({ ...prev, content: newCode }))

        // デバウンス機能付きで保存
        setSaving(true)
        try {
            const response = await fetch(`/api/code-diff/sessions/${resolvedParams.id}/teacher-code`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content: newCode }),
            })

            if (!response.ok) {
                throw new Error('コードの保存に失敗しました')
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'コードの保存に失敗しました')
        } finally {
            setSaving(false)
        }
    }

    const handleStudentCodeChange = async (newCode: string) => {
        if (isTeacher) return

        setStudentCode(prev => ({ ...prev, content: newCode }))

        // デバウンス機能付きで保存
        setSaving(true)
        try {
            const response = await fetch(`/api/code-diff/sessions/${resolvedParams.id}/student-code`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content: newCode }),
            })

            if (!response.ok) {
                throw new Error('コードの保存に失敗しました')
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'コードの保存に失敗しました')
        } finally {
            setSaving(false)
        }
    }

    // 学生選択変更時の処理
    const handleStudentSelect = async (studentId: string) => {
        setSelectedStudentId(studentId)
        await fetchSelectedStudentCode(studentId)
    }

    if (!isSignedIn) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">ログインが必要です</h1>
                    <p className="text-gray-600">セッションに参加するにはログインしてください。</p>
                </div>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-lg text-gray-600">読み込み中...</div>
            </div>
        )
    }

    if (error && !session) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-lg text-red-600 mb-4">エラー: {error}</div>
                    <Link
                        href="/code-diff"
                        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                    >
                        セッション一覧に戻る
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />

            <div className="max-w-7xl mx-auto px-4 py-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center">
                        <Link
                            href="/code-diff"
                            className="text-gray-600 hover:text-gray-900 mr-4"
                        >
                            ← セッション一覧
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">{session?.title}</h1>
                            <p className="text-gray-600 text-sm">
                                教師: {session?.teacher?.firstName} {session?.teacher?.lastName}
                                {isTeacher && ' (あなた)'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {saving && (
                            <span className="text-sm text-blue-600">保存中...</span>
                        )}

                        {/* 先生用学生選択と統計情報 */}
                        {isTeacher && (
                            <div className="flex items-center gap-4">
                                <div className="text-sm text-gray-600">
                                    参加学生: <span className="font-semibold">{students.length}</span>/25名
                                </div>
                                {students.length > 0 && (
                                    <div className="flex items-center gap-2">
                                        <label htmlFor="student-select" className="text-sm text-gray-600">
                                            表示中:
                                        </label>
                                        <select
                                            id="student-select"
                                            value={selectedStudentId || ''}
                                            onChange={(e) => handleStudentSelect(e.target.value)}
                                            className="border border-gray-300 rounded-md px-3 py-1 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        >
                                            {students.map((student, index) => (
                                                <option key={student.id} value={student.id}>
                                                    学生{index + 1}: {student.firstName} {student.lastName}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="text-sm text-gray-500">
                            {isTeacher ? '教師モード' : '学生モード'}
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
                        <p className="text-red-600">{error}</p>
                    </div>
                )}

                <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                    <CodeDiffViewer
                        teacherCode={teacherCode.content}
                        studentCode={studentCode.content}
                        isTeacher={isTeacher}
                        onTeacherCodeChange={handleTeacherCodeChange}
                        onStudentCodeChange={handleStudentCodeChange}
                    />
                </div>
            </div>
        </div>
    )
} 