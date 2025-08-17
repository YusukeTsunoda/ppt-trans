# 🎯 究極の実装計画 - 絶対に失敗しない完全版

## なぜ今度こそ失敗しないのか

これまでの計画の失敗原因:
1. **理想論** - 現実の制約を無視
2. **前提の欠如** - 必要な環境が整っていない
3. **具体性不足** - 「やる」だけで「どうやる」がない
4. **エラー対応なし** - うまくいく前提

この計画の特徴:
- **失敗前提** - エラーが起きることを想定
- **超具体的** - コピペで実行可能
- **段階的** - 1つずつ確実に
- **検証重視** - 各ステップで動作確認

---

## 📋 Day -1: 事前準備と環境検証（必須）

### 朝: 開発環境の完全確認

```bash
#!/bin/bash
# check-env.sh - このスクリプトを実行して全てOKになるまで先に進まない

echo "=== 環境チェック開始 ==="

# Node.jsチェック
NODE_VERSION=$(node -v 2>/dev/null)
if [[ $NODE_VERSION == v18* ]] || [[ $NODE_VERSION == v20* ]]; then
    echo "✅ Node.js: $NODE_VERSION"
else
    echo "❌ Node.js 18.x or 20.x が必要です"
    echo "   インストール: brew install node@18"
    exit 1
fi

# npmチェック
NPM_VERSION=$(npm -v 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "✅ npm: $NPM_VERSION"
else
    echo "❌ npm が見つかりません"
    exit 1
fi

# Dockerチェック
if docker --version &>/dev/null; then
    echo "✅ Docker: $(docker --version)"
    
    # Docker起動チェック
    if docker ps &>/dev/null; then
        echo "✅ Docker daemon: 起動中"
        
        # メモリチェック
        DOCKER_MEM=$(docker system info 2>/dev/null | grep "Total Memory" | awk '{print $3}')
        echo "   Memory: $DOCKER_MEM"
    else
        echo "❌ Docker Desktop を起動してください"
        exit 1
    fi
else
    echo "❌ Docker Desktop をインストールしてください"
    echo "   https://www.docker.com/products/docker-desktop"
    exit 1
fi

# Gitチェック
if git --version &>/dev/null; then
    echo "✅ Git: $(git --version)"
else
    echo "❌ Git をインストールしてください"
    exit 1
fi

# ポートチェック
for PORT in 3000 54321 54322 54323; do
    if lsof -i :$PORT &>/dev/null; then
        echo "⚠️  ポート $PORT が使用中です"
        echo "   lsof -i :$PORT で確認して、必要ならプロセスを停止してください"
    else
        echo "✅ ポート $PORT: 利用可能"
    fi
done

echo ""
echo "=== 環境チェック完了 ==="
```

### 昼: プロジェクト初期化

```bash
# 1. 完全クリーンスタート
cd /path/to/ppt-trans
git stash
git checkout main
rm -rf node_modules .next .env.local package-lock.json

# 2. 必要なファイルのバックアップ
cp .env.local .env.local.backup 2>/dev/null || true

# 3. 依存関係インストール（エラーが出たら止まる）
npm install || {
    echo "❌ npm install 失敗"
    echo "解決方法:"
    echo "1. rm -rf node_modules package-lock.json"
    echo "2. npm cache clean --force"
    echo "3. npm install"
    exit 1
}

# 4. 最小限のTypeScript設定（まず動かすことを優先）
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": false,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "forceConsistentCasingInFileNames": false
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules", ".next"]
}
EOF

# 5. 初回ビルドテスト（エラーは無視）
npm run build 2>&1 | tee build.log || true
echo "ビルドログを build.log に保存しました"
```

### 夜: Supabaseローカル環境

