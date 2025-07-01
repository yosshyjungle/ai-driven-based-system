'use client'

import { useState, useEffect } from 'react'
import { useAuth, useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'

interface Teacher {
    id: string
    email: string
    firstName?: string
    lastName?: string
}

export default function TeacherAdminPage() {
    const { isSignedIn, userId } = useAuth()
    const { user } = useUser()
    const router = useRouter()
    const [teacher, setTeacher] = useState<Teacher | null>(null)
    const [teacherEmail, setTeacherEmail] = useState('')
    const [inputEmail, setInputEmail] = useState('')
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    useEffect(() => {
        if (isSignedIn) {
            fetchTeacherInfo()
        }
    }, [isSignedIn])

    const fetchTeacherInfo = async () => {
        try {
            const response = await fetch('/api/admin/teacher')
            if (!response.ok) {
                throw new Error('先生情報の取得に失敗しました')
            }
            const data = await response.json()
            setTeacher(data.teacher)
            setTeacherEmail(data.teacherEmail)
            setInputEmail(user?.emailAddresses[0]?.emailAddress || '')
        } catch (err) {
            setError(err instanceof Error ? err.message : '予期しないエラーが発生しました')
        } finally {
            setLoading(false)
        }
    }

    const handleSetTeacher = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitting(true)
        setError(null)
        setSuccess(null)

        try {
            const response = await fetch('/api/admin/teacher', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: inputEmail,
                }),
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || '先生の設定に失敗しました')
            }

            setSuccess('先生の役割が正常に設定されました')
            await fetchTeacherInfo()

            // ページをリロードして役割を反映
            setTimeout(() => {
                window.location.reload()
            }, 2000)

        } catch (err) {
            setError(err instanceof Error ? err.message : '予期しないエラーが発生しました')
        } finally {
            setSubmitting(false)
        }
    }

    if (!isSignedIn) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">ログインが必要です</h1>
                    <p className="text-gray-600">管理機能を利用するにはログインしてください。</p>
                </div>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50">
                <Navbar />
                <div className="flex items-center justify-center pt-20">
                    <div className="text-lg text-gray-600">読み込み中...</div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />

            <main className="max-w-4xl mx-auto px-4 py-8">
                <div className="bg-white rounded-lg shadow p-6">
                    <h1 className="text-3xl font-bold text-gray-900 mb-6">先生役割の管理</h1>

                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
                            <p className="text-red-600">{error}</p>
                        </div>
                    )}

                    {success && (
                        <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-6">
                            <p className="text-green-600">{success}</p>
                        </div>
                    )}

                    {/* 現在の先生情報 */}
                    <div className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">現在の先生</h2>
                        {teacher ? (
                            <div className="bg-blue-50 rounded-lg p-4">
                                <p className="text-blue-900">
                                    <span className="font-semibold">
                                        {teacher.firstName} {teacher.lastName}
                                    </span>
                                    <span className="ml-2 text-blue-700">({teacher.email})</span>
                                </p>
                            </div>
                        ) : (
                            <div className="bg-gray-50 rounded-lg p-4">
                                <p className="text-gray-600">現在、先生が設定されていません</p>
                            </div>
                        )}
                    </div>

                    {/* 先生設定フォーム */}
                    <div className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">先生役割の設定</h2>
                        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
                            <p className="text-yellow-800 text-sm">
                                <strong>注意:</strong> 許可されたメールアドレス（{teacherEmail}）のみが先生になることができます。
                                新しい先生を設定すると、現在の先生は自動的に学生役割に変更されます。
                            </p>
                        </div>

                        <form onSubmit={handleSetTeacher} className="space-y-4">
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                                    あなたのメールアドレス
                                </label>
                                <input
                                    type="email"
                                    id="email"
                                    value={inputEmail}
                                    onChange={(e) => setInputEmail(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="メールアドレスを入力"
                                    required
                                    disabled={submitting}
                                />
                                <p className="text-sm text-gray-500 mt-1">
                                    設定されたメールアドレス（{teacherEmail}）と一致する必要があります
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={submitting || inputEmail !== teacherEmail}
                                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                            >
                                {submitting ? '設定中...' : '先生役割を設定する'}
                            </button>
                        </form>
                    </div>

                    {/* 使用方法 */}
                    <div className="border-t pt-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">使用方法</h2>
                        <div className="space-y-3 text-sm text-gray-600">
                            <p>1. 環境変数 TEACHER_EMAIL に先生のメールアドレスを設定してください</p>
                            <p>2. 該当するメールアドレスでログインし、このページで先生役割を設定してください</p>
                            <p>3. 先生は一人のみ設定可能で、新しい先生を設定すると以前の先生は学生になります</p>
                            <p>4. 先生はメインページでオリジナルテキストの編集とセッション管理が可能です</p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
} 