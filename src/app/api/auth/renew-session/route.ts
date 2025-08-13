import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import prisma from '@/lib/prisma';
import { AppError } from '@/lib/errors/AppError';
import { ErrorCodes } from '@/lib/errors/ErrorCodes';
import logger from '@/lib/logger';

/**
 * セッションを更新するAPIエンドポイント
 * このエンドポイントはクライアント側のセッション管理に必要なため維持します
 */
export async function POST(_request: Request) {
  try {
    // 現在のセッションを取得
    const authResult = await requireAuth();

    // requireAuthがNextResponseを返した場合はエラー
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    if (!authResult) {
      logger.warn('Session renewal attempted without active session');
      return NextResponse.json(
        {
          error: 'No active session',
          code: ErrorCodes.AUTH_SESSION_EXPIRED,
        },
        { status: 401 }
      );
    }

    // ユーザーの存在確認
    const user = await prisma.user.findUnique({
      where: { id: authResult.id },
      select: {
        id: true,
        email: true,
        isActive: true,
      }
    });

    if (!user) {
      logger.error('User not found during session renewal', { userId: authResult.id });
      return NextResponse.json(
        {
          error: 'User not found',
          code: ErrorCodes.AUTH_USER_NOT_FOUND,
        },
        { status: 404 }
      );
    }

    // アカウントがアクティブか確認
    if (!user.isActive) {
      logger.warn('Inactive account attempted session renewal', { userId: user.id });
      return NextResponse.json(
        {
          error: 'Account is locked',
          code: ErrorCodes.AUTH_ACCOUNT_LOCKED,
        },
        { status: 403 }
      );
    }

    // セッションの有効期限を延長
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24時間後
    
    // 既存のセッションを探して更新
    const existingSession = await prisma.session.findFirst({
      where: {
        userId: user.id,
        expires: {
          gt: new Date() // まだ有効なセッション
        }
      },
      orderBy: {
        expires: 'desc' // 最も新しいセッションを取得
      }
    });

    if (!existingSession) {
      logger.warn('No valid session found to renew', { userId: user.id });
      
      // セッションが見つからない場合は新規作成
      const newSession = await prisma.session.create({
        data: {
          sessionToken: `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          userId: user.id,
          expires,
        }
      });

      logger.info('New session created during renewal', {
        userId: user.id,
        sessionId: newSession.id,
        expires: expires.toISOString()
      });

      return NextResponse.json({
        success: true,
        message: 'New session created',
        expires: expires.toISOString()
      });
    }

    // 既存のセッションの有効期限を更新
    const updatedSession = await prisma.session.update({
      where: {
        id: existingSession.id
      },
      data: {
        expires
      }
    });

    // 最終ログイン時刻を更新
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    // 監査ログを記録
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN', // AuditAction列挙型の既存の値を使用
        entityType: 'session',
        entityId: updatedSession.id,
        metadata: {
          action: 'session_renewed',
          sessionToken: updatedSession.sessionToken,
          expires: expires.toISOString()
        }
      }
    });

    logger.info('Session renewed successfully', {
      userId: user.id,
      sessionId: updatedSession.id,
      expires: expires.toISOString()
    });

    return NextResponse.json({
      success: true,
      message: 'Session renewed',
      expires: expires.toISOString()
    });

  } catch (error) {
    logger.error('Failed to renew session', error);

    if (error instanceof AppError) {
      return NextResponse.json(
        {
          error: error.userMessage || 'Session renewal failed',
          code: error.code,
        },
        { status: error.statusCode }
      );
    }

    // 予期しないエラーの場合
    return NextResponse.json(
      {
        error: 'Internal server error during session renewal',
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
      },
      { status: 500 }
    );
  }
}

/**
 * セッションの有効性をチェック
 */
export async function GET(_request: Request) {
  try {
    const authResult = await requireAuth();

    // requireAuthがNextResponseを返した場合はエラー
    if (authResult instanceof NextResponse) {
      return NextResponse.json({
        valid: false,
        message: 'No session found'
      });
    }

    if (!authResult) {
      return NextResponse.json({
        valid: false,
        message: 'No session found'
      });
    }

    // セッションの有効期限をチェック
    const expires = authResult.settings?.createdAt ? new Date(authResult.settings.createdAt) : null;
    const now = new Date();

    if (expires && expires < now) {
      return NextResponse.json({
        valid: false,
        message: 'Session expired',
        expired: true
      });
    }

    // 残り時間を計算
    const timeRemaining = expires ? expires.getTime() - now.getTime() : 0;

    return NextResponse.json({
      valid: true,
      expires: expires?.toISOString(),
      timeRemaining,
      user: {
        id: authResult.id,
        email: authResult.email,
        name: authResult.name
      }
    });

  } catch (error) {
    logger.error('Failed to check session', error);
    
    return NextResponse.json({
      valid: false,
      message: 'Failed to check session'
    });
  }
}