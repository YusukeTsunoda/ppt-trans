'use client';

import { useState, Suspense, FormEvent } from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useSearchParams, useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const registered = searchParams.get('registered') === 'true';
  const reset = searchParams.get('reset') === 'true';
  const callbackUrl = searchParams.get('callbackUrl') || '/files';
  
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setSuccess(false);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    console.log('Login attempt:', { email, callbackUrl });

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl,
      });

      console.log('SignIn result:', result);

      if (result?.error) {
        console.error('SignIn error:', result.error);
        setError(result.error);
        setLoading(false);
      } else if (result?.ok) {
        console.log('SignIn success, redirecting to:', callbackUrl);
        setSuccess(true);
        // リダイレクト
        setTimeout(() => {
          router.push(callbackUrl);
          router.refresh();
        }, 1000);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('ログイン処理中にエラーが発生しました');
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary-50 dark:bg-slate-900">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="max-w-md w-full space-y-8 p-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-foreground">
            ログイン
          </h2>
          <p className="mt-2 text-center text-sm text-secondary-600 dark:text-secondary-400">
            アカウントをお持ちでない方は{' '}
            <Link href="/register" className="font-medium text-primary hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300">
              新規登録
            </Link>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {/* 登録完了メッセージ */}
          {registered && (
            <div className="rounded-md bg-accent-50 dark:bg-accent-900/20 p-4">
              <p className="text-sm text-accent-800 dark:text-accent-400">
                アカウントが作成されました。ログインしてください。
              </p>
            </div>
          )}

          {/* パスワードリセット完了メッセージ */}
          {reset && (
            <div className="rounded-md bg-accent-50 dark:bg-accent-900/20 p-4">
              <p className="text-sm text-accent-800 dark:text-accent-400">
                パスワードがリセットされました。新しいパスワードでログインしてください。
              </p>
            </div>
          )}

          {/* 成功メッセージ */}
          {success && (
            <div className="rounded-md bg-accent-50 dark:bg-accent-900/20 p-4">
              <p className="text-sm text-accent-800 dark:text-accent-400">
                ログインしました。リダイレクト中...
              </p>
            </div>
          )}

          {/* エラーメッセージ */}
          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
              <p className="text-sm text-red-800 dark:text-red-400">
                {error}
              </p>
            </div>
          )}

          <div className="space-y-4">
            {/* メールアドレス */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-secondary-700 dark:text-secondary-300">
                メールアドレス
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                disabled={loading}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 placeholder-secondary-500 dark:placeholder-secondary-400 text-foreground rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm bg-background disabled:opacity-50"
                placeholder="your@email.com"
              />
            </div>

            {/* パスワード */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-secondary-700 dark:text-secondary-300">
                パスワード
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={loading}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 placeholder-secondary-500 dark:placeholder-secondary-400 text-foreground rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm bg-background disabled:opacity-50"
                placeholder="••••••••"
              />
            </div>
          </div>

          {/* Remember Me & パスワード忘れ */}
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="rememberMe"
                name="rememberMe"
                type="checkbox"
                disabled={loading}
                className="h-4 w-4 text-primary focus:ring-primary border-secondary-300 rounded disabled:opacity-50"
              />
              <label htmlFor="rememberMe" className="ml-2 block text-sm text-secondary-900 dark:text-secondary-300">
                ログイン状態を保持
              </label>
            </div>

            <div className="text-sm">
              <Link href="/forgot-password" className="font-medium text-primary hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300">
                パスワードを忘れた方
              </Link>
            </div>
          </div>

          {/* 送信ボタン */}
          <div>
            {loading ? (
              <button
                type="button"
                disabled
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-secondary-400 cursor-not-allowed"
              >
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                ログイン中...
              </button>
            ) : (
              <button
                type="submit"
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
              >
                ログイン
              </button>
            )}
          </div>

          {/* 区切り線 */}
          <div className="relative mt-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-secondary-300 dark:border-secondary-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-background text-secondary-500">または</span>
            </div>
          </div>

          {/* ソーシャルログイン */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => signIn('google', { callbackUrl })}
              disabled={loading}
              className="w-full inline-flex justify-center py-2 px-4 border border-secondary-300 dark:border-secondary-600 rounded-md shadow-sm bg-white dark:bg-secondary-800 text-sm font-medium text-secondary-500 dark:text-secondary-300 hover:bg-secondary-50 dark:hover:bg-secondary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span className="ml-2">Google</span>
            </button>

            <button
              type="button"
              onClick={() => signIn('github', { callbackUrl })}
              disabled={loading}
              className="w-full inline-flex justify-center py-2 px-4 border border-secondary-300 dark:border-secondary-600 rounded-md shadow-sm bg-white dark:bg-secondary-800 text-sm font-medium text-secondary-500 dark:text-secondary-300 hover:bg-secondary-50 dark:hover:bg-secondary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clipRule="evenodd" />
              </svg>
              <span className="ml-2">GitHub</span>
            </button>
          </div>

          {/* 新規登録リンク */}
          <div className="text-center">
            <span className="text-sm text-secondary-600 dark:text-secondary-400">
              アカウントをお持ちでない方は
            </span>
            {' '}
            <Link href="/register" className="text-sm font-medium text-primary hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300">
              こちらから新規登録
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-secondary-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-secondary-600 dark:text-secondary-400">読み込み中...</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}