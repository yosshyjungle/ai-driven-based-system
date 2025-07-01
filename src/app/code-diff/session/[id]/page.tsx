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

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
    const { isSignedIn, userId } = useAuth()
    const { user } = useUser()
    const router = useRouter()
    const [session, setSession] = useState<Session | null>(null)
    const [teacherCode, setTeacherCode] = useState<TeacherCode>({ content: '', updatedAt: '' })
    const [studentCode, setStudentCode] = useState<StudentCode>({ content: '', updatedAt: '' })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)

    const resolvedParams = use(params)
    const userRole = user?.publicMetadata?.role as string || 'student'
    const isTeacher = session?.teacherId === userId

    useEffect(() => {
        if (isSignedIn && resolvedParams.id) {
            fetchSessionData()
            // TODO: Setup realtime subscriptions
        }
    }, [isSignedIn, resolvedParams.id, userId])

    const fetchSessionData = async () => {
        try {
            // セッション情報取得
            const sessionResponse = await fetch(`/api/code-diff/sessions/${resolvedParams.id}`)
            if (!sessionResponse.ok) {
                throw new Error('セッション情報の取得に失敗しました')
            }
            const sessionData = await sessionResponse.json()
            setSession(sessionData.session)

            // 教師のコード取得
            const teacherCodeResponse = await fetch(`/api/code-diff/sessions/${resolvedParams.id}/teacher-code`)
            if (teacherCodeResponse.ok) {
                const teacherCodeData = await teacherCodeResponse.json()
                setTeacherCode(teacherCodeData.teacherCode)
            }

            // 学生のコード取得（学生の場合のみ）
            if (!isTeacher) {
                const studentCodeResponse = await fetch(`/api/code-diff/sessions/${resolvedParams.id}/student-code`)
                if (studentCodeResponse.ok) {
                    const studentCodeData = await studentCodeResponse.json()
                    setStudentCode(studentCodeData.studentCode)
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