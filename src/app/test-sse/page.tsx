'use client'

import { useEffect, useState } from 'react'

export default function TestSSEPage() {
    const [messages, setMessages] = useState<string[]>([])
    const [isConnected, setIsConnected] = useState(false)

    useEffect(() => {
        // 固定のセッションIDでテスト (実際のセッションIDに置き換え)
        const testSessionId = 'test-session-123'
        const eventSource = new EventSource(`/api/code-diff/sessions/${testSessionId}/live`)

        eventSource.onopen = () => {
            console.log('SSE connection opened')
            setIsConnected(true)
            setMessages(prev => [...prev, 'Connection opened'])
        }

        eventSource.onmessage = (event) => {
            console.log('SSE message received:', event.data)
            setMessages(prev => [...prev, `Message: ${event.data}`])
        }

        eventSource.onerror = (error) => {
            console.error('SSE error:', error)
            setIsConnected(false)
            setMessages(prev => [...prev, `Connection error: ${JSON.stringify(error)}`])

            // 詳細なエラー情報を取得
            if (eventSource.readyState === EventSource.CLOSED) {
                setMessages(prev => [...prev, 'EventSource closed'])
            } else if (eventSource.readyState === EventSource.CONNECTING) {
                setMessages(prev => [...prev, 'EventSource connecting'])
            }
        }

        return () => {
            eventSource.close()
            setIsConnected(false)
        }
    }, [])

    const sendTestUpdate = async () => {
        try {
            const response = await fetch('/api/code-diff/sessions/test-session-123/teacher-code', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content: `Test content ${Date.now()}` }),
            })
            console.log('Test update response:', response.status)
        } catch (error) {
            console.error('Test update error:', error)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <h1 className="text-2xl font-bold mb-4">SSE Test Page</h1>

            <div className="mb-4">
                <p className={`text-lg ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                    Status: {isConnected ? 'Connected' : 'Disconnected'}
                </p>
            </div>

            <button
                onClick={sendTestUpdate}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 mb-4"
            >
                Send Test Update
            </button>

            <div className="bg-white rounded-lg shadow p-4">
                <h2 className="text-lg font-semibold mb-2">Messages:</h2>
                <div className="space-y-1">
                    {messages.map((message, index) => (
                        <div key={index} className="text-sm text-gray-700 font-mono">
                            {new Date().toLocaleTimeString()}: {message}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
} 