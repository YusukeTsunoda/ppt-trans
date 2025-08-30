import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { CSRFProtection } from '@/lib/security/csrf';
import { OriginValidator } from '@/lib/security/origin-validator';
import { rateLimiter, rateLimitConfigs } from '@/lib/security/advanced-rate-limiter';
import { forgotPasswordSchema } from '@/lib/security/validators';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  
  try {
    // 1. レート制限チェック（パスワードリセットは厳格に）
    const rateLimitResult = await rateLimiter.check(
      request, 
      rateLimitConfigs.forgotPassword
    );
    
    if (!rateLimitResult.allowed) {
      logger.warn('Password reset rate limit exceeded', { 
        requestId,
        ip: request.headers.get('x-forwarded-for'),
      });
      
      return NextResponse.json(
        { 
          error: 'パスワードリセットの試行回数が多すぎます。1時間後に再試行してください。',
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
      logger.error('Invalid origin for password reset', { 
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
      logger.error('CSRF validation failed for password reset', { requestId });
      
      return NextResponse.json(
        { error: 'セキュリティトークンが無効です' },
        { status: 403 }
      );
    }

    // 4. リクエストボディの取得と検証
    const body = await request.json();
    
    // 5. 入力検証（Zod）
    const validatedData = forgotPasswordSchema.parse(body);

    // 6. 監査ログ（パスワードリセット試行）
    logger.info('Password reset attempt', {
      requestId,
      email: validatedData.email,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
    });

    // 7. Supabase でパスワードリセット
    const supabase = await createClient();
    
    // リセットリンクを送信
    const { data, error } = await supabase.auth.resetPasswordForEmail(
      validatedData.email,
      {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password`,
      }
    );

    // 8. エラーハンドリング
    // 注意: セキュリティのため、メールアドレスの存在有無に関わらず
    // 同じレスポンスを返す
    if (error) {
      logger.error('Password reset error', {
        requestId,
        email: validatedData.email,
        error: error.message,
      });
      
      // エラーがあっても成功レスポンスを返す（情報漏洩防止）
    }

    // 9. タイミング攻撃対策
    // ランダムな遅延を追加して処理時間を一定にする
    await new Promise(resolve => 
      setTimeout(resolve, 1000 + Math.random() * 1000)
    );

    // 10. 成功ログ（実際の送信可否に関わらず）
    logger.info('Password reset email processed', {
      requestId,
      email: validatedData.email,
      sent: !error,
    });

    // 11. 成功レスポンス（常に同じレスポンス）
    const response = NextResponse.json({
      success: true,
      message: 'パスワードリセットの手順をメールで送信しました。メールをご確認ください。',
      // セキュリティのため、メールアドレスの存在有無は返さない
    });

    // セキュリティヘッダー
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('X-Request-Id', requestId);

    return response;

  } catch (error) {
    logger.error('Password reset processing error', {
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