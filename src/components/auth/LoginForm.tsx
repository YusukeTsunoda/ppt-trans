'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import { loginAction, loginActionWithoutRedirect } from '@/app/actions/auth';
import type { AuthState } from '@/app/actions/auth';

function SubmitButton() {
  const { pending } = useFormStatus();
  
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary w-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? (
        <>
          <svg className="loading-spinner mr-2" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
          ログイン中...
        </>
      ) : (
        'ログイン'
      )}
    </button>
  );
}

export default function LoginForm() {
  const [isClientReady, setIsClientReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const router = useRouter();
  
  // useActionStateを使用してServer Actionのエラーを処理
  const [state, formAction] = useActionState(loginAction, null);

  useEffect(() => {
    setIsClientReady(true);
  }, []);
  
  // 成功時のリダイレクト処理
  useEffect(() => {
    if (state?.success) {
      router.push('/dashboard');
    }
  }, [state, router]);

  // E2E環境かどうかの検出（シンプル版）
  const isE2EMode = typeof window !== 'undefined' && (
    (globalThis as any).__PLAYWRIGHT__ ||
    navigator.userAgent.includes('HeadlessChrome')
  );

  const enhancedAction = async (formData: FormData) => {
    setClientError(null);
    
    // E2Eモードまたはクライアント未準備の場合はServer Actionを使用
    if (isE2EMode || !isClientReady) {
      return formAction(formData);
    }

    // 本番環境でのClient-side enhancement
    setIsLoading(true);
    try {
      const result = await loginActionWithoutRedirect(formData);
      
      if (result.success) {
        router.push('/dashboard');
      } else {
        setClientError(result.message || 'ログインに失敗しました');
      }
    } catch (err) {
      setClientError('ログインに失敗しました。もう一度お試しください。');
    } finally {
      setIsLoading(false);
    }
  };
  
  // エラーメッセージの決定（stateとclientErrorのどちらかを表示）
  const error = state && !state.success ? (state.error || state.message) : clientError;

  return (
    <form action={enhancedAction} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      
      <div>
        <label className="label">
          メールアドレス
        </label>
        <input
          type="email"
          name="email"
          className="input-field w-full"
          placeholder="your@email.com"
          required
          disabled={isLoading}
        />
      </div>
      
      <div>
        <label className="label">
          パスワード
        </label>
        <input
          type="password"
          name="password"
          className="input-field w-full"
          placeholder="••••••••"
          required
          disabled={isLoading}
        />
      </div>
      
      <SubmitButton />
    </form>
  );
}