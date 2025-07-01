import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { Webhook } from 'svix'
import { headers } from 'next/headers'

const prisma = new PrismaClient()

const webhookSecret = process.env.CLERK_WEBHOOK_SECRET!

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

    try {
        const user = await prisma.user.create({
            data: {
                id: userData.id,
                email: primaryEmail.email_address,
                firstName: userData.first_name,
                lastName: userData.last_name,
                imageUrl: userData.image_url,
            },
        })

        console.log('User created in database:', user.id)
    } catch (error) {
        console.error('Error creating user in database:', error)
        // 既に存在する場合はupsertを試行
        try {
            await prisma.user.upsert({
                where: { id: userData.id },
                update: {
                    email: primaryEmail.email_address,
                    firstName: userData.first_name,
                    lastName: userData.last_name,
                    imageUrl: userData.image_url,
                },
                create: {
                    id: userData.id,
                    email: primaryEmail.email_address,
                    firstName: userData.first_name,
                    lastName: userData.last_name,
                    imageUrl: userData.image_url,
                },
            })
            console.log('User upserted in database:', userData.id)
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

    try {
        const user = await prisma.user.update({
            where: { id: userData.id },
            data: {
                email: primaryEmail.email_address,
                firstName: userData.first_name,
                lastName: userData.last_name,
                imageUrl: userData.image_url,
            },
        })

        console.log('User updated in database:', user.id)
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