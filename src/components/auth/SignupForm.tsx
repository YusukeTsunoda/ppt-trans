'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { signupAction } from '@/app/actions/auth';
import Link from 'next/link';
import { useTranslation } from '@/hooks/useTranslation';

function SubmitButton() {
  const { pending } = useFormStatus();
  const { t } = useTranslation();
  
  return (
    <button
      type="submit"
      disabled={pending}
      className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? (
        <>
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {t('registering')}
        </>
      ) : (
        t('signUp')
      )}
    </button>
  );
}

export default function SignupForm() {
  const [state, formAction] = useActionState(signupAction, null);
  const router = useRouter();
  const { t } = useTranslation();
  
  useEffect(() => {
    if (state?.success && state?.message?.includes('確認メール')) {
      // メール確認が必要な場合は特に何もしない
    } else if (state?.success) {
      // 直接登録成功の場合はダッシュボードへ
      router.push('/dashboard');
    }
  }, [state?.success, state?.message, router]);
  
  return (
    <form action={formAction} className="mt-8 space-y-6">
      {/* 成功メッセージ */}
      {state?.success && (
        <div className="rounded-md bg-green-50 dark:bg-green-900/20 p-4">
          <p className="text-sm text-green-800 dark:text-green-400">
            {state.message}
          </p>
        </div>
      )}

      {/* エラーメッセージ */}
      {state && !state.success && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
          <p className="text-sm text-red-800 dark:text-red-400">
            {state.message}
          </p>
        </div>
      )}

      <div className="space-y-4">
        {/* メールアドレス */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('email')}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            disabled={state?.success}
            className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm bg-white dark:bg-gray-800 disabled:opacity-50"
            placeholder="your@email.com"
          />
        </div>

        {/* パスワード */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('password')}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            disabled={state?.success}
            minLength={6}
            className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm bg-white dark:bg-gray-800 disabled:opacity-50"
            placeholder="••••••••"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {t('passwordMinLength')}
          </p>
        </div>

        {/* パスワード確認 */}
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('confirmPassword')}
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            disabled={state?.success}
            minLength={6}
            className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm bg-white dark:bg-gray-800 disabled:opacity-50"
            placeholder="••••••••"
          />
        </div>
      </div>

      {/* 送信ボタン */}
      <div>
        <SubmitButton />
      </div>

      {/* ログインリンク */}
      <div className="text-center">
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {t('alreadyHaveAccount')}
        </span>
        {' '}
        <Link href="/login" className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400">
          {t('loginHere')}
        </Link>
      </div>
    </form>
  );
}