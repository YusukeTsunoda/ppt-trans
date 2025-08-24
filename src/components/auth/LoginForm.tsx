'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import { loginAction, loginActionWithoutRedirect } from '@/app/actions/auth';
import type { AuthState } from '@/app/actions/auth';
import { useTranslation } from '@/hooks/useTranslation';

function SubmitButton({ isLoading }: { isLoading?: boolean }) {
  const { pending } = useFormStatus();
  const { t } = useTranslation();
  const showLoading = pending || isLoading;
  
  return (
    <button
      type="submit"
      disabled={showLoading}
      className="btn-primary w-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {showLoading ? (
        <>
          <svg className="loading-spinner mr-2" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
          {t('loggingIn')}
        </>
      ) : (
        t('login')
      )}
    </button>
  );
}

export default function LoginForm() {
  const [isClientReady, setIsClientReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const { t } = useTranslation();
  
  // useActionStateを使用してServer Actionのエラーを処理
  const [state, formAction] = useActionState(loginAction, null);

  useEffect(() => {
    setIsClientReady(true);
  }, []);
  
  // 成功時のリダイレクト処理
  useEffect(() => {
    if (state?.success) {
      router.push(callbackUrl);
    }
  }, [state, router, callbackUrl]);

  const enhancedAction = async (formData: FormData): Promise<void> => {
    setClientError(null);
    
    // クライアント未準備の場合はServer Actionを使用（Progressive Enhancement）
    if (!isClientReady) {
      await formAction(formData);
      return;
    }

    // Client-side enhancement（E2Eテストでも通常環境でも同じ処理）
    setIsLoading(true);
    try {
      const result = await loginActionWithoutRedirect(formData);
      
      if (result.success) {
        router.push(callbackUrl);
      } else {
        setClientError(result.message || 'ログインに失敗しました');
      }
    } catch (err) {
      const errorMsg = 'ログインに失敗しました。もう一度お試しください。';
      setClientError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };
  
  // エラーメッセージの決定（統一版: messageフィールドを使用）
  const error = state && !state.success ? state.message : clientError;

  return (
    <form action={enhancedAction} className="space-y-4">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded">
          {error}
        </div>
      )}
      
      <div>
        <label className="label">
          {t('email')}
        </label>
        <input
          type="email"
          name="email"
          className="input-field w-full dark:bg-slate-700 dark:border-slate-600 dark:text-white"
          placeholder="your@email.com"
          required
          disabled={isLoading}
        />
      </div>
      
      <div>
        <label className="label">
          {t('password')}
        </label>
        <input
          type="password"
          name="password"
          className="input-field w-full dark:bg-slate-700 dark:border-slate-600 dark:text-white"
          placeholder="••••••••"
          required
          disabled={isLoading}
        />
      </div>
      
      <SubmitButton isLoading={isLoading} />
    </form>
  );
}