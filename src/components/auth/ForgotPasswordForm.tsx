'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { forgotPasswordAction } from '@/app/actions/auth';
import Link from 'next/link';

function SubmitButton() {
  const { pending } = useFormStatus();
  
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
          送信中...
        </>
      ) : (
        'リセットリンクを送信'
      )}
    </button>
  );
}

export default function ForgotPasswordForm() {
  const [state, formAction] = useActionState(forgotPasswordAction, null);
  
  if (state?.success) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="mt-4 text-lg font-semibold text-gray-900">メールを送信しました</h3>
          <p className="mt-2 text-sm text-gray-600">
            {state.message}
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <form action={formAction} className="space-y-4">
      {state && !state.success && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
          <p className="text-sm text-red-800 dark:text-red-400">
            {state.message}
          </p>
        </div>
      )}

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
          className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm bg-white dark:bg-gray-800"
          placeholder="your@email.com"
        />
      </div>

      <div>
        <SubmitButton />
      </div>

      <div className="text-center space-y-2">
        <div>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            アカウントをお持ちでない方は
          </span>
          {' '}
          <Link href="/register" className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
            新規登録
          </Link>
        </div>
      </div>
    </form>
  );
}