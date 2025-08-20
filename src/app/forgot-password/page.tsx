import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm';
import Link from 'next/link';
import { KeyRound, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-sky-50 flex items-center justify-center animate-fadeIn p-4">
      <div className="w-full max-w-md">
        <Link href="/login" className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">ログインに戻る</span>
        </Link>
        
        <div className="bg-white rounded-3xl shadow-xl p-10">
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-sky-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <KeyRound className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">パスワードリセット</h1>
            <p className="text-slate-600 mt-3 text-sm leading-relaxed">
              登録されたメールアドレスにパスワードリセット用のリンクを送信します
            </p>
          </div>
          
          <ForgotPasswordForm />
          
          <div className="mt-8 pt-8 border-t border-slate-100">
            <div className="text-center space-y-3">
              <div>
                <span className="text-slate-600 text-sm">思い出しましたか？ </span>
                <Link href="/login" className="text-blue-600 hover:text-blue-700 font-semibold text-sm transition-colors">
                  ログインページへ
                </Link>
              </div>
              <div>
                <span className="text-slate-600 text-sm">アカウントをお持ちでない場合は </span>
                <Link href="/register" className="text-blue-600 hover:text-blue-700 font-semibold text-sm transition-colors">
                  新規登録
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}