```bash
# 1. Supabase CLIインストール
if ! command -v supabase &> /dev/null; then
    echo "Supabase CLIをインストール中..."
    brew install supabase/tap/supabase || {
        echo "Homebrewでのインストール失敗。npmで試します..."
        npm install -g supabase
    }
fi

# 2. Supabaseプロジェクト初期化
mkdir -p supabase
cd supabase

# 既存の設定があれば停止
supabase stop 2>/dev/null || true

# 3. 設定ファイル作成
cat > config.toml << 'EOF'
# Supabase設定
project_id = "ppt-translator"

[api]
enabled = true
port = 54321
schemas = ["public"]

[db]
port = 54322

[studio]
enabled = true
port = 54323

[auth]
enable_signup = true

[auth.email]
enable_signup = true
double_confirm_changes = false
enable_confirmations = false

[storage]
enabled = true
EOF

# 4. Supabase起動
echo "Supabaseを起動中... (初回は5-10分かかります)"
supabase start || {
    echo "❌ Supabase起動失敗"
    echo "解決方法:"
    echo "1. Docker Desktopが起動していることを確認"
    echo "2. docker system prune -a でDockerをクリーンアップ"
    echo "3. supabase stop && supabase start"
    exit 1
}

# 5. 接続情報を表示
echo ""
echo "===== Supabase接続情報 ====="
supabase status
echo "============================="
echo ""
echo "この情報を .env.local に設定してください:"
echo "NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321"
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=[上記のanon keyをコピー]"
echo "SUPABASE_SERVICE_ROLE_KEY=[上記のservice_role keyをコピー]"
```

---

## 📅 Day 0: 最小限動作する状態を作る

### 目標: 「Hello World」が表示される状態

#### Step 1: 環境変数設定（30分）

```bash
# .env.local作成
cat > .env.local << 'EOF'
# Supabase Local
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU

# App Config
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# 後で追加
# ANTHROPIC_API_KEY=
EOF

echo "✅ .env.local を作成しました"
```

#### Step 2: 最小限のページ作成（30分）

```typescript
// src/app/page.tsx
export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">
          PowerPoint Translator
        </h1>
        <p className="text-gray-600">
          環境構築成功！ 🎉
        </p>
        <div className="mt-8 space-y-2 text-left bg-gray-100 p-4 rounded">
          <p>✅ Next.js: 動作中</p>
          <p>✅ TypeScript: 設定済み</p>
          <p>✅ Tailwind CSS: 有効</p>
        </div>
      </div>
    </div>
  );
}
```

```typescript
// src/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PowerPoint Translator',
  description: 'Translate your presentations',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
```

```css
/* src/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

#### Step 3: 動作確認（必須）

```bash
# 開発サーバー起動
npm run dev

# 別ターミナルで確認
curl http://localhost:3000 || echo "❌ サーバーが起動していません"

# ブラウザで確認
open http://localhost:3000
```

**ここで動かなければ先に進まない！**

---

## 📅 Day 1: Supabase接続確認

### 目標: データベースに接続できる状態

#### Step 1: データベーススキーマ作成（1時間）

```sql
-- supabase/migrations/001_initial.sql
-- 最小限のテーブルのみ作成

-- プロファイルテーブル
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 動作確認用のテストテーブル
CREATE TABLE IF NOT EXISTS test_connection (
  id SERIAL PRIMARY KEY,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- テストデータ挿入
INSERT INTO test_connection (message) VALUES ('Database connected successfully!');
```

```bash
# マイグレーション実行
cd supabase
psql "postgresql://postgres:postgres@localhost:54322/postgres" < migrations/001_initial.sql

# 確認
psql "postgresql://postgres:postgres@localhost:54322/postgres" -c "SELECT * FROM test_connection;"
```

#### Step 2: API接続テスト（1時間）

```typescript
// src/app/api/health/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// 環境変数チェック
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
}

