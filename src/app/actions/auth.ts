'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { 
  ActionResult, 
  createErrorResponse, 
  createSuccessResponse, 
  createValidationError 
} from './types';

export type AuthState = ActionResult;

// ログインアクション
export async function loginAction(
  prevState: AuthState | null,
  formData: FormData
): Promise<AuthState> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  // バリデーション
  if (!email || !password) {
    return createValidationError('メールアドレスとパスワードを入力してください');
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return createErrorResponse(error, 'ログインに失敗しました。もう一度お試しください。');
  }

  revalidatePath('/dashboard');
  return createSuccessResponse('ログインに成功しました');
}

// サインアップアクション
export async function signupAction(
  prevState: AuthState | null,
  formData: FormData
): Promise<AuthState> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const confirmPassword = formData.get('confirmPassword') as string;

  // バリデーション
  if (!email || !password || !confirmPassword) {
    return createValidationError('全ての項目を入力してください');
  }

  if (password !== confirmPassword) {
    return createValidationError('パスワードが一致しません');
  }

  if (password.length < 6) {
    return createValidationError('パスワードは6文字以上で入力してください');
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });

  if (error) {
    return createErrorResponse(error, 'アカウント作成に失敗しました。もう一度お試しください。');
  }

  // メール確認が必要かどうかを判定
  // session が存在する場合は、メール確認不要で直接ログインできる
  if (data?.session) {
    revalidatePath('/dashboard');
    return createSuccessResponse('アカウントを作成しました。');
  }

  // メール確認が必要な場合
  return createSuccessResponse('確認メールを送信しました。メールボックスをご確認ください。');
}

// パスワードリセットアクション
export async function forgotPasswordAction(
  prevState: AuthState | null,
  formData: FormData
): Promise<AuthState> {
  const email = formData.get('email') as string;

  if (!email) {
    return createValidationError('メールアドレスを入力してください');
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
  });

  if (error) {
    return createErrorResponse(error, 'パスワードリセットメールの送信に失敗しました');
  }

  return createSuccessResponse('パスワードリセットメールを送信しました。メールボックスをご確認ください。');
}

// ログアウトアクション
export async function logoutAction(): Promise<AuthState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    return createErrorResponse(error, 'ログアウトに失敗しました');
  }
  
  revalidatePath('/');
  revalidatePath('/dashboard');
  return createSuccessResponse('ログアウトしました');
}

