import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@clerk/nextjs/server";

// Prismaクライアントのシングルトンパターン
const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// セッションに参加している学生一覧を取得
export const GET = async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    console.log('Students list GET endpoint called');

    try {
        const { userId } = await auth();
        console.log('User authentication:', { userId });

        if (!userId) {
            console.log('No userId found, returning unauthorized');
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const resolvedParams = await params;
        console.log('Resolved params:', resolvedParams);

        // ユーザーが先生かチェック
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true }
        });

        if (!user || user.role !== 'teacher') {
            console.log('User is not a teacher, returning forbidden');
            return NextResponse.json({ message: "Forbidden - Teachers only" }, { status: 403 });
        }

        // セッションの存在確認
        const session = await prisma.session.findUnique({
            where: { id: resolvedParams.id }
        });

        if (!session) {
            console.log('Session not found, returning 404');
            return NextResponse.json({ message: "Session not found" }, { status: 404 });
        }

        // セッションに参加している学生一覧を取得
        const students = await prisma.user.findMany({
            where: {
                studentCodes: {
                    some: {
                        sessionId: resolvedParams.id
                    }
                }
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
            },
            orderBy: [
                { firstName: 'asc' },
                { lastName: 'asc' }
            ]
        });

        console.log(`Found ${students.length} students for session ${resolvedParams.id}`);

        return NextResponse.json({
            message: "Success",
            students
        }, { status: 200 });

    } catch (err) {
        console.error('Students list GET error:', err);
        const error = err instanceof Error ? err : new Error('Unknown error');
        return NextResponse.json({
            message: "Error",
            error: error.message
        }, { status: 500 });
    }
}; 