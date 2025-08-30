import SignupForm from '@/components/auth/SignupForm';
import Link from 'next/link';

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-gray-100">
            新規登録
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            新しいアカウントを作成します
          </p>
        </div>
        
        <SignupForm />
        
        <div className="text-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            既にアカウントをお持ちの方は
          </span>
          {' '}
          <Link href="/login" className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
            ログイン
          </Link>
        </div>
      </div>
    </div>
  );
}
