import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// 入力検証スキーマ
const loginSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string().min(6, 'パスワードは6文字以上である必要があります'),
});

export async function POST(request: NextRequest) {
  try {
    // 1. リクエストボディの取得
    const body = await request.json();
    
    // 2. 入力検証
    const validatedData = loginSchema.parse(body);
    
    // 3. Supabase認証
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: validatedData.email,
      password: validatedData.password,
    });
    
    // 4. エラーハンドリング
    if (error) {
      // 認証失敗の詳細なログ（本番環境では制限する）
      console.error('Authentication failed:', error.message);
      
      return NextResponse.json(
        { 
          success: false, 
          error: error.message === 'Invalid login credentials' 
            ? 'メールアドレスまたはパスワードが正しくありません'
            : 'ログインに失敗しました',
          code: 'AUTH_FAILED' 
        },
        { status: 401 }
      );
    }
    
    // 5. セッション確認
    const { data: session } = await supabase.auth.getSession();
    
    if (!session.session) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'セッションの作成に失敗しました',
          code: 'SESSION_ERROR' 
        },
        { status: 500 }
      );
    }
    
    // 6. 成功レスポンス
    return NextResponse.json({
      success: true,
      user: {
        id: data.user?.id,
        email: data.user?.email,
        // セキュリティ上、最小限の情報のみ返す
      },
      redirectTo: '/dashboard',
      message: 'ログインに成功しました'
    });
    
  } catch (error) {
    // 7. バリデーションエラーまたは予期しないエラー
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: error.errors[0].message,
          code: 'VALIDATION_ERROR',
          details: error.errors 
        },
        { status: 400 }
      );
    }
    
    console.error('Unexpected login error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'ログイン処理中にエラーが発生しました',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}