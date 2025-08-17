import SignupForm from '@/components/auth/SignupForm';
import Link from 'next/link';

export default function RegisterPage() {
  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center animate-fadeIn">
      <div className="max-w-md w-full">
        <div className="card">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-900">PowerPoint Translator</h1>
            <p className="text-slate-600 mt-2">新規アカウント作成</p>
          </div>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            既にアカウントをお持ちの方は{' '}
            <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400">
              ログイン
            </Link>
          </p>
        </div>

        <SignupForm />
      </div>
    </div>
  );
}