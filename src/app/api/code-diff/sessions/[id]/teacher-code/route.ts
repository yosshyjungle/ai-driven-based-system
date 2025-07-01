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

// 教師のコード取得
export const GET = async (req: Request, { params }: { params: { id: string } }) => {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        await connectDB();

        const teacherCode = await prisma.teacherCode.findUnique({
            where: { sessionId: params.id }
        });

        if (!teacherCode) {
            return NextResponse.json({
                teacherCode: { content: '', updatedAt: new Date().toISOString() }
            }, { status: 200 });
        }

        return NextResponse.json({ message: "Success", teacherCode }, { status: 200 });
    } catch (err) {
        console.error('Teacher code GET error:', err);
        return NextResponse.json({ message: "Error", err }, { status: 500 });
    } finally {
        await prisma.$disconnect();
    }
};

// 教師のコード更新
export const PUT = async (req: Request, { params }: { params: { id: string } }) => {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { content } = await req.json();

        await connectDB();

        // セッションの存在確認と権限チェック
        const session = await prisma.session.findUnique({
            where: { id: params.id }
        });

        if (!session) {
            return NextResponse.json({ message: "Session not found" }, { status: 404 });
        }

        if (session.teacherId !== userId) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const teacherCode = await prisma.teacherCode.upsert({
            where: { sessionId: params.id },
            update: { content },
            create: { sessionId: params.id, content }
        });

        return NextResponse.json({ message: "Success", teacherCode }, { status: 200 });
    } catch (err) {
        console.error('Teacher code PUT error:', err);
        return NextResponse.json({ message: "Error", err }, { status: 500 });
    } finally {
        await prisma.$disconnect();
    }
}; 