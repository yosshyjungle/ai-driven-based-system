import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@clerk/nextjs/server";
import { broadcastCodeUpdate } from "../live/route";

// Prismaクライアントのシングルトンパターン
const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Prismaの自動接続管理を使用するため、connectDB関数は削除

// 教師のコード取得
export const GET = async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        // Prismaは自動的に接続管理するため、明示的な接続は不要

        const resolvedParams = await params;
        const teacherCode = await prisma.teacherCode.findUnique({
            where: { sessionId: resolvedParams.id }
        });

        if (!teacherCode) {
            return NextResponse.json({
                teacherCode: { content: '', updatedAt: new Date().toISOString() }
            }, { status: 200 });
        }

        return NextResponse.json({ message: "Success", teacherCode }, { status: 200 });
    } catch (err) {
        console.error('Teacher code GET error:', err);
        const error = err instanceof Error ? err : new Error('Unknown error');
        return NextResponse.json({ message: "Error", error: error.message }, { status: 500 });
    }
};

// 教師のコード更新
export const PUT = async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    console.log('Teacher code PUT endpoint called');

    try {
        const { userId } = await auth();
        console.log('User authentication:', { userId });

        if (!userId) {
            console.log('No userId found, returning unauthorized');
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const requestBody = await req.json();
        console.log('Request body received:', requestBody);
        const { content } = requestBody;

        console.log('Using Prisma auto-connection management');

        const resolvedParams = await params;
        console.log('Resolved params:', resolvedParams);

        // セッションの存在確認と権限チェック
        let session = null;
        let isTestSession = resolvedParams.id === 'test-session-123';
        console.log('Is test session:', isTestSession);

        if (!isTestSession) {
            console.log('Checking for real session...');
            session = await prisma.session.findUnique({
                where: { id: resolvedParams.id }
            });
            console.log('Session found:', session);

            if (!session) {
                console.log('Session not found, returning 404');
                return NextResponse.json({ message: "Session not found" }, { status: 404 });
            }

            // 権限チェック：セッションの教師のみがコードを更新可能
            if (session.teacherId !== userId) {
                console.log('Permission denied: user is not the teacher');
                return NextResponse.json({ message: "Forbidden: Only the session teacher can update teacher code" }, { status: 403 });
            }
        } else {
            console.log('Test session detected, checking/creating user and session...');

            // テスト用ユーザーの作成・更新
            const user = await prisma.user.upsert({
                where: { id: userId },
                update: {},
                create: {
                    id: userId,
                    email: `test-user-${userId}@example.com`,
                    role: 'teacher' // テスト用セッションでは先生として設定
                }
            });
            console.log('Test user upserted:', user);

            // テスト用セッションの作成・更新
            const testSession = await prisma.session.upsert({
                where: { id: resolvedParams.id },
                update: {},
                create: {
                    id: resolvedParams.id,
                    title: 'Test Session',
                    teacherId: userId
                }
            });
            console.log('Test session upserted:', testSession);
        }

        console.log('Upserting teacher code...');
        const teacherCode = await prisma.teacherCode.upsert({
            where: { sessionId: resolvedParams.id },
            update: { content },
            create: { sessionId: resolvedParams.id, content }
        });
        console.log('Teacher code upserted successfully:', { id: teacherCode.id, sessionId: resolvedParams.id, contentLength: content.length });

        // リアルタイム更新の通知
        console.log(`Broadcasting teacher code update for session ${resolvedParams.id}`);
        try {
            broadcastCodeUpdate(resolvedParams.id, 'teacher', content);
            console.log('Broadcast completed successfully');
        } catch (broadcastError) {
            console.error('Broadcast error:', broadcastError);
            // ブロードキャストエラーは致命的ではないので、処理を続行
        }

        console.log('Returning success response');
        return NextResponse.json({ message: "Success", teacherCode }, { status: 200 });
    } catch (err) {
        console.error('Teacher code PUT error:', err);
        const error = err instanceof Error ? err : new Error('Unknown error');
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });

        // より詳細なエラー情報を返す
        return NextResponse.json({
            message: "Error",
            error: error.message,
            errorName: error.name,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 });
    }
}; 