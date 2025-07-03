import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@clerk/nextjs/server";

const prisma = new PrismaClient();

async function connectDB() {
    try {
        await prisma.$connect();
    } catch {
        throw new Error("DB接続に失敗しました");
    }
}

// セッション一覧取得
export const GET = async () => {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        await connectDB();

        // すべてのセッションを取得（教師・学生関係なく）
        const sessions = await prisma.session.findMany({
            include: {
                teacher: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return NextResponse.json({ message: "Success", sessions }, { status: 200 });
    } catch (err) {
        console.error('Sessions GET error:', err);
        return NextResponse.json({ message: "Error", error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
    } finally {
        await prisma.$disconnect();
    }
};

// セッション作成
export const POST = async (req: Request) => {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { title } = await req.json();

        if (!title) {
            return NextResponse.json(
                { message: "タイトルは必須です" },
                { status: 400 }
            );
        }

        await connectDB();

        // ユーザーが存在しない場合は作成
        await prisma.user.upsert({
            where: { id: userId },
            update: {},
            create: {
                id: userId,
                email: `user-${userId}@example.com`, // 仮のメール
                role: 'teacher' // セッション作成者は教師とする
            }
        });

        // セッション作成
        const session = await prisma.session.create({
            data: {
                title,
                teacherId: userId,
            },
            include: {
                teacher: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    }
                }
            }
        });

        // 教師のコードテーブルも初期化
        await prisma.teacherCode.create({
            data: {
                sessionId: session.id,
                content: '// ここにコードを入力してください',
            }
        });

        return NextResponse.json({ message: "Success", session }, { status: 201 });
    } catch (err) {
        console.error('Session POST error:', err);
        return NextResponse.json({ message: "Error", error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
    } finally {
        await prisma.$disconnect();
    }
}; 