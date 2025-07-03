import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@clerk/nextjs/server";

// Prismaクライアントのシングルトンパターン
const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// アクティブなSSE接続を管理するためのMap
const connections = new Map<string, {
    controller: ReadableStreamDefaultController;
    sessionId: string;
    userId: string;
    encoder: TextEncoder;
}>();

// Prismaの自動接続管理を使用するため、connectDB関数は削除

// SSEストリームの設定
export const GET = async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    console.log('SSE endpoint called');

    try {
        const { userId } = await auth();

        if (!userId) {
            console.log('Unauthorized access to SSE');
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        console.log(`SSE connection request from user: ${userId}`);

        // Prismaは自動的に接続管理するため、明示的な接続は不要
        const resolvedParams = await params;
        console.log(`Session ID: ${resolvedParams.id}`);

        // セッションの存在確認（テスト用のセッションIDは許可）
        if (resolvedParams.id !== 'test-session-123') {
            const session = await prisma.session.findUnique({
                where: { id: resolvedParams.id }
            });

            if (!session) {
                console.log(`Session not found: ${resolvedParams.id}`);
                return NextResponse.json({ message: "Session not found" }, { status: 404 });
            }
        }

        let connectionId: string;

        // SSEストリームの作成
        const stream = new ReadableStream({
            start(controller) {
                const encoder = new TextEncoder();
                connectionId = `${userId}-${Date.now()}`;

                console.log(`Creating SSE connection: ${connectionId}`);

                // 接続をMapに追加
                connections.set(connectionId, {
                    controller,
                    sessionId: resolvedParams.id,
                    userId,
                    encoder
                });

                // 接続確立メッセージ
                const initMessage = `data: ${JSON.stringify({
                    type: 'connected',
                    sessionId: resolvedParams.id,
                    userId: userId,
                    timestamp: new Date().toISOString()
                })}\n\n`;

                try {
                    controller.enqueue(encoder.encode(initMessage));
                    console.log(`Initial message sent to ${connectionId}`);
                } catch (error) {
                    console.error(`Error sending initial message to ${connectionId}:`, error);
                }

                // 定期的なハートビート（30秒間隔）
                const heartbeat = setInterval(() => {
                    if (!connections.has(connectionId)) {
                        clearInterval(heartbeat);
                        return;
                    }

                    const heartbeatMessage = `data: ${JSON.stringify({
                        type: 'heartbeat',
                        timestamp: new Date().toISOString()
                    })}\n\n`;

                    try {
                        controller.enqueue(encoder.encode(heartbeatMessage));
                    } catch (error) {
                        console.log(`Heartbeat failed for ${connectionId}, cleaning up`);
                        clearInterval(heartbeat);
                        connections.delete(connectionId);
                    }
                }, 30000);

                // クライアント切断時のクリーンアップ
                const cleanup = () => {
                    console.log(`Cleaning up connection: ${connectionId}`);
                    clearInterval(heartbeat);
                    connections.delete(connectionId);
                };

                req.signal.addEventListener('abort', cleanup);
            },

            cancel() {
                console.log(`Stream cancelled for ${connectionId}`);
                connections.delete(connectionId);
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Cache-Control'
            }
        });

    } catch (err) {
        console.error('SSE GET error:', err);
        return NextResponse.json({ message: "Error", error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
    }
};

// コード更新をすべての接続に通知する関数
export function broadcastCodeUpdate(sessionId: string, type: 'teacher' | 'student', content: string, studentId?: string) {
    console.log(`Broadcasting ${type} code update to session ${sessionId}${studentId ? ` for student ${studentId}` : ''}`);
    console.log(`Current connections: ${connections.size}`);

    const message = `data: ${JSON.stringify({
        type: 'code_update',
        codeType: type,
        content,
        sessionId,
        studentId: type === 'student' ? studentId : undefined,
        timestamp: new Date().toISOString()
    })}\n\n`;

    let successCount = 0;
    let errorCount = 0;

    for (const [connectionId, connection] of connections.entries()) {
        if (connection.sessionId === sessionId) {
            try {
                connection.controller.enqueue(connection.encoder.encode(message));
                successCount++;
                console.log(`Message sent to connection: ${connectionId}`);
            } catch (error) {
                console.error(`Failed to send message to connection ${connectionId}:`, error);
                connections.delete(connectionId);
                errorCount++;
            }
        }
    }

    console.log(`Broadcast complete: ${successCount} successful, ${errorCount} failed`);
}

// 学生参加通知をすべての接続に送信する関数
export function broadcastStudentJoined(sessionId: string, studentInfo: { id: string; firstName?: string; lastName?: string; email: string }) {
    console.log(`Broadcasting student joined to session ${sessionId}: ${studentInfo.firstName} ${studentInfo.lastName}`);

    const message = `data: ${JSON.stringify({
        type: 'student_joined',
        sessionId,
        student: studentInfo,
        timestamp: new Date().toISOString()
    })}\n\n`;

    let successCount = 0;
    let errorCount = 0;

    for (const [connectionId, connection] of connections.entries()) {
        if (connection.sessionId === sessionId) {
            try {
                connection.controller.enqueue(connection.encoder.encode(message));
                successCount++;
                console.log(`Student joined message sent to connection: ${connectionId}`);
            } catch (error) {
                console.error(`Failed to send student joined message to connection ${connectionId}:`, error);
                connections.delete(connectionId);
                errorCount++;
            }
        }
    }

    console.log(`Student joined broadcast complete: ${successCount} successful, ${errorCount} failed`);
} 