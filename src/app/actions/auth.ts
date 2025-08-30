'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import logger from '@/lib/logger';

const loginSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string().min(6, 'パスワードは6文字以上である必要があります'),
});

export async function loginAction(formData: FormData) {
  try {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const validated = loginSchema.parse({ email, password });

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: validated.email,
      password: validated.password,
    });

    if (error) {
      logger.error('Login failed:', { error: error.message });
      return { 
        success: false, 
        error: error.message === 'Invalid login credentials' 
          ? 'メールアドレスまたはパスワードが正しくありません' 
          : 'ログインに失敗しました' 
      };
    }

    logger.info('User logged in successfully', { userId: data.user?.id });
    redirect('/dashboard');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message };
    }
    logger.error('Unexpected login error:', error);
    return { success: false, error: 'ログイン中にエラーが発生しました' };
  }
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}