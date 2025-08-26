'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { loginAction } from '@/app/actions/auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

function SubmitButton() {
  const { pending } = useFormStatus();
  
  return (
    <button
      type="submit"
      disabled={pending}
      className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? 'ログイン中...' : 'ログイン'}
    </button>
  );
}

// Wrapper for useActionState compatibility
async function loginWrapper(
  prevState: { success: boolean; message: string } | null,
  formData: FormData
): Promise<{ success: boolean; message: string }> {
  return loginAction(formData);
}

export default function LoginForm() {
  const [state, formAction] = useActionState(loginWrapper, null);
  const router = useRouter();
  
  useEffect(() => {
    if (state?.success) {
      router.push('/dashboard');
    }
  }, [state, router]);
  
  return (
    <form action={formAction} className="mt-8 space-y-6">
      {state && !state.success && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
          <p className="text-sm text-red-800 dark:text-red-400">
            {state.message}
          </p>
        </div>
      )}
      
      <div className="rounded-md shadow-sm -space-y-px">
        <div>
          <label htmlFor="email" className="sr-only">
            メールアドレス
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-gray-100 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm bg-white dark:bg-gray-800"
            placeholder="メールアドレス"
          />
        </div>
        <div>
          <label htmlFor="password" className="sr-only">
            パスワード
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-gray-100 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm bg-white dark:bg-gray-800"
            placeholder="パスワード"
          />
        </div>
      </div>

      <div>
        <SubmitButton />
      </div>
    </form>
  );
}
