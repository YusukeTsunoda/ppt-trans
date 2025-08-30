# ファイル別詳細修正計画

## 目次
1. [フェーズ1: CSS/Tailwind即座修正](#フェーズ1-csstailwind即座修正)
2. [フェーズ2: LPページ作成](#フェーズ2-lpページ作成)
3. [フェーズ3: ルーティング構造修正](#フェーズ3-ルーティング構造修正)
4. [フェーズ4: ダッシュボード統合](#フェーズ4-ダッシュボード統合)
5. [フェーズ5: 認証フロー改善](#フェーズ5-認証フロー改善)

---

## フェーズ1: CSS/Tailwind即座修正

### 1.1 `src/app/globals.css` の修正

#### 現在の問題
- CSS変数の定義が不完全
- Tailwindクラスとの競合

#### 修正内容
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }
  
  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 48%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

### 1.2 `tailwind.config.js` の修正

#### オプション1: shadcn/ui互換設定（推奨）
**メリット**: 
- UIコンポーネントライブラリとの完全な互換性
- ダーク/ライトモード対応が簡単
- 既存のshadcnコンポーネントがそのまま動作

**デメリット**:
- CSS変数の理解が必要
- カスタマイズが若干複雑

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

#### オプション2: シンプルな直接カラー定義
**メリット**:
- 理解しやすく、デバッグが簡単
- カスタマイズが直感的
- 既存コードへの影響が少ない

**デメリット**:
- ダークモード切り替えが手動
- shadcn/uiコンポーネントの修正が必要

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        gray: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
        },
      },
    },
  },
  plugins: [],
}
```

---

## フェーズ2: LPページ作成

### 2.1 新規ファイル: `src/app/(marketing)/page.tsx`

```typescript
import { Hero } from '@/components/landing/Hero';
import { Features } from '@/components/landing/Features';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { Pricing } from '@/components/landing/Pricing';
import { Footer } from '@/components/landing/Footer';
import { Header } from '@/components/landing/Header';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Pricing />
      </main>
      <Footer />
    </div>
  );
}
```

### 2.2 新規ファイル: `src/components/landing/Hero.tsx`

```typescript
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Upload } from 'lucide-react';

