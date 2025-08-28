import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { SessionManager } from '@/lib/security/session-manager';
import { rateLimiter, rateLimitConfigs } from '@/lib/security/advanced-rate-limiter';
import { loginSchema } from '@/lib/security/validators';
import { 
  performSecurityChecks, 
  createErrorResponse, 
  createSuccessResponse 
} from '@/lib/security/api-security';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  // 統合セキュリティチェック
  const securityCheck = await performSecurityChecks(request, {
    csrf: true,
    origin: true,
    rateLimit: rateLimitConfigs.login,
    contentType: 'application/json',
    methods: ['POST'],
  });
  
  if (!securityCheck.success) {
    return createErrorResponse(
      securityCheck.error!,
      securityCheck.status!,
      securityCheck.headers,
      securityCheck.requestId
    );
  }
  
  const requestId = securityCheck.requestId;
  const rateLimitResult = securityCheck.rateLimitResult;
  
  try {
    // リクエストボディの取得と検証
    const body = await request.json();

    // 入力検証（Zod）
    const validatedData = loginSchema.parse(body);

    // 監査ログ（ログイン試行）
    logger.info('Login attempt', {
      requestId,
      email: validatedData.email,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      userAgent: request.headers.get('user-agent'),
    });

    // Supabase認証
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: validatedData.email,
      password: validatedData.password,
    });

    // 認証失敗処理
    if (error) {
      logger.warn('Login failed', {
        requestId,
        email: validatedData.email,
        error: error.message,
      });

      // タイミング攻撃対策：一定時間待機
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
      
      return createErrorResponse(
        'メールアドレスまたはパスワードが正しくありません',
        401,
        rateLimitResult ? { 'X-RateLimit-Remaining': String(rateLimitResult.remaining) } : undefined,
        requestId
      );
    }

    // セッション作成（カスタムセッション管理）
    await SessionManager.createSession({
      userId: data.user!.id,
      email: data.user!.email!,
      role: (data.user?.user_metadata?.role || 'USER') as 'USER' | 'ADMIN',
    });

    // レート制限の成功記録（成功したログインはカウントしない）
    if (rateLimitResult) {
      await rateLimiter.recordSuccess(request, rateLimitConfigs.login);
    }

    // 成功監査ログ
    logger.info('Login successful', {
      requestId,
      userId: data.user!.id,
      email: data.user!.email,
      responseTime: Date.now() - startTime,
    });

    // 成功レスポンスを返す
    return createSuccessResponse({
      success: true,
      user: {
        id: data.user!.id,
        email: data.user!.email,
      },
      redirectTo: '/dashboard',
      message: 'ログインに成功しました',
    }, 200, requestId);

  } catch (error) {
    // エラーロギング
    logger.error('Login error', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Zodバリデーションエラー
    if (error instanceof z.ZodError) {
      return createErrorResponse(
        'バリデーションエラー',
        400,
        undefined,
        requestId
      );
    }

    // 内部エラーの詳細は隠蔽
    return createErrorResponse(
      'サーバーエラーが発生しました',
      500,
      undefined,
      requestId
    );
  }
}