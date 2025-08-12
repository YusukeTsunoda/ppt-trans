import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';

/**
 * APIルートの認証を確認するユーティリティ
 */
export async function verifyApiAuth(request: NextRequest) {
  try {
    const token = await getToken({ 
      req: request,
      secret: process.env.NEXTAUTH_SECRET 
    });

    if (!token) {
      logger.warn('Unauthorized API access attempt', {
        path: request.nextUrl.pathname,
        method: request.method,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      });
      
      return {
        isAuthenticated: false,
        error: NextResponse.json(
          { 
            success: false,
            error: 'Authentication required' 
          },
          { status: 401 }
        )
      };
    }

    return {
      isAuthenticated: true,
      user: {
        id: token.sub || token.id as string,
        email: token.email as string,
        name: token.name as string,
        role: token.role as string
      }
    };
  } catch (error) {
    logger.error('API authentication check failed', error);
    return {
      isAuthenticated: false,
      error: NextResponse.json(
        { 
          success: false,
          error: 'Authentication verification failed' 
        },
        { status: 500 }
      )
    };
  }
}

/**
 * レート制限のためのユーティリティ（将来的な実装用）
 */
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
  userId: string, 
  limit: number = 10, 
  windowMs: number = 60000 // 1分
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const userLimit = requestCounts.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    // 新しいウィンドウを開始
    requestCounts.set(userId, {
      count: 1,
      resetTime: now + windowMs
    });
    return { allowed: true, remaining: limit - 1 };
  }

  if (userLimit.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  userLimit.count++;
  return { allowed: true, remaining: limit - userLimit.count };
}