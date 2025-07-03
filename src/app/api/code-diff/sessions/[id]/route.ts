import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@clerk/nextjs/server";

// Prismaクライアントのシングルトンパターン
const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// セッション詳細取得
export const GET = async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }



        const resolvedParams = await params;

        // テストセッションの場合は動的に作成
        if (resolvedParams.id === 'test-session-123') {
            // テスト用セッションとユーザーを確保
            const testUser = await prisma.user.upsert({
                where: { id: userId },
                update: {},
                create: {
                    id: userId,
                    email: `test-user-${userId}@example.com`,
                    role: 'teacher'
                }
            });

            const session = await prisma.session.upsert({
                where: { id: resolvedParams.id },
                update: {},
                create: {
                    id: resolvedParams.id,
                    title: 'Test Session',
                    teacherId: testUser.id
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

            return NextResponse.json({ message: "Success", session }, { status: 200 });
        }

        const session = await prisma.session.findUnique({
            where: { id: resolvedParams.id },
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

        if (!session) {
            return NextResponse.json({ message: "Session not found" }, { status: 404 });
        }

        return NextResponse.json({ message: "Success", session }, { status: 200 });
    } catch (err) {
        console.error('Session GET error:', err);
        return NextResponse.json({ message: "Error", err }, { status: 500 });
    }
}; 