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

// セッション詳細取得
export const GET = async (req: Request, { params }: { params: { id: string } }) => {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        await connectDB();

        const session = await prisma.session.findUnique({
            where: { id: params.id },
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
    } finally {
        await prisma.$disconnect();
    }
}; 