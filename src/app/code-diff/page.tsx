'use client'

import { useEffect, useState } from 'react'
import { useAuth, useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
// import Link from 'next/link'
import Navbar from '@/components/Navbar'

interface Session {
    id: string
    title: string
    teacherId: string
    createdAt: string
    updatedAt: string
    teacher?: {
        firstName?: string
        lastName?: string
        email: string
    }
}

export default function CodeDiffPage() {
    const { isSignedIn, userId } = useAuth()
    const { user } = useUser()
    const router = useRouter()
    const [sessions, setSessions] = useState<Session[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [newSessionTitle, setNewSessionTitle] = useState('')
    const [creating, setCreating] = useState(false)

    // ユーザーの役割を取得（Clerkのpublic_metadataから）
    const userRole = user?.publicMetadata?.role as string || 'student'

    useEffect(() => {
        if (isSignedIn) {
            fetchSessions()
        }
    }, [isSignedIn, userId])

    const fetchSessions = async () => {
        try {
            const response = await fetch('/api/code-diff/sessions')
            if (!response.ok) {
                throw new Error('セッションの取得に失敗しました')
            }
            const data = await response.json()
            setSessions(data.sessions || [])
        } catch (err) {
            setError(err instanceof Error ? err.message : '予期しないエラーが発生しました')
        } finally {
            setLoading(false)
        }
    }

    const handleCreateSession = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!newSessionTitle.trim()) {
            setError('セッションタイトルを入力してください')
            return
        }

        setCreating(true)
        setError(null)

        try {
            const response = await fetch('/api/code-diff/sessions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: newSessionTitle.trim(),
                }),
            })

            if (!response.ok) {
                throw new Error('セッションの作成に失敗しました')
            }

            const data = await response.json()
            router.push(`/code-diff/session/${data.session.id}`)
        } catch (err) {
            setError(err instanceof Error ? err.message : '予期しないエラーが発生しました')
        } finally {
            setCreating(false)
        }
    }

    const handleJoinSession = (sessionId: string) => {
        router.push(`/code-diff/session/${sessionId}`)
    }

    if (!isSignedIn) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">ログインが必要です</h1>
                    <p className="text-gray-600">コード差分比較機能を利用するにはログインしてください。</p>
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

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />

            <div className="max-w-6xl mx-auto px-4 py-6">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">コード差分比較</h1>
                        <p className="text-gray-600 mt-2">
                            {userRole === 'teacher'
                                ? '授業セッションを作成・管理できます'
                                : 'セッションに参加してコードを比較できます'
                            }
                        </p>
                    </div>

                    {userRole === 'teacher' && (
                        <button
                            onClick={() => setShowCreateForm(!showCreateForm)}
                            className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-colors"
                        >
                            新規セッション作成
                        </button>
                    )}
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
                        <p className="text-red-600">{error}</p>
                    </div>
                )}

                {showCreateForm && userRole === 'teacher' && (
                    <div className="bg-white rounded-lg shadow p-6 mb-8">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">新規セッション作成</h2>
                        <form onSubmit={handleCreateSession} className="space-y-4">
                            <div>
                                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                                    セッションタイトル
                                </label>
                                <input
                                    type="text"
                                    id="title"
                                    value={newSessionTitle}
                                    onChange={(e) => setNewSessionTitle(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="例: JavaScript基礎 - 変数と関数"
                                    disabled={creating}
                                />
                            </div>
                            <div className="flex gap-4">
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                                >
                                    {creating ? '作成中...' : 'セッション作成'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowCreateForm(false)}
                                    className="bg-gray-300 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-400 transition-colors"
                                >
                                    キャンセル
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="grid gap-6">
                    {sessions.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-gray-500 text-lg">
                                {userRole === 'teacher'
                                    ? 'まだセッションがありません。新規セッションを作成してください。'
                                    : 'まだ参加可能なセッションがありません。'
                                }
                            </p>
                        </div>
                    ) : (
                        sessions.map((session) => (
                            <div
                                key={session.id}
                                className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                            {session.title}
                                        </h3>
                                        <p className="text-gray-600 mb-3">
                                            教師: {session.teacher?.firstName} {session.teacher?.lastName} ({session.teacher?.email})
                                        </p>
                                        <time className="text-sm text-gray-400">
                                            作成日: {new Date(session.createdAt).toLocaleString('ja-JP')}
                                        </time>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleJoinSession(session.id)}
                                            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
                                        >
                                            {session.teacherId === userId ? 'セッション管理' : 'セッション参加'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
} 