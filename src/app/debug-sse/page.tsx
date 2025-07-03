'use client'

import { useEffect, useState } from 'react'

export default function DebugSSEPage() {
    const [isConnected, setIsConnected] = useState(false)
    const [events, setEvents] = useState<string[]>([])
    const [error, setError] = useState<string>('')

    useEffect(() => {
        const sessionId = 'test-session-123'
        const url = `/api/code-diff/sessions/${sessionId}/live`

        console.log('Attempting to connect to:', url)
        setEvents(prev => [...prev, `Attempting to connect to: ${url}`])

        const eventSource = new EventSource(url)

        eventSource.onopen = (event) => {
            console.log('SSE connection opened:', event)
            setIsConnected(true)
            setError('')
            setEvents(prev => [...prev, 'Connection opened successfully'])
        }

        eventSource.onmessage = (event) => {
            console.log('SSE message received:', event.data)
            setEvents(prev => [...prev, `Message: ${event.data}`])
        }

        eventSource.onerror = (event) => {
            console.error('SSE error:', event)
            setIsConnected(false)
            setError('Connection failed')
            setEvents(prev => [...prev, `Error occurred - readyState: ${eventSource.readyState}`])

            // より詳細なエラー情報
            if (eventSource.readyState === EventSource.CLOSED) {
                setEvents(prev => [...prev, 'EventSource is CLOSED'])
            } else if (eventSource.readyState === EventSource.CONNECTING) {
                setEvents(prev => [...prev, 'EventSource is CONNECTING'])
            } else if (eventSource.readyState === EventSource.OPEN) {
                setEvents(prev => [...prev, 'EventSource is OPEN'])
            }
        }

        return () => {
            console.log('Closing EventSource connection')
            eventSource.close()
            setIsConnected(false)
        }
    }, [])

    const testCodeUpdate = async () => {
        try {
            const response = await fetch('/api/code-diff/sessions/test-session-123/teacher-code', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content: `console.log("Test update at ${new Date().toLocaleTimeString()}");`
                }),
            })

            const result = await response.text()
            console.log('Update response:', response.status, result)
            setEvents(prev => [...prev, `Update sent - Status: ${response.status}`])
        } catch (error) {
            console.error('Update error:', error)
            setEvents(prev => [...prev, `Update error: ${error}`])
        }
    }

    const clearEvents = () => {
        setEvents([])
        setError('')
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <h1 className="text-3xl font-bold mb-6">SSE Debug Page</h1>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-xl font-semibold mb-4">Connection Status</h2>
                    <div className={`text-lg font-medium mb-4 ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                        {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
                            <p className="text-red-700 font-medium">Error: {error}</p>
                        </div>
                    )}

                    <div className="space-y-2">
                        <button
                            onClick={testCodeUpdate}
                            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 mr-2"
                        >
                            Send Test Update
                        </button>
                        <button
                            onClick={clearEvents}
                            className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
                        >
                            Clear Events
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-xl font-semibold mb-4">Events Log</h2>
                    <div className="bg-gray-100 rounded p-4 h-96 overflow-y-auto">
                        {events.length === 0 ? (
                            <p className="text-gray-500">No events yet...</p>
                        ) : (
                            events.map((event, index) => (
                                <div key={index} className="text-sm mb-2 p-2 bg-white rounded border">
                                    <span className="text-gray-500 font-mono text-xs">
                                        {new Date().toLocaleTimeString()}:
                                    </span>
                                    <br />
                                    {event}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
} 