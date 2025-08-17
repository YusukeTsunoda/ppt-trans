/**
 * 認証ヘルパー関数
 * 
 * 移行フラグで新旧実装を切り替え可能
 * USE_REQUEST_SCOPED_AUTH=true で新実装を使用
 */

// 移行フラグ（環境変数またはフィーチャーフラグで制御）
const USE_REQUEST_SCOPED_AUTH = process.env.USE_REQUEST_SCOPED_AUTH === 'true';

// 新実装（リクエストスコープ）
import * as RequestScopedAuth from './auth/migration-wrapper';

// 旧実装（後方互換性のため一時的に保持）
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { serverDb } from '@/lib/supabase/database';

async function getCurrentUserLegacy() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user?.id) {
    return null;
  }

  // プロファイル情報を取得
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // ユーザー設定を取得
  const settings = await serverDb.getUserSettings(user.id);

  return {
    id: user.id,
    email: user.email,
    role: profile?.role || 'user',
    settings
  };
}

async function requireAuthLegacy() {
  const user = await getCurrentUserLegacy();
  
  if (!user) {
    return NextResponse.json(
      { error: '認証が必要です' },
      { status: 401 }
    );
  }
  
  return user;
}

async function requireAdminLegacy() {
  const user = await getCurrentUserLegacy();
  
  if (!user) {
    return NextResponse.json(
      { error: '認証が必要です' },
      { status: 401 }
    );
  }
  
  if (user.role !== 'admin') {
    return NextResponse.json(
      { error: '管理者権限が必要です' },
      { status: 403 }
    );
  }
  
  return user;
}

async function logAuditActionLegacy(
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
  } catch (error) {
    console.error('Failed to log audit action:', error);
  }
}

// エクスポート（フラグによって実装を切り替え）
export const getCurrentUser = USE_REQUEST_SCOPED_AUTH 
  ? RequestScopedAuth.getCurrentUser 
  : getCurrentUserLegacy;

export const requireAuth = USE_REQUEST_SCOPED_AUTH
  ? RequestScopedAuth.requireAuth
  : requireAuthLegacy;

export const requireAdmin = USE_REQUEST_SCOPED_AUTH
  ? RequestScopedAuth.requireAdmin
  : requireAdminLegacy;

export const logAuditAction = USE_REQUEST_SCOPED_AUTH
  ? RequestScopedAuth.logAuditAction
  : logAuditActionLegacy;