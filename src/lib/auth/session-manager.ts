/**
 * セッション管理モジュール
 * リクエストスコープでセッションの有効性を管理
 */

import { cache } from 'react';
import { getRequestScopedSupabase, getRequestScopedUser } from './request-scoped-auth';

// セッション状態の型定義
export type SessionStatus = 'valid' | 'expired' | 'invalid' | 'refreshing';

export interface SessionInfo {
  status: SessionStatus;
  userId?: string;
  email?: string;
  expiresAt?: Date;
  isNearExpiry?: boolean;
}

// セッション情報の取得（React cache使用）
export const getSessionInfo = cache(async (): Promise<SessionInfo> => {
  const supabase = await getRequestScopedSupabase();
  
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      return { status: 'invalid' };
    }
    
    const expiresAt = session.expires_at ? new Date(session.expires_at * 1000) : undefined;
    const now = new Date();
    
    // セッションが期限切れ
    if (expiresAt && expiresAt < now) {
      return { 
        status: 'expired',
        userId: session.user.id,
        email: session.user.email,
        expiresAt
      };
    }
    
    // セッションの有効期限が近い（5分以内）
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
    const isNearExpiry = expiresAt ? expiresAt < fiveMinutesFromNow : false;
    
    return {
      status: 'valid',
      userId: session.user.id,
      email: session.user.email,
      expiresAt,
      isNearExpiry
    };
  } catch (error) {
    console.error('Failed to get session info:', error);
    return { status: 'invalid' };
  }
});

// セッションの自動リフレッシュ（必要な場合のみ）
export const autoRefreshSession = cache(async (): Promise<boolean> => {
  const sessionInfo = await getSessionInfo();
  
  // リフレッシュが必要な場合のみ実行
  if (sessionInfo.status === 'expired' || sessionInfo.isNearExpiry) {
    const supabase = await getRequestScopedSupabase();
    
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession();
      
      if (error || !session) {
        console.error('Failed to refresh session:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Failed to refresh session:', error);
      return false;
    }
  }
  
  return sessionInfo.status === 'valid';
});

// セッション検証（認証が必要なページで使用）
export async function validateAndRefreshSession(): Promise<boolean> {
  const sessionInfo = await getSessionInfo();
  
  if (sessionInfo.status === 'invalid') {
    return false;
  }
  
  if (sessionInfo.status === 'expired' || sessionInfo.isNearExpiry) {
    return await autoRefreshSession();
  }
  
  return true;
}

// セッションのサインアウト
export async function signOutSession(): Promise<void> {
  const supabase = await getRequestScopedSupabase();
  
  try {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('Failed to sign out:', error);
      throw error;
    }
  } catch (error) {
    console.error('Failed to sign out:', error);
    throw error;
  }
}

// セッション監視用のメタデータ
export const getSessionMetadata = cache(async () => {
  const sessionInfo = await getSessionInfo();
  const user = await getRequestScopedUser();
  
  return {
    isAuthenticated: sessionInfo.status === 'valid' && !!user,
    userId: sessionInfo.userId,
    email: sessionInfo.email,
    expiresAt: sessionInfo.expiresAt,
    isNearExpiry: sessionInfo.isNearExpiry,
    needsRefresh: sessionInfo.status === 'expired' || sessionInfo.isNearExpiry,
    status: sessionInfo.status
  };
});

// セッションイベントのログ
export async function logSessionEvent(
  event: 'login' | 'logout' | 'refresh' | 'expire',
  metadata?: Record<string, any>
) {
  const supabase = await getRequestScopedSupabase();
  const sessionInfo = await getSessionInfo();
  
  try {
    await supabase
      .from('activity_logs')
      .insert({
        user_id: sessionInfo.userId || 'anonymous',
        action: `session_${event}`,
        description: `Session ${event} event`,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
          session_status: sessionInfo.status
        }
      });
  } catch (error) {
    console.error(`Failed to log session event ${event}:`, error);
  }
}