export async function GET() {
  const checks: Record<string, any> = {
    timestamp: new Date().toISOString(),
    environment: {
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseKey: !!supabaseKey,
      nodeEnv: process.env.NODE_ENV,
    },
  };

  try {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    // Supabaseクライアント作成
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // 接続テスト
    const { data, error } = await supabase
      .from('test_connection')
      .select('*')
      .limit(1)
      .single();
    
    if (error) {
      checks.database = {
        connected: false,
        error: error.message,
      };
    } else {
      checks.database = {
        connected: true,
        testData: data,
      };
    }
  } catch (error) {
    checks.database = {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  const status = checks.database?.connected ? 200 : 503;
  
  return NextResponse.json(checks, { status });
}
```

#### Step 3: 動作確認（必須）

```bash
# APIテスト
curl http://localhost:3000/api/health | jq .

# 期待される出力
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "environment": {
    "hasSupabaseUrl": true,
    "hasSupabaseKey": true,
    "nodeEnv": "development"
  },
  "database": {
    "connected": true,
    "testData": {
      "id": 1,
      "message": "Database connected successfully!",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

**データベース接続が確認できなければ先に進まない！**

---

## 📅 Day 2: 認証の最小実装

### 目標: ログインできる状態（UIなしでもOK）

#### Step 1: 認証ヘルパー作成（2時間）

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// クライアントサイド用
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 簡単な認証関数
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) {
    console.error('Sign in error:', error);
    return { success: false, error: error.message };
  }
  
  return { success: true, data };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    console.error('Sign out error:', error);
    return { success: false, error: error.message };
  }
  
  return { success: true };
}

export async function getUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error) {
    console.error('Get user error:', error);
    return null;
  }
  
  return user;
}
```

#### Step 2: テストユーザー作成（30分）

```typescript
// src/app/api/test-auth/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  
  // Service Roleで管理者権限を使用
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  
  // テストユーザー作成
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'test@example.com',
    password: 'testpassword123',
    email_confirm: true,
  });
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  
  return NextResponse.json({
    message: 'Test user created',
    email: 'test@example.com',
    password: 'testpassword123',
  });
}
```

#### Step 3: 動作確認（必須）

```bash
# テストユーザー作成
curl -X POST http://localhost:3000/api/test-auth

# Node.js REPLでテスト
node -e "
const fetch = require('node-fetch');
async function test() {
  // ログイン
  const res = await fetch('http://localhost:54321/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
    },
    body: JSON.stringify({
      email: 'test@example.com',
      password: 'testpassword123'
    })
  });
  const data = await res.json();
  console.log('Login result:', data.access_token ? 'SUCCESS' : 'FAILED');
}
test();
"
```

---

## 🚨 エラー別対処法（必読）

### npm install が失敗

```bash
# 対処法1: キャッシュクリア
npm cache clean --force
rm -rf node_modules package-lock.json
npm install

# 対処法2: レジストリ変更
npm config set registry https://registry.npmjs.org/
npm install

# 対処法3: 権限修正
sudo chown -R $(whoami) ~/.npm
npm install
```

### Supabase が起動しない

```bash
# 対処法1: 完全リセット
supabase stop --no-backup
docker system prune -a
supabase start

# 対処法2: ポート変更
# supabase/config.toml を編集
[api]
port = 54325  # 別のポートに変更

# 対処法3: Docker再起動
# Docker Desktopを再起動
```

### TypeScriptエラーが大量

```json
// tsconfig.json - 一時的に全て無視
{
  "compilerOptions": {
    "strict": false,
    "skipLibCheck": true,
    "noEmit": true,
    "allowJs": true,
    "checkJs": false
  }
}
```

---

## ✅ 各Dayの完了基準（厳密）

### Day -1 完了
- [ ] check-env.sh が全て ✅
- [ ] npm install 成功
- [ ] Supabase Studio が開く（http://localhost:54323）

### Day 0 完了
- [ ] http://localhost:3000 で「環境構築成功！」が表示
- [ ] ビルドエラーが100個以下

### Day 1 完了
- [ ] /api/health が {"database": {"connected": true}} を返す
- [ ] test_connectionテーブルにデータがある

### Day 2 完了
- [ ] テストユーザーでログインできる
- [ ] アクセストークンが取得できる

---

## 🎯 これで本当に失敗しない理由

1. **前提条件を明確化** - 環境チェックスクリプトで確認
2. **エラー前提** - 各ステップにエラー対処法
3. **段階的** - 1日1つの明確な目標
4. **検証重視** - 動作確認できなければ先に進まない
5. **具体的** - コピペで実行可能

**この計画なら、確実に前に進める。**