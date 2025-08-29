'use client';

// @ts-ignore - React 19 exports
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AuthState } from '@/app/actions/auth';

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

interface LoginFormProps {
  action: (prevState: AuthState | null, formData: FormData) => Promise<AuthState>;
}

export default function LoginForm({ action }: LoginFormProps) {
  const [state, formAction] = useActionState(action, null);
  const router = useRouter();
  
  useEffect(() => {
    if (state?.success) {
      router.push('/dashboard');
    }
  }, [state?.success, router]);
  
  return (
    <form action={formAction} className="space-y-4">
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
        />
      </div>
      
      {state?.error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
          {state.error}
        </div>
      )}
      
      <SubmitButton />
    </form>
  );
}