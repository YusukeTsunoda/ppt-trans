import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { CSRFProtection } from '@/lib/security/csrf';
import { OriginValidator } from '@/lib/security/origin-validator';
import { rateLimiter, rateLimitConfigs } from '@/lib/security/advanced-rate-limiter';
import { signupSchema } from '@/lib/security/validators';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  
  try {
    // 1. レート制限チェック
    const rateLimitResult = await rateLimiter.check(
      request, 
      rateLimitConfigs.signup
    );
    
    if (!rateLimitResult.allowed) {
      logger.warn('Signup rate limit exceeded', { 
        requestId,
        ip: request.headers.get('x-forwarded-for'),
      });
      
      return NextResponse.json(
        { 
          error: 'アカウント作成の試行回数が多すぎます。しばらくお待ちください。',
          retryAfter: rateLimitResult.retryAfter,
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(rateLimitResult.retryAfter || 3600),
          }
        }
      );
    }

    // 2. Origin/Referer検証
    if (!OriginValidator.validate(request)) {
      logger.error('Invalid origin for signup', { 
        requestId,
        origin: request.headers.get('origin'),
      });
      
      return NextResponse.json(
        { error: '不正なリクエストです' },
        { status: 403 }
      );
    }

    // 3. CSRF検証
    if (!await CSRFProtection.verifyToken(request)) {
      logger.error('CSRF validation failed for signup', { requestId });
      
      return NextResponse.json(
        { error: 'セキュリティトークンが無効です' },
        { status: 403 }
      );
    }

    // 4. リクエストボディの取得と検証
    const body = await request.json();
    
    // 5. 入力検証（Zod）
    const validatedData = signupSchema.parse(body);

    // 6. 監査ログ（サインアップ試行）
    logger.info('Signup attempt', {
      requestId,
      email: validatedData.email,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
    });

    // 7. Supabase でユーザー作成
    const supabase = await createClient();
    
    // 既存ユーザーのチェック
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('email')
      .eq('email', validatedData.email)
      .single();
    
    if (existingUser) {
      // タイミング攻撃対策
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
      
      return NextResponse.json(
        { error: 'このメールアドレスは既に登録されています' },
        { status: 400 }
      );
    }

    // ユーザー作成
    const { data, error } = await supabase.auth.signUp({
      email: validatedData.email,
      password: validatedData.password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
        data: {
          acceptedTerms: validatedData.acceptTerms,
          signupDate: new Date().toISOString(),
        },
      },
    });

    // 8. エラーハンドリング
    if (error) {
      logger.error('Signup failed', {
        requestId,
        email: validatedData.email,
        error: error.message,
      });

      // エラーメッセージを分かりやすく変換
      let errorMessage = 'アカウントの作成に失敗しました';
      
      if (error.message.includes('already registered')) {
        errorMessage = 'このメールアドレスは既に登録されています';
      } else if (error.message.includes('password')) {
        errorMessage = 'パスワードが要件を満たしていません';
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      );
    }

    // 9. 成功ログ
    logger.info('Signup successful', {
      requestId,
      userId: data.user?.id,
      email: validatedData.email,
    });

    // 10. 成功レスポンス
    const response = NextResponse.json({
      success: true,
      message: '確認メールを送信しました。メールを確認してアカウントを有効化してください。',
      requiresEmailConfirmation: true,
      user: {
        id: data.user?.id,
        email: data.user?.email,
      },
    });

    // セキュリティヘッダー
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('X-Request-Id', requestId);

    return response;

  } catch (error) {
    logger.error('Signup error', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Zodバリデーションエラー
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0];
      return NextResponse.json(
        { 
          error: firstError.message,
          field: firstError.path.join('.'),
        },
        { status: 400 }
      );
    }

    // 内部エラー
    return NextResponse.json(
      { 
        error: 'サーバーエラーが発生しました',
        requestId,
      },
      { status: 500 }
    );
  }
}