'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginAction } from '@/app/actions/auth';

interface LoginFormState {
  isLoading: boolean;
  error: string | null;
}

export default function LoginFormStable() {
  const router = useRouter();
  const [state, setState] = useState<LoginFormState>({
    isLoading: false,
    error: null,
  });

  const handleSubmit = async (formData: FormData) => {
    // 1. ローディング状態を設定
    setState({ isLoading: true, error: null });
    
    try {
      // 2. サーバーアクションを呼び出し
      const result = await loginAction(formData);
      
      // 3. レスポンス処理
      if (result.success) {
        // 成功時はダッシュボードへリダイレクト
        router.push('/dashboard');
        router.refresh(); // App Routerのキャッシュをリフレッシュ
        
        // リダイレクト中もローディング表示を維持
        setState({ isLoading: true, error: null });
      } else {
        // エラー時
        setState({
          isLoading: false,
          error: result.error || 'ログインに失敗しました',
        });
      }
      
    } catch (error) {
      // 4. エラーハンドリング
      console.error('Login error:', error);
      setState({
        isLoading: false,
        error: 'サーバーエラーが発生しました',
      });
    }
  };

  return (
    <form action={handleSubmit} className="mt-8 space-y-6" noValidate>
      {/* エラー表示 */}
      {state.error && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4" role="alert">
          <p className="text-sm text-red-800 dark:text-red-400">
            {state.error}
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
            disabled={state.isLoading}
            className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-gray-100 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm bg-white dark:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="メールアドレス"
            aria-label="メールアドレス"
            aria-required="true"
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
            disabled={state.isLoading}
            minLength={6}
            className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-gray-100 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm bg-white dark:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="パスワード"
            aria-label="パスワード"
            aria-required="true"
          />
        </div>
      </div>

      <div>
        <button
          type="submit"
          disabled={state.isLoading}
          className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-busy={state.isLoading}
        >
          {state.isLoading ? (
            <>
              <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </span>
              ログイン中...
            </>
          ) : (
            'ログイン'
          )}
        </button>
      </div>
    </form>
  );
}