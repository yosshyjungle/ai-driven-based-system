// アクティブなSSE接続を管理するためのMap
const connections = new Map<string, {
    controller: ReadableStreamDefaultController;
    sessionId: string;
    userId: string;
    encoder: TextEncoder;
}>();

// 接続を追加する関数
export function addConnection(connectionId: string, connection: {
    controller: ReadableStreamDefaultController;
    sessionId: string;
    userId: string;
    encoder: TextEncoder;
}) {
    connections.set(connectionId, connection);
}

// 接続を削除する関数
export function removeConnection(connectionId: string) {
    connections.delete(connectionId);
}

// 接続の存在確認
export function hasConnection(connectionId: string) {
    return connections.has(connectionId);
}

// 接続を取得する関数
export function getConnections() {
    return connections;
}

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