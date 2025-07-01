import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { clerkClient } from '@clerk/nextjs/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 環境変数から設定された先生のメールアドレス
const TEACHER_EMAIL = process.env.TEACHER_EMAIL || 'teacher@example.com'

export async function POST(req: NextRequest) {
    try {
        const { userId } = await auth()

        if (!userId) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            )
        }

        const { email } = await req.json()

        if (!email || email !== TEACHER_EMAIL) {
            return NextResponse.json(
                { error: 'Invalid teacher email' },
                { status: 400 }
            )
        }

        const client = await clerkClient()

        // 現在の先生ユーザーを検索
        const currentTeacher = await client.users.getUserList({
            limit: 100,
        })

        // 既存の先生を学生に戻す
        for (const user of currentTeacher.data) {
            if (user.publicMetadata?.role === 'teacher') {
                await client.users.updateUserMetadata(user.id, {
                    publicMetadata: { role: 'student' }
                })
            }
        }

        // データベースでも役割を更新
        await prisma.user.updateMany({
            where: { role: 'teacher' },
            data: { role: 'student' }
        })

        // 新しい先生を設定
        await client.users.updateUserMetadata(userId, {
            publicMetadata: { role: 'teacher' }
        })

        // データベースでも更新
        await prisma.user.update({
            where: { id: userId },
            data: { role: 'teacher' }
        })

        return NextResponse.json({
            message: 'Teacher role assigned successfully',
            teacherId: userId
        })

    } catch (error) {
        console.error('Error assigning teacher role:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

export async function GET() {
    try {
        // 現在の先生を取得
        const teacher = await prisma.user.findFirst({
            where: { role: 'teacher' },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
            }
        })

        return NextResponse.json({
            teacher: teacher || null,
            teacherEmail: TEACHER_EMAIL
        })

    } catch (error) {
        console.error('Error fetching teacher:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
} 