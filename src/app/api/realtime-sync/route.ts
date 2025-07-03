import { NextResponse } from "next/server";

// メモリ上で管理する簡単なデータストア
let originalText = '';
let changedText = '';

// アクティブなSSE接続を管理
const connections = new Map<string, {
    controller: ReadableStreamDefaultController;
    encoder: TextEncoder;
}>();

// リアルタイム更新の取得（SSE）
export const GET = async (req: Request) => {
    console.log('SSE connection request to realtime-sync');

    const stream = new ReadableStream({
        start(controller) {
            const encoder = new TextEncoder();
            const connectionId = `conn-${Date.now()}-${Math.random()}`;

            console.log(`Creating SSE connection: ${connectionId}`);

            // 接続をMapに追加
            connections.set(connectionId, {
                controller,
                encoder
            });

            // 接続確立メッセージと現在のデータを送信
            const initMessage = `data: ${JSON.stringify({
                type: 'connected',
                originalText,
                changedText,
                timestamp: new Date().toISOString()
            })}\n\n`;

            try {
                controller.enqueue(encoder.encode(initMessage));
                console.log(`Initial data sent to ${connectionId}`);
            } catch (error) {
                console.error(`Error sending initial data to ${connectionId}:`, error);
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

            req.signal?.addEventListener('abort', cleanup);
        },

        cancel() {
            console.log('Stream cancelled');
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
};

// テキスト更新
export const POST = async (req: Request) => {
    try {
        const { type, content } = await req.json();

        console.log(`Updating ${type} text:`, content.substring(0, 50) + '...');

        // データ更新
        if (type === 'original') {
            originalText = content;
        } else if (type === 'changed') {
            changedText = content;
        } else {
            return NextResponse.json({ message: "Invalid type" }, { status: 400 });
        }

        // 全接続にブロードキャスト
        broadcastUpdate(type, content);

        return NextResponse.json({
            message: "Success",
            originalText,
            changedText
        });
    } catch (error) {
        console.error('Update error:', error);
        return NextResponse.json({ message: "Error" }, { status: 500 });
    }
};

// 現在のデータ取得
export const PUT = async () => {
    return NextResponse.json({
        originalText,
        changedText
    });
};

// 全接続に更新を通知する関数
function broadcastUpdate(type: 'original' | 'changed', content: string) {
    console.log(`Broadcasting ${type} update to ${connections.size} connections`);

    const message = `data: ${JSON.stringify({
        type: 'text_update',
        textType: type,
        content,
        timestamp: new Date().toISOString()
    })}\n\n`;

    let successCount = 0;
    let errorCount = 0;

    for (const [connectionId, connection] of connections.entries()) {
        try {
            connection.controller.enqueue(connection.encoder.encode(message));
            successCount++;
        } catch (error) {
            console.error(`Failed to send message to connection ${connectionId}:`, error);
            connections.delete(connectionId);
            errorCount++;
        }
    }

    console.log(`Broadcast complete: ${successCount} successful, ${errorCount} failed`);
} 