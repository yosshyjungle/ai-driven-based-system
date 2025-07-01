'use client'

import { useAuth, UserButton } from '@clerk/nextjs'
import Link from 'next/link'

export default function Navbar() {
  const { isSignedIn } = useAuth()

  return (
    <nav className="bg-white shadow">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <Link
              href="/"
              className="text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors"
            >
              DiffChecker
            </Link>
            {isSignedIn && (
              <>
                <Link
                  href="/code-diff"
                  className="text-gray-700 hover:text-blue-600 transition-colors font-medium"
                >
                  コード差分比較
                </Link>
                <Link
                  href="/admin/teacher"
                  className="text-gray-700 hover:text-blue-600 transition-colors font-medium text-sm"
                >
                  先生設定
                </Link>
              </>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {isSignedIn ? (
              <UserButton
                appearance={{
                  elements: {
                    userButtonAvatarBox: 'w-8 h-8'
                  }
                }}
              />
            ) : (
              <Link
                href="/sign-in"
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                ログイン
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
} 