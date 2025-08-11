#!/bin/bash

echo "🔧 データベースのセットアップを開始します..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env ファイルが見つかりません"
    echo "📝 .env.example をコピーして .env を作成してください:"
    echo "   cp .env.example .env"
    echo "   その後、DATABASE_URL と NEXTAUTH_SECRET を設定してください"
    exit 1
fi

# Generate Prisma client
echo "📦 Prisma クライアントを生成中..."
npx prisma generate

# Run database migrations
echo "🗄️ データベースマイグレーションを実行中..."
npx prisma migrate dev --name init

# Seed the database (optional)
echo "🌱 初期データを投入しますか？ (y/n)"
read -r answer
if [ "$answer" = "y" ]; then
    npx prisma db seed
fi

echo "✅ データベースのセットアップが完了しました！"
echo ""
echo "📋 次のステップ:"
echo "1. npm run dev でアプリケーションを起動"
echo "2. http://localhost:3000/register で新規ユーザー登録"
echo "3. 管理者権限が必要な場合は、Prisma Studio でユーザーのロールを ADMIN に変更:"
echo "   npx prisma studio"