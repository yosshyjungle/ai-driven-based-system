# AI Driven Webhooks System

Clerkを使った認証システムとSupabase（PostgreSQL）データベースを連携したNext.jsアプリケーションです。ユーザーがサインインした際に、WebhookでSupabaseのユーザーテーブルにデータを自動追加します。

## 機能

- Clerkによるユーザー認証
- Webhook経由でのユーザー情報自動同期
- Prisma ORMを使ったデータベース操作
- ブログ投稿システム

## 環境変数の設定

`.env.local`ファイルを作成し、以下の環境変数を設定してください：

```bash
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_WEBHOOK_SECRET=your_clerk_webhook_secret

# Database
DATABASE_URL=your_supabase_postgresql_url

# Next.js (オプション)
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
```

## Clerk Webhookの設定

1. [Clerk Dashboard](https://dashboard.clerk.com/)にログイン
2. プロジェクトを選択
3. 左サイドバーから「Webhooks」を選択
4. 「Create Endpoint」をクリック
5. Endpoint URLに `https://your-domain.com/api/clerk/webhook` を入力
6. Eventsで以下を選択：
   - `user.created`
   - `user.updated`
   - `user.deleted`
7. 「Create」をクリック
8. 作成されたWebhookの「Signing Secret」をコピーして、`CLERK_WEBHOOK_SECRET`環境変数に設定

## データベースセットアップ

```bash
# Prismaマイグレーション実行
npx prisma migrate dev

# Prismaクライアント生成
npx prisma generate
```

## 開発サーバーの起動

```bash
npm run dev
# または
yarn dev
# または
pnpm dev
```

[http://localhost:3000](http://localhost:3000)でアプリケーションにアクセスできます。

## Webhookの動作

- **ユーザー作成**: Clerkでユーザーが新規登録すると、Supabaseのユーザーテーブルに自動的にレコードが作成されます
- **ユーザー更新**: Clerkでユーザー情報が更新されると、Supabaseのレコードも同期更新されます
- **ユーザー削除**: Clerkでユーザーが削除されると、Supabaseからもレコードが削除されます

## 技術スタック

- Next.js 15
- Clerk（認証）
- Prisma（ORM）
- PostgreSQL（Supabase）
- TypeScript
- Tailwind CSS

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
#   a i - d r i v e n - b a s e d - s y s t e m 
 
 