import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { clerkClient } from '@clerk/nextjs/server'

const prisma = new PrismaClient()

const webhookSecret = process.env.CLERK_WEBHOOK_SECRET!
// 先生のメールアドレス（環境変数から取得）
const TEACHER_EMAIL = process.env.TEACHER_EMAIL || 'teacher@example.com'

type ClerkUserEvent = {
    type: string
    data: {
        id: string
        email_addresses: Array<{
            email_address: string
            id: string
        }>
        first_name: string | null
        last_name: string | null
        image_url: string | null
        created_at: number
        updated_at: number
    }
}

export async function POST(req: NextRequest) {
    // Webhookシークレットが設定されているかチェック
    if (!webhookSecret) {
        console.error('CLERK_WEBHOOK_SECRET is not set')
        return NextResponse.json(
            { error: 'Webhook secret not configured' },
            { status: 500 }
        )
    }

    // リクエストヘッダーを取得
    const headerPayload = await headers()
    const svix_id = headerPayload.get('svix-id')
    const svix_timestamp = headerPayload.get('svix-timestamp')
    const svix_signature = headerPayload.get('svix-signature')

    // 必要なヘッダーがあるかチェック
    if (!svix_id || !svix_timestamp || !svix_signature) {
        return NextResponse.json(
            { error: 'Missing required webhook headers' },
            { status: 400 }
        )
    }

    // リクエストボディを取得
    const payload = await req.text()

    // Webhookを検証
    const wh = new Webhook(webhookSecret)
    let evt: ClerkUserEvent

    try {
        evt = wh.verify(payload, {
            'svix-id': svix_id,
            'svix-timestamp': svix_timestamp,
            'svix-signature': svix_signature,
        }) as ClerkUserEvent
    } catch (err) {
        console.error('Error verifying webhook:', err)
        return NextResponse.json(
            { error: 'Invalid webhook signature' },
            { status: 400 }
        )
    }

    // イベントタイプに応じて処理
    try {
        switch (evt.type) {
            case 'user.created':
                await handleUserCreated(evt.data)
                break
            case 'user.updated':
                await handleUserUpdated(evt.data)
                break
            case 'user.deleted':
                await handleUserDeleted(evt.data.id)
                break
            default:
                console.log(`Unhandled event type: ${evt.type}`)
        }

        return NextResponse.json({ received: true }, { status: 200 })
    } catch (error) {
        console.error('Error processing webhook:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// ユーザー作成時の処理
async function handleUserCreated(userData: ClerkUserEvent['data']) {
    const primaryEmail = userData.email_addresses.find(
        (email) => email.id === userData.email_addresses[0]?.id
    )

    if (!primaryEmail) {
        console.error('No primary email found for user:', userData.id)
        return
    }

    // メールアドレスがTEACHER_EMAILと一致するかチェック
    const isTeacher = primaryEmail.email_address === TEACHER_EMAIL
    const userRole = isTeacher ? 'teacher' : 'student'

    try {
        // 既存の先生ユーザーがいる場合は学生に変更
        if (isTeacher) {
            const existingTeachers = await prisma.user.findMany({
                where: { role: 'teacher' },
                select: { id: true }
            })

            await prisma.user.updateMany({
                where: { role: 'teacher' },
                data: { role: 'student' }
            })

            // 既存先生のClerkメタデータも更新
            const client = await clerkClient()
            for (const teacher of existingTeachers) {
                try {
                    await client.users.updateUserMetadata(teacher.id, {
                        publicMetadata: { role: 'student' }
                    })
                } catch (err) {
                    console.error(`Error updating Clerk metadata for user ${teacher.id}:`, err)
                }
            }

            console.log('Existing teacher users converted to students')
        }

        const user = await prisma.user.create({
            data: {
                id: userData.id,
                email: primaryEmail.email_address,
                firstName: userData.first_name,
                lastName: userData.last_name,
                imageUrl: userData.image_url,
                role: userRole,
            },
        })

        // Clerkのユーザーメタデータにもロールを設定
        const client = await clerkClient()
        await client.users.updateUserMetadata(userData.id, {
            publicMetadata: { role: userRole }
        })

        console.log(`User created in database: ${user.id} with role: ${userRole}`)
    } catch (error) {
        console.error('Error creating user in database:', error)
        // 既に存在する場合はupsertを試行
        try {
            // 既存の先生ユーザーがいる場合は学生に変更
            if (isTeacher) {
                const existingTeachers = await prisma.user.findMany({
                    where: {
                        role: 'teacher',
                        id: { not: userData.id }
                    },
                    select: { id: true }
                })

                await prisma.user.updateMany({
                    where: {
                        role: 'teacher',
                        id: { not: userData.id }
                    },
                    data: { role: 'student' }
                })

                // 既存先生のClerkメタデータも更新
                const client = await clerkClient()
                for (const teacher of existingTeachers) {
                    try {
                        await client.users.updateUserMetadata(teacher.id, {
                            publicMetadata: { role: 'student' }
                        })
                    } catch (err) {
                        console.error(`Error updating Clerk metadata for user ${teacher.id}:`, err)
                    }
                }
            }

            await prisma.user.upsert({
                where: { id: userData.id },
                update: {
                    email: primaryEmail.email_address,
                    firstName: userData.first_name,
                    lastName: userData.last_name,
                    imageUrl: userData.image_url,
                    role: userRole,
                },
                create: {
                    id: userData.id,
                    email: primaryEmail.email_address,
                    firstName: userData.first_name,
                    lastName: userData.last_name,
                    imageUrl: userData.image_url,
                    role: userRole,
                },
            })

            // Clerkのユーザーメタデータにもロールを設定
            const client = await clerkClient()
            await client.users.updateUserMetadata(userData.id, {
                publicMetadata: { role: userRole }
            })

            console.log(`User upserted in database: ${userData.id} with role: ${userRole}`)
        } catch (upsertError) {
            console.error('Error upserting user:', upsertError)
        }
    }
}

// ユーザー更新時の処理
async function handleUserUpdated(userData: ClerkUserEvent['data']) {
    const primaryEmail = userData.email_addresses.find(
        (email) => email.id === userData.email_addresses[0]?.id
    )

    if (!primaryEmail) {
        console.error('No primary email found for user:', userData.id)
        return
    }

    // メールアドレスがTEACHER_EMAILと一致するかチェック
    const isTeacher = primaryEmail.email_address === TEACHER_EMAIL

    try {
        // 既存の先生ユーザーがいる場合は学生に変更（現在のユーザー以外）
        if (isTeacher) {
            const existingTeachers = await prisma.user.findMany({
                where: {
                    role: 'teacher',
                    id: { not: userData.id }
                },
                select: { id: true }
            })

            await prisma.user.updateMany({
                where: {
                    role: 'teacher',
                    id: { not: userData.id }
                },
                data: { role: 'student' }
            })

            // 既存先生のClerkメタデータも更新
            const client = await clerkClient()
            for (const teacher of existingTeachers) {
                try {
                    await client.users.updateUserMetadata(teacher.id, {
                        publicMetadata: { role: 'student' }
                    })
                } catch (err) {
                    console.error(`Error updating Clerk metadata for user ${teacher.id}:`, err)
                }
            }

            console.log('Existing teacher users converted to students')
        }

        const userRole = isTeacher ? 'teacher' : 'student'

        const user = await prisma.user.update({
            where: { id: userData.id },
            data: {
                email: primaryEmail.email_address,
                firstName: userData.first_name,
                lastName: userData.last_name,
                imageUrl: userData.image_url,
                role: userRole,
            },
        })

        // Clerkのユーザーメタデータにもロールを設定
        const client = await clerkClient()
        await client.users.updateUserMetadata(userData.id, {
            publicMetadata: { role: userRole }
        })

        console.log(`User updated in database: ${user.id} with role: ${userRole}`)
    } catch (error) {
        console.error('Error updating user in database:', error)
    }
}

// ユーザー削除時の処理
async function handleUserDeleted(userId: string) {
    try {
        await prisma.user.delete({
            where: { id: userId },
        })

        console.log('User deleted from database:', userId)
    } catch (error) {
        console.error('Error deleting user from database:', error)
    }
} 