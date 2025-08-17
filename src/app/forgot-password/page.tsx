import { forgotPasswordAction } from '@/app/actions/auth';
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center animate-fadeIn">
      <div className="max-w-md w-full">
        <div className="card">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-900">パスワードリセット</h1>
            <p className="text-slate-600 mt-2">登録されたメールアドレスにリセット用のリンクを送信します</p>
          </div>
          
          <ForgotPasswordForm action={forgotPasswordAction} />
          
          <div className="mt-4 text-center">
            <Link href="/login" className="text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors">
              ログインページに戻る
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}