import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@clerk/nextjs/server";
import { broadcastCodeUpdate, broadcastStudentJoined } from "@/lib/broadcast";

// Prismaクライアントのシングルトンパターン
const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// 学生のコード取得
export const GET = async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    console.log('Student code GET endpoint called');

    try {
        const { userId } = await auth();
        console.log('User authentication:', { userId });

        if (!userId) {
            console.log('No userId found, returning unauthorized');
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        console.log('Using Prisma auto-connection management');

        const resolvedParams = await params;
        const url = new URL(req.url);
        const studentId = url.searchParams.get('studentId');
        console.log('Resolved params:', resolvedParams, 'Student ID:', studentId);

        // 現在のユーザーの情報を取得
        const currentUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true }
        });

        let targetStudentId = userId; // デフォルトは自分のID

        // 先生の場合は、指定された学生のコードを取得可能
        if (currentUser?.role === 'teacher' && studentId) {
            targetStudentId = studentId;
            console.log('Teacher accessing student code:', targetStudentId);
        } else if (currentUser?.role === 'student') {
            // 学生の場合は自分のコードのみ取得可能
            targetStudentId = userId;
            console.log('Student accessing own code:', targetStudentId);
        }

        const studentCode = await prisma.studentCode.findUnique({
            where: {
                sessionId_studentId: {
                    sessionId: resolvedParams.id,
                    studentId: targetStudentId
                }
            }
        });
        console.log('Student code found:', studentCode);

        if (!studentCode) {
            console.log('No student code found, returning empty content');
            return NextResponse.json({
                studentCode: { content: '', updatedAt: new Date().toISOString() }
            }, { status: 200 });
        }

        console.log('Returning student code');
        return NextResponse.json({ message: "Success", studentCode }, { status: 200 });
    } catch (err) {
        console.error('Student code GET error:', err);
        const error = err instanceof Error ? err : new Error('Unknown error');
        return NextResponse.json({ message: "Error", error: error.message }, { status: 500 });
    }
};

// 学生のコード更新
export const PUT = async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    console.log('Student code PUT endpoint called');

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

        // セッションの存在確認（テスト用セッションは除く）
        let session = null;
        const isTestSession = resolvedParams.id === 'test-session-123';
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

            console.log('Upserting user for real session...');
            // ユーザーが存在しない場合は作成
            await prisma.user.upsert({
                where: { id: userId },
                update: {},
                create: {
                    id: userId,
                    email: `user-${userId}@example.com`, // 仮のメール
                    role: 'student'
                }
            });
            console.log('User upserted successfully');
        } else {
            console.log('Test session detected, checking/creating user and session...');

            // テスト用ユーザーの作成・更新
            const user = await prisma.user.upsert({
                where: { id: userId },
                update: {},
                create: {
                    id: userId,
                    email: `test-user-${userId}@example.com`,
                    role: 'student' // テスト用セッションでは学生として設定
                }
            });
            console.log('Test user upserted:', user);

            // テスト用セッションが存在するか確認し、なければ作成
            const existingSession = await prisma.session.findUnique({
                where: { id: resolvedParams.id }
            });

            if (!existingSession) {
                console.log('Creating test session as student cannot create sessions...');
                // 学生はセッションを作成できないので、デフォルトの教師アカウントを使用
                const defaultTeacher = await prisma.user.upsert({
                    where: { id: 'default-teacher' },
                    update: {},
                    create: {
                        id: 'default-teacher',
                        email: 'default-teacher@example.com',
                        role: 'teacher'
                    }
                });

                const testSession = await prisma.session.upsert({
                    where: { id: resolvedParams.id },
                    update: {},
                    create: {
                        id: resolvedParams.id,
                        title: 'Test Session',
                        teacherId: defaultTeacher.id
                    }
                });
                console.log('Test session created with default teacher:', testSession);
            }
        }

        console.log('Upserting student code...');

        // 学生コードが新規作成されるかチェック
        const existingStudentCode = await prisma.studentCode.findUnique({
            where: {
                sessionId_studentId: {
                    sessionId: resolvedParams.id,
                    studentId: userId
                }
            }
        });

        const isNewStudent = !existingStudentCode;

        const studentCode = await prisma.studentCode.upsert({
            where: {
                sessionId_studentId: {
                    sessionId: resolvedParams.id,
                    studentId: userId
                }
            },
            update: { content },
            create: { sessionId: resolvedParams.id, studentId: userId, content }
        });
        console.log('Student code upserted successfully:', { id: studentCode.id, sessionId: resolvedParams.id });

        // 新規学生の場合は学生参加通知を送信
        if (isNewStudent) {
            console.log('New student detected, sending join notification');
            const studentInfo = await prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true
                }
            });

            if (studentInfo) {
                try {
                    const studentInfoForBroadcast = {
                        id: studentInfo.id,
                        firstName: studentInfo.firstName || undefined,
                        lastName: studentInfo.lastName || undefined,
                        email: studentInfo.email
                    };
                    broadcastStudentJoined(resolvedParams.id, studentInfoForBroadcast);
                    console.log('Student joined notification sent successfully');
                } catch (broadcastError) {
                    console.error('Student joined broadcast error:', broadcastError);
                }
            }
        }

        // リアルタイム更新の通知
        console.log(`Broadcasting student code update for session ${resolvedParams.id}, student ${userId}`);
        try {
            broadcastCodeUpdate(resolvedParams.id, 'student', content, userId);
            console.log('Broadcast completed successfully');
        } catch (broadcastError) {
            console.error('Broadcast error:', broadcastError);
            // ブロードキャストエラーは致命的ではないので、処理を続行
        }

        console.log('Returning success response');
        return NextResponse.json({ message: "Success", studentCode }, { status: 200 });
    } catch (err) {
        console.error('Student code PUT error:', err);
        const error = err instanceof Error ? err : new Error('Unknown error');
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        return NextResponse.json({
            message: "Error",
            error: error.message,
            errorName: error.name,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 });
    }
}; 