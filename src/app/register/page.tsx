'use client';

import { registerAction } from '@/server-actions/auth/register';
import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';

function SubmitButton() {
  const { pending } = useFormStatus();
  
  return (
    <button
      type="submit"
      disabled={pending}
      className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? '登録中...' : '新規登録'}
    </button>
  );
}

export default function RegisterPage() {
  const [state, formAction] = useActionState(registerAction, null);
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="max-w-md w-full space-y-8 p-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-foreground">
            新規アカウント作成
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            既にアカウントをお持ちの方は{' '}
            <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
              ログイン
            </Link>
          </p>
        </div>

        <form action={formAction} className="mt-8 space-y-6">
          {/* エラーメッセージ */}
          {state?.error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
              <p className="text-sm text-red-800 dark:text-red-400">{state.error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                メールアドレス
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${
                  state?.fieldErrors?.email ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                } placeholder-gray-500 dark:placeholder-gray-400 text-foreground rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm bg-background`}
                placeholder="your@email.com"
              />
              {state?.fieldErrors?.email && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{state.fieldErrors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                ユーザー名
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${
                  state?.fieldErrors?.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                } placeholder-gray-500 dark:placeholder-gray-400 text-foreground rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm bg-background`}
                placeholder="ユーザー名"
              />
              {state?.fieldErrors?.name && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{state.fieldErrors.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                パスワード
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${
                  state?.fieldErrors?.password ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                } placeholder-gray-500 dark:placeholder-gray-400 text-foreground rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm bg-background`}
                placeholder="8文字以上"
              />
              {state?.fieldErrors?.password && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{state.fieldErrors.password}</p>
              )}
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                大文字、小文字、数字、特殊文字を含む8文字以上
              </p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                パスワード（確認）
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${
                  state?.fieldErrors?.confirmPassword ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                } placeholder-gray-500 dark:placeholder-gray-400 text-foreground rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm bg-background`}
                placeholder="パスワードを再入力"
              />
              {state?.fieldErrors?.confirmPassword && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{state.fieldErrors.confirmPassword}</p>
              )}
            </div>
          </div>

          <div className="flex items-center">
            <input
              id="terms"
              name="terms"
              type="checkbox"
              required
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="terms" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
              <Link href="/terms" className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
                利用規約
              </Link>
              と
              <Link href="/privacy" className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
                プライバシーポリシー
              </Link>
              に同意します
            </label>
          </div>
          {state?.fieldErrors?.terms && (
            <p className="text-sm text-red-600 dark:text-red-400">{state.fieldErrors.terms}</p>
          )}

          <div>
            <SubmitButton />
          </div>
        </form>
      </div>
    </div>
  );
}