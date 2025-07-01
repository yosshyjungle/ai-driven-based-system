import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@clerk/nextjs/server";

const prisma = new PrismaClient();

async function connectDB() {
    try {
        await prisma.$connect();
    } catch (err) {
        throw new Error("DB接続に失敗しました");
    }
}

// 学生のコード取得
export const GET = async (req: Request, { params }: { params: { id: string } }) => {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        await connectDB();

        const studentCode = await prisma.studentCode.findUnique({
            where: {
                sessionId_studentId: {
                    sessionId: params.id,
                    studentId: userId
                }
            }
        });

        if (!studentCode) {
            return NextResponse.json({
                studentCode: { content: '', updatedAt: new Date().toISOString() }
            }, { status: 200 });
        }

        return NextResponse.json({ message: "Success", studentCode }, { status: 200 });
    } catch (err) {
        console.error('Student code GET error:', err);
        return NextResponse.json({ message: "Error", err }, { status: 500 });
    } finally {
        await prisma.$disconnect();
    }
};

// 学生のコード更新
export const PUT = async (req: Request, { params }: { params: { id: string } }) => {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { content } = await req.json();

        await connectDB();

        // セッションの存在確認
        const session = await prisma.session.findUnique({
            where: { id: params.id }
        });

        if (!session) {
            return NextResponse.json({ message: "Session not found" }, { status: 404 });
        }

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

        const studentCode = await prisma.studentCode.upsert({
            where: {
                sessionId_studentId: {
                    sessionId: params.id,
                    studentId: userId
                }
            },
            update: { content },
            create: { sessionId: params.id, studentId: userId, content }
        });

        return NextResponse.json({ message: "Success", studentCode }, { status: 200 });
    } catch (err) {
        console.error('Student code PUT error:', err);
        return NextResponse.json({ message: "Error", err }, { status: 500 });
    } finally {
        await prisma.$disconnect();
    }
}; 