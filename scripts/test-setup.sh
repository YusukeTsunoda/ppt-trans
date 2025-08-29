#!/bin/bash

# Test Environment Setup Script
# このスクリプトはE2Eテスト実行前に必要な環境を準備します

set -e  # エラーが発生したら即座に終了

echo "🚀 Starting test environment setup..."

# カラー出力の設定
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Supabaseの起動確認と起動
echo "📦 Checking Supabase status..."
if supabase status > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Supabase is already running${NC}"
else
  echo -e "${YELLOW}Starting Supabase...${NC}"
  supabase start
  
  # Supabaseの起動を待つ
  echo "Waiting for Supabase to be ready..."
  for i in {1..30}; do
    if curl -s http://127.0.0.1:54321/rest/v1/ > /dev/null 2>&1; then
      echo -e "${GREEN}✓ Supabase is ready!${NC}"
      break
    fi
    echo -n "."
    sleep 2
  done
fi

# 2. 環境変数の設定
echo "🔧 Setting up environment variables..."
export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
export NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
export SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres?schema=public"
export NODE_ENV=test

# 3. テスト用データベースのマイグレーション
echo "🗄️ Running database migrations..."
supabase migration up 2>/dev/null || echo "Migrations already applied"

# 4. テストユーザーの作成
echo "👤 Creating test users..."
npm run test:seed 2>/dev/null || echo "Test data seeding will be handled by the test suite"

# 5. Next.jsサーバーの確認
echo "🌐 Checking Next.js server..."
if curl -s http://localhost:3000 > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Next.js server is running${NC}"
else
  echo -e "${YELLOW}Starting Next.js server in background...${NC}"
  npm run dev > /tmp/next-dev.log 2>&1 &
  
  # サーバー起動を待つ
  echo "Waiting for Next.js to be ready..."
  for i in {1..30}; do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
      echo -e "${GREEN}✓ Next.js is ready!${NC}"
      break
    fi
    echo -n "."
    sleep 2
  done
fi

# 6. ヘルスチェック
echo "🏥 Running health checks..."
HEALTH_CHECK=$(curl -s http://localhost:3000/api/health)
if echo "$HEALTH_CHECK" | grep -q '"hasSupabaseUrl":true'; then
  echo -e "${GREEN}✓ API health check passed${NC}"
else
  echo -e "${RED}✗ API health check failed${NC}"
  echo "Response: $HEALTH_CHECK"
  exit 1
fi

# 7. テスト環境の準備完了
echo ""
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Test environment is ready!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo ""
echo "You can now run tests with:"
echo "  npm run test:e2e"
echo ""
echo "Environment:"
echo "  - Supabase URL: http://127.0.0.1:54321"
echo "  - Next.js URL: http://localhost:3000"
echo "  - Database URL: postgresql://127.0.0.1:54322/postgres"
echo ""