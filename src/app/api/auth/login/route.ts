import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string().min(6, 'パスワードは6文字以上で入力してください'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // バリデーション
    const validatedFields = loginSchema.safeParse(body);
    
    if (!validatedFields.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: validatedFields.error.errors[0].message 
        },
        { status: 400 }
      );
    }
    
    const { email, password } = validatedFields.data;
    
    // Supabaseでログイン
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      return NextResponse.json(
        { 
          success: false, 
          error: error.message === 'Invalid login credentials' 
            ? 'メールアドレスまたはパスワードが正しくありません' 
            : error.message 
        },
        { status: 401 }
      );
    }
    
    if (!data.user) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'ログインに失敗しました' 
        },
        { status: 401 }
      );
    }
    
    // 成功レスポンス
    return NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
      redirectTo: '/dashboard'
    });
    
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'サーバーエラーが発生しました' 
      },
      { status: 500 }
    );
  }
}