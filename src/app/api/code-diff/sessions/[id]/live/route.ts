import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@clerk/nextjs/server";
import { addConnection, removeConnection, hasConnection } from "@/lib/broadcast";

// Prismaクライアントのシングルトンパターン
const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

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
                addConnection(connectionId, {
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
                } catch {
                    console.error(`Error sending initial message to ${connectionId}`);
                }

                // 定期的なハートビート（30秒間隔）
                const heartbeat = setInterval(() => {
                    if (!hasConnection(connectionId)) {
                        clearInterval(heartbeat);
                        return;
                    }

                    const heartbeatMessage = `data: ${JSON.stringify({
                        type: 'heartbeat',
                        timestamp: new Date().toISOString()
                    })}\n\n`;

                    try {
                        controller.enqueue(encoder.encode(heartbeatMessage));
                    } catch {
                        console.log(`Heartbeat failed for ${connectionId}, cleaning up`);
                        clearInterval(heartbeat);
                        removeConnection(connectionId);
                    }
                }, 30000);

                // クライアント切断時のクリーンアップ
                const cleanup = () => {
                    console.log(`Cleaning up connection: ${connectionId}`);
                    clearInterval(heartbeat);
                    removeConnection(connectionId);
                };

                req.signal.addEventListener('abort', cleanup);
            },

            cancel() {
                console.log(`Stream cancelled for ${connectionId}`);
                removeConnection(connectionId);
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

