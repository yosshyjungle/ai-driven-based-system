'use client'

import { useState } from 'react'
import { useAuth, useUser } from '@clerk/nextjs'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import * as Diff from 'diff-match-patch'

interface DiffResult {
  type: 'equal' | 'insert' | 'delete'
  text: string
}

export default function Home() {
  const { isSignedIn } = useAuth()
  const { user } = useUser()
  const [originalText, setOriginalText] = useState('')
  const [changedText, setChangedText] = useState('')
  const [diffResult, setDiffResult] = useState<DiffResult[]>([])
  const [showDiff, setShowDiff] = useState(false)

  // ユーザーの役割を取得
  const userRole = user?.publicMetadata?.role as string || 'student'

  const handleFindDifference = () => {
    if (!originalText.trim() || !changedText.trim()) {
      alert('両方のテキストを入力してください')
      return
    }

    const dmp = new Diff.diff_match_patch()
    const diffs = dmp.diff_main(originalText, changedText)
    dmp.diff_cleanupSemantic(diffs)

    const result: DiffResult[] = diffs.map(([operation, text]) => {
      let type: 'equal' | 'insert' | 'delete'
      switch (operation) {
        case Diff.DIFF_EQUAL:
          type = 'equal'
          break
        case Diff.DIFF_INSERT:
          type = 'insert'
          break
        case Diff.DIFF_DELETE:
          type = 'delete'
          break
        default:
          type = 'equal'
      }
      return { type, text }
    })

    setDiffResult(result)
    setShowDiff(true)
  }

  const clearTexts = () => {
    setOriginalText('')
    setChangedText('')
    setDiffResult([])
    setShowDiff(false)
  }

  const handleTeacherCodeChange = (newCode: string) => {
    // 先生のみがオリジナルテキストを編集可能
    if (userRole === 'teacher') {
      setOriginalText(newCode)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Compare text</h1>
          <p className="text-lg text-gray-600">Find the difference between two text files</p>
          {isSignedIn && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                ログイン中: <span className="font-semibold">{userRole === 'teacher' ? '先生' : '学生'}</span>
                {userRole === 'teacher' && (
                  <span className="ml-2 text-blue-600">（オリジナルテキストの編集が可能です）</span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* メイン比較エリア */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          {!showDiff ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* オリジナルテキスト */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-700">
                    Original text
                    {isSignedIn && userRole !== 'teacher' && (
                      <span className="ml-2 text-sm text-gray-500">（先生のみ編集可能）</span>
                    )}
                  </label>
                  <button className="text-sm text-blue-600 hover:text-blue-800 border border-gray-300 px-3 py-1 rounded">
                    Open file
                  </button>
                </div>
                <textarea
                  value={originalText}
                  onChange={(e) => handleTeacherCodeChange(e.target.value)}
                  disabled={isSignedIn && userRole !== 'teacher'}
                  className={`w-full h-96 p-4 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm ${isSignedIn && userRole !== 'teacher'
                      ? 'bg-gray-50 text-gray-600 cursor-not-allowed'
                      : 'bg-white'
                    }`}
                  placeholder={
                    isSignedIn && userRole !== 'teacher'
                      ? '先生のみがこのテキストを編集できます'
                      : '貼り付けるか、ここに入力してください...'
                  }
                />
              </div>

              {/* 変更されたテキスト */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-700">Changed text</label>
                  <button className="text-sm text-blue-600 hover:text-blue-800 border border-gray-300 px-3 py-1 rounded">
                    Open file
                  </button>
                </div>
                <textarea
                  value={changedText}
                  onChange={(e) => setChangedText(e.target.value)}
                  className="w-full h-96 p-4 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  placeholder="貼り付けるか、ここに入力してください..."
                />
              </div>
            </div>
          ) : (
            /* 差分表示エリア */
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">差分結果</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDiff(false)}
                    className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors"
                  >
                    編集に戻る
                  </button>
                  <button
                    onClick={clearTexts}
                    className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
                  >
                    クリア
                  </button>
                </div>
              </div>

              <div className="mb-4 text-sm text-gray-600">
                <span className="inline-block w-3 h-3 bg-red-200 mr-1 rounded"></span>削除
                <span className="inline-block w-3 h-3 bg-green-200 ml-4 mr-1 rounded"></span>追加
                <span className="inline-block w-3 h-3 bg-gray-200 ml-4 mr-1 rounded"></span>変更なし
              </div>

              <div className="border border-gray-300 rounded-md p-4 font-mono text-sm whitespace-pre-wrap max-h-96 overflow-auto bg-gray-50">
                {diffResult.map((diff, index) => (
                  <span
                    key={index}
                    className={
                      diff.type === 'delete'
                        ? 'bg-red-200 text-red-800'
                        : diff.type === 'insert'
                          ? 'bg-green-200 text-green-800'
                          : 'text-gray-800'
                    }
                  >
                    {diff.text}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 比較ボタン */}
          {!showDiff && (
            <div className="flex justify-center mt-6 gap-4">
              <button
                onClick={handleFindDifference}
                className="bg-blue-600 text-white px-8 py-3 rounded-md hover:bg-blue-700 transition-colors font-medium text-lg"
              >
                Find difference
              </button>
              {(originalText || changedText) && (
                <button
                  onClick={clearTexts}
                  className="bg-gray-500 text-white px-6 py-3 rounded-md hover:bg-gray-600 transition-colors font-medium"
                >
                  クリア
                </button>
              )}
            </div>
          )}
        </div>

        {/* 追加機能セクション */}
        {isSignedIn && (
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Advanced Features</h2>
            <div className="bg-white rounded-lg shadow p-6">
              <Link
                href="/code-diff"
                className="inline-block bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 transition-colors font-medium"
              >
                コード差分比較システム
              </Link>
              <p className="text-gray-600 mt-3">教師と学生間でのコード比較・指導システム</p>

              {/* 先生向けの管理機能 */}
              {userRole === 'teacher' && (
                <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
                  <h3 className="font-semibold text-yellow-800 mb-2">先生専用機能</h3>
                  <p className="text-sm text-yellow-700">
                    ・メインページでのオリジナルテキスト編集権限<br />
                    ・コード差分セッションの作成・管理<br />
                    ・学生コードの閲覧・指導
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