export function Hero() {
  return (
    <section className="relative overflow-hidden py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
            PowerPointを
            <span className="text-primary">瞬時に翻訳</span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            AI技術を活用して、PowerPointプレゼンテーションを
            高品質かつ迅速に多言語へ翻訳します。
            レイアウトはそのまま、内容だけを正確に翻訳。
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link href="/register">
              <Button size="lg" className="gap-2">
                無料で始める
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="outline" size="lg" className="gap-2">
                <Upload className="h-4 w-4" />
                今すぐアップロード
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
```

### 2.3 新規ファイル: `src/components/landing/Features.tsx`

```typescript
import { 
  Globe, 
  Zap, 
  Shield, 
  FileText,
  Clock,
  CheckCircle 
} from 'lucide-react';

const features = [
  {
    name: '高速処理',
    description: '最新のAI技術により、大容量のプレゼンテーションも数分で翻訳完了。',
    icon: Zap,
  },
  {
    name: '多言語対応',
    description: '日本語、英語、中国語、韓国語など、主要な言語に対応。',
    icon: Globe,
  },
  {
    name: 'レイアウト保持',
    description: 'オリジナルのデザインやレイアウトを完璧に保持したまま翻訳。',
    icon: FileText,
  },
  {
    name: 'セキュア',
    description: 'エンタープライズレベルのセキュリティでデータを保護。',
    icon: Shield,
  },
  {
    name: '24時間対応',
    description: 'いつでもどこでも、必要な時にすぐに利用可能。',
    icon: Clock,
  },
  {
    name: '品質保証',
    description: '専門用語も正確に翻訳し、文脈に応じた自然な表現を実現。',
    icon: CheckCircle,
  },
];

export function Features() {
  return (
    <section className="py-24 sm:py-32 bg-muted/50">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            パワフルな機能
          </h2>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            プレゼンテーション翻訳に必要なすべての機能を提供
          </p>
        </div>
        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.name} className="flex flex-col">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-foreground">
                  <feature.icon className="h-5 w-5 flex-none text-primary" aria-hidden="true" />
                  {feature.name}
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-muted-foreground">
                  <p className="flex-auto">{feature.description}</p>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
```

---

## フェーズ3: ルーティング構造修正

### 3.1 現在の`src/app/page.tsx`の移動

#### オプション1: 既存の`/upload`ページを活用（推奨）
**メリット**:
- 既存のアップロードページが機能している
- 認証フローが既に実装済み
- 作業量が最小限

**デメリット**:
- 2つのアップロード実装が存在する可能性

**実装**: 現在の`src/app/page.tsx`を削除し、新しいLPページに置き換え

#### オプション2: 新しい統合アップロードページ作成
**メリット**:
- クリーンな実装
- 最新の要件に合わせた設計

**デメリット**:
- 作業量が多い
- 既存機能の再テストが必要

### 3.2 `src/middleware.ts`の修正

```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // ... 既存のレート制限処理 ...

  const response = NextResponse.next();
  
  // Supabaseクライアント作成
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // パスの定義を更新
  const protectedPaths = [
    '/dashboard',
    '/upload',
    '/files', 
    '/preview',
    '/profile',
    '/admin'
  ];
  
  const authPaths = ['/login', '/register'];
  const publicPaths = ['/', '/pricing', '/about', '/forgot-password'];

  const pathname = request.nextUrl.pathname;
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));
  const isAuthPath = authPaths.some(path => pathname.startsWith(path));
  const isPublicPath = publicPaths.some(path => pathname === path || pathname.startsWith(path));

  // 保護されたパスへの未認証アクセス
  if (isProtectedPath && !user) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // 認証済みユーザーの認証ページへのアクセス
  if (isAuthPath && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

---

## フェーズ4: ダッシュボード統合

### 4.1 `src/components/dashboard/DashboardView.tsx`の修正

#### オプション1: モーダル形式のアップロード（推奨）
**メリット**:
- ページ遷移なしでアップロード可能
- UXがスムーズ
- 既存のファイル一覧と統合しやすい

**デメリット**:
- モーダル実装の追加作業

```typescript
'use client';

import React, { useState } from 'react';
import { UploadModal } from '@/components/upload/UploadModal';
import { Button } from '@/components/ui/button';
import { Upload, Plus } from 'lucide-react';

export default function DashboardView({ userEmail, initialFiles }: DashboardViewProps) {
  const [files, setFiles] = useState(initialFiles);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const handleUploadSuccess = (newFile: FileRecord) => {
    setFiles(prev => [newFile, ...prev]);
    setIsUploadModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ヘッダー */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">ダッシュボード</h1>
            <Button 
              onClick={() => setIsUploadModalOpen(true)}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              新規アップロード
            </Button>
          </div>
        </div>
      </header>

      {/* ファイル一覧 */}
      <main className="container mx-auto p-4">
        {files.length === 0 ? (
          <div className="text-center py-12">
            <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-sm font-semibold text-foreground">
              ファイルがありません
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              新規アップロードボタンからファイルをアップロードしてください。
            </p>
            <Button 
              onClick={() => setIsUploadModalOpen(true)}
              className="mt-4"
            >
              <Plus className="mr-2 h-4 w-4" />
              最初のファイルをアップロード
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {files.map(file => (
              <FileCard key={file.id} file={file} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </main>

      {/* アップロードモーダル */}
      <UploadModal 
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={handleUploadSuccess}
      />
    </div>
  );
}
```

#### オプション2: インラインアップロードエリア
**メリット**:
- モーダルなしでシンプル
- ドラッグ&ドロップが直感的

**デメリット**:
- 画面スペースを常に占有

### 4.2 新規ファイル: `src/components/upload/UploadModal.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UploadForm } from './UploadForm';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (file: any) => void;
}

export function UploadModal({ isOpen, onClose, onSuccess }: UploadModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>ファイルをアップロード</DialogTitle>
        </DialogHeader>
        <UploadForm 
          onSuccess={onSuccess}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}
```

---

## フェーズ5: 認証フロー改善

### 5.1 `src/lib/auth/hooks.ts`の修正

```typescript
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

export function useAuth(requireAuth = true) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
        
        if (requireAuth && !user) {
          router.push('/login');
        }
      } catch (error) {
        console.error('Auth error:', error);
        if (requireAuth) {
          router.push('/login');
        }
      } finally {
        setLoading(false);
      }
    };

    checkUser();

    // リアルタイム認証状態監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      
      if (event === 'SIGNED_OUT' && requireAuth) {
        router.push('/');
      } else if (event === 'SIGNED_IN' && !requireAuth) {
        router.push('/dashboard');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [requireAuth, router, supabase]);

  return { user, loading };
}
```

### 5.2 `src/app/login/page.tsx`の修正

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginAction } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await loginAction({ email, password });
    
    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.push(callbackUrl);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 px-4">
        <div className="text-center">
          <h2 className="text-3xl font-bold">ログイン</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            アカウントをお持ちでない方は
            <Link href="/register" className="text-primary hover:underline ml-1">
              新規登録
            </Link>
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="email">メールアドレス</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="example@email.com"
            />
          </div>
          
          <div>
            <Label htmlFor="password">パスワード</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="text-sm text-destructive">
              {error}
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full"
            disabled={loading}
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </Button>

          <div className="text-center text-sm">
            <Link href="/forgot-password" className="text-muted-foreground hover:text-primary">
              パスワードをお忘れの方
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
```

---

## 実装順序と推奨事項

### 推奨実装順序

1. **フェーズ1**: CSS/Tailwind修正（30分）
   - オプション1（shadcn/ui互換）を推奨
   - 即座に視覚的な改善が得られる

2. **フェーズ2**: LPページ作成（1-2時間）
   - 基本的なコンポーネントから実装
   - デザインは後から調整可能

3. **フェーズ3**: ルーティング修正（30分）
   - オプション1（既存upload活用）を推奨
   - 最小限の変更で最大の効果

4. **フェーズ4**: ダッシュボード統合（2-3時間）
   - オプション1（モーダル形式）を推奨
   - UXが優れている

5. **フェーズ5**: 認証フロー改善（1時間）
   - 必要に応じて実装

### テスト項目

各フェーズ完了後に以下をテスト：

1. **CSS/Tailwind**
   - ダーク/ライトモード切り替え
   - レスポンシブデザイン
   - コンポーネントスタイリング

2. **LPページ**
   - 全セクションの表示
   - リンクの動作
   - レスポンシブ対応

3. **ルーティング**
   - 認証済み/未認証でのアクセス
   - リダイレクト動作
   - 404ページ

4. **ダッシュボード**
   - アップロード機能
   - ファイル一覧表示
   - 削除/翻訳機能

5. **認証**
   - ログイン/ログアウト
   - セッション維持
   - エラーハンドリング