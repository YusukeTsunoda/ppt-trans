import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-gray-100">
            パスワードリセット
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            登録されているメールアドレスを入力してください
          </p>
        </div>
        
        <ForgotPasswordForm />
        
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
          <div>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              パスワードを覚えている方は
            </span>
            {' '}
            <Link href="/login" className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
              ログイン
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
