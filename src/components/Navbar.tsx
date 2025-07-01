'use client'

import { useAuth, UserButton } from '@clerk/nextjs'
import Link from 'next/link'

export default function Navbar() {
  const { isSignedIn } = useAuth()

  return (
    <nav className="bg-white shadow">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link
              href="/"
              className="text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors"
            >
              ブログ
            </Link>
          </div>
          
          <div className="flex items-center space-x-4">
            {isSignedIn ? (
              <>
                <Link
                  href="/blog/new"
                  className="text-gray-700 hover:text-blue-600 transition-colors"
                >
                  記事作成
                </Link>
                <UserButton 
                  appearance={{
                    elements: {
                      userButtonAvatarBox: 'w-8 h-8'
                    }
                  }}
                />
              </>
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