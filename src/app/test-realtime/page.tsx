'use client'

import { useState } from 'react'
import RealtimeTextCompare from '@/components/RealtimeTextCompare'
import Navbar from '@/components/Navbar'
import Link from 'next/link'

export default function TestRealtimePage() {
    const [sessionId, setSessionId] = useState('test-session-123')

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />

            <div className="max-w-7xl mx-auto px-4 py-6">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-4">複数学生対応テスト</h1>
                    <div className="flex justify-center items-center gap-4 mb-4">
                        <label htmlFor="sessionId" className="text-sm font-medium text-gray-700">
                            セッションID:
                        </label>
                        <input
                            type="text"
                            id="sessionId"
                            value={sessionId}
                            onChange={(e) => setSessionId(e.target.value)}
                            className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="セッションIDを入力"
                        />
                    </div>

                    {/* 複数学生テスト用のリンク */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                        <h2 className="text-lg font-semibold text-blue-900 mb-3">複数学生テスト用リンク</h2>
                        <p className="text-sm text-blue-700 mb-4">
                            異なるポート（localhost:3001, localhost:3002など）または異なるブラウザで以下のリンクを開いて、複数学生をシミュレートできます
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {Array.from({ length: 6 }, (_, i) => (
                                <Link
                                    key={i}
                                    href={`/code-diff/session/${sessionId}`}
                                    target="_blank"
                                    className="block p-3 bg-white border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors text-center"
                                >
                                    <div className="font-medium text-blue-900">学生 {i + 1}</div>
                                    <div className="text-xs text-blue-600">新しいタブで開く</div>
                                </Link>
                            ))}
                        </div>

                        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                            <p className="text-xs text-yellow-800">
                                💡 ヒント: 先生としてテストするには、Clerkのユーザープロファイルでroleを「teacher」に設定してください
                            </p>
                        </div>
                    </div>

                    <p className="text-gray-600 text-sm mb-4">
                        下記の旧テストインターフェース（RealtimeTextCompare）も利用できます
                    </p>
                </div>

                <RealtimeTextCompare sessionId={sessionId} />
            </div>
        </div>
    )
} 