/**
 * 移行用ラッパー - 既存のauth-helpersをリクエストスコープ版に段階的に移行
 */

import { getAuthenticatedUser, requireAuthentication, requireAdminRole } from './request-scoped-auth';
import { NextResponse } from 'next/server';
import { serverDb } from '@/lib/supabase/database';
import logger from '@/lib/logger';

// 既存のgetCurrentUser互換ラッパー
export async function getCurrentUser() {
  try {
    const user = await getAuthenticatedUser();
    
    if (!user) {
      return null;
    }
    
    // 既存の形式に合わせて設定情報を追加
    const settings = await serverDb.getUserSettings(user.id).catch(() => null);
    
    return {
      id: user.id,
      email: user.email,
      role: user.role.toLowerCase(), // 既存コードとの互換性のため小文字に
      settings
    };
  } catch (_error) {
    logger.error('getCurrentUser error:', _error);
    return null;
  }
}

// 既存のrequireAuth互換ラッパー
export async function requireAuth() {
  try {
    const user = await requireAuthentication();
    
    // 既存の形式に合わせて設定情報を追加
    const settings = await serverDb.getUserSettings(user.id).catch(() => null);
    
    return {
      id: user.id,
      email: user.email,
      role: user.role.toLowerCase(),
      settings
    };
  } catch (_error) {
    return NextResponse.json(
      { error: '認証が必要です' },
      { status: 401 }
    );
  }
}

// 既存のrequireAdmin互換ラッパー
export async function requireAdmin() {
  try {
    const user = await requireAdminRole();
    
    // 既存の形式に合わせて設定情報を追加
    const settings = await serverDb.getUserSettings(user.id).catch(() => null);
    
    return {
      id: user.id,
      email: user.email,
      role: user.role.toLowerCase(),
      settings
    };
  } catch (_error) {
    const message = _error instanceof Error ? _error.message : '認証が必要です';
    const status = message.includes('Admin') ? 403 : 401;
    const errorMessage = status === 403 ? '管理者権限が必要です' : '認証が必要です';
    
    return NextResponse.json(
      { error: errorMessage },
      { status }
    );
  }
}

// 監査ログ記録（既存互換）
export async function logAuditAction(
  userId: string,
  action: string,
  targetType?: string,
  targetId?: string,
  metadata?: any
) {
  try {
    await serverDb.logActivity({
      user_id: userId,
      action,
      description: `${action} on ${targetType || 'system'}`,
      metadata: {
        targetType,
        targetId,
        ...metadata
      }
    });
  } catch (_error) {
    logger.error('Failed to log audit action:', _error);
  }
}