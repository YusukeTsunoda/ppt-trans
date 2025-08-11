'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AppError } from '@/lib/errors/AppError';
import { ErrorCodes } from '@/lib/errors/ErrorCodes';
import logger from '@/lib/logger';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export interface SessionState {
  isAuthenticated: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    image?: string | null;
  };
  expiresAt?: string;
  error?: string;
}

/**
 * セッション更新用Server Action
 * セッションの有効期限を延長
 */
export async function renewSessionAction(): Promise<SessionState> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return {
        isAuthenticated: false,
        error: 'セッションが見つかりません'
      };
    }
    
    // セッション情報を更新（NextAuthの場合は自動的に延長される）
    // カスタムセッション管理が必要な場合はここで実装
    
    // ユーザーの最終アクセス時刻を更新
    await prisma.user.update({
      where: { id: session.user.id },
      data: { 
        lastLoginAt: new Date()
      }
    });
    
    // アクティビティログを記録
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: 'SESSION_RENEWED',
        metadata: {
          ip: 'server-action',
          userAgent: 'server-action'
        }
      }
    });
    
    logger.info('Session renewed', { 
      userId: session.user.id 
    });
    
    // キャッシュを再検証
    revalidatePath('/');
    
    return {
      isAuthenticated: true,
      user: {
        id: session.user.id,
        email: session.user.email || '',
        name: session.user.name || '',
        role: session.user.role || 'USER',
      },
      expiresAt: session.expires
    };
    
  } catch (error) {
    logger.error('Session renewal error', error);
    
    return {
      isAuthenticated: false,
      error: 'セッションの更新に失敗しました'
    };
  }
}

/**
 * セッション確認用Server Action
 * 現在のセッション情報を取得
 */
export async function getSessionAction(): Promise<SessionState> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return {
        isAuthenticated: false
      };
    }
    
    // 追加のユーザー情報を取得
    const userDetails = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        image: true,
        isActive: true,
        lastLoginAt: true,
        settings: {
          select: {
            theme: true,
          }
        }
      }
    });
    
    if (!userDetails) {
      return {
        isAuthenticated: false,
        error: 'ユーザー情報が見つかりません'
      };
    }
    
    return {
      isAuthenticated: true,
      user: {
        id: userDetails.id,
        email: userDetails.email,
        name: userDetails.name || '',
        role: userDetails.role,
        image: userDetails.image
      },
      expiresAt: session.expires
    };
    
  } catch (error) {
    logger.error('Session check error', error);
    
    return {
      isAuthenticated: false,
      error: 'セッションの確認に失敗しました'
    };
  }
}

/**
 * セッション検証用Server Action
 * 特定の操作前にセッションの有効性を確認
 */
export async function validateSessionAction(
  requiredRole?: 'USER' | 'ADMIN' | 'SUPER_ADMIN'
): Promise<{
  valid: boolean;
  user?: SessionState['user'];
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return {
        valid: false,
        error: '認証が必要です'
      };
    }
    
    // ロールのチェック
    if (requiredRole) {
      const roleHierarchy = {
        'USER': 0,
        'ADMIN': 1,
        'SUPER_ADMIN': 2
      };
      
      const userRole = session.user.role || 'USER';
      
      if (roleHierarchy[userRole] < roleHierarchy[requiredRole]) {
        logger.warn('Insufficient permissions', { 
          userId: session.user.id,
          userRole,
          requiredRole
        });
        
        return {
          valid: false,
          error: '権限が不足しています'
        };
      }
    }
    
    // アカウントの状態確認
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        image: true,
        isActive: true
      }
    });
    
    if (!user) {
      return {
        valid: false,
        error: 'ユーザーが見つかりません'
      };
    }
    
    if (!user.isActive) {
      logger.warn('Inactive user attempted access', { 
        userId: user.id,
        isActive: user.isActive
      });
      
      return {
        valid: false,
        error: 'アカウントが無効化されています'
      };
    }
    
    return {
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || '',
        role: user.role,
        image: user.image
      }
    };
    
  } catch (error) {
    logger.error('Session validation error', error);
    
    return {
      valid: false,
      error: 'セッションの検証に失敗しました'
    };
  }
}

/**
 * セッション終了用Server Action
 * ログアウト処理の一部として使用
 */
export async function terminateSessionAction(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    
    if (session?.user?.id) {
      // ログアウトログを記録
      await prisma.activityLog.create({
        data: {
          userId: session.user.id,
          action: 'LOGOUT',
          metadata: {
            ip: 'server-action',
            userAgent: 'server-action'
          }
        }
      });
      
      logger.info('Session terminated', { 
        userId: session.user.id 
      });
    }
    
    // NextAuthのセッション削除は signOut で行う
    // ここでは追加のクリーンアップのみ
    
    return {
      success: true
    };
    
  } catch (error) {
    logger.error('Session termination error', error);
    
    return {
      success: false,
      error: 'セッションの終了に失敗しました'
    };
  }
}

/**
 * アクティブセッション一覧取得用Server Action
 * ユーザーのアクティブなセッション一覧を取得
 */
export async function getActiveSessionsAction(): Promise<{
  sessions: Array<{
    id: string;
    device: string;
    lastActive: string;
    location?: string;
  }>;
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return {
        sessions: [],
        error: '認証が必要です'
      };
    }
    
    // 最近のアクティビティログから推測
    const recentActivities = await prisma.activityLog.findMany({
      where: {
        userId: session.user.id,
        action: {
          in: ['LOGIN', 'SESSION_RENEWED']
        },
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30日以内
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });
    
    // ユニークなセッションを抽出（簡易的な実装）
    const sessionsMap = new Map();
    
    recentActivities.forEach(activity => {
      const metadata = activity.metadata as any;
      const key = `${metadata?.ip || 'unknown'}-${metadata?.userAgent || 'unknown'}`;
      
      if (!sessionsMap.has(key) || sessionsMap.get(key).createdAt < activity.createdAt) {
        sessionsMap.set(key, {
          id: activity.id,
          device: metadata?.userAgent || 'Unknown Device',
          lastActive: activity.createdAt.toISOString(),
          location: metadata?.ip || undefined
        });
      }
    });
    
    return {
      sessions: Array.from(sessionsMap.values())
    };
    
  } catch (error) {
    logger.error('Get active sessions error', error);
    
    return {
      sessions: [],
      error: 'セッション一覧の取得に失敗しました'
    };
  }
}