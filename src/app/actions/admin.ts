'use server';

import { createClient } from '@/lib/supabase/server';
import logger from '@/lib/logger';

export interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  description: string;
  metadata?: any;
  created_at: string;
}

export interface LogActivityResult {
  success: boolean;
  id?: string;
  error?: string;
}

export interface GetActivitiesResult {
  success: boolean;
  activities?: ActivityLog[];
  error?: string;
}

/**
 * アクティビティをログに記録する
 * @param action アクション名
 * @param description 説明
 * @param metadata メタデータ（オプション）
 * @returns ログ記録結果
 */
export async function logActivityAction(
  action: string,
  description: string,
  metadata?: any
): Promise<LogActivityResult> {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        success: false,
        error: '認証が必要です'
      };
    }
    
    // Log activity
    const { data, error } = await supabase.rpc('log_activity', {
      p_action: action,
      p_description: description,
      p_metadata: metadata || {}
    });
    
    if (error) {
      logger.error('Failed to log activity:', error);
      return {
        success: false,
        error: 'アクティビティの記録に失敗しました'
      };
    }
    
    return {
      success: true,
      id: data
    };
  } catch (error) {
    logger.error('Activity logging error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'アクティビティ記録中にエラーが発生しました'
    };
  }
}

/**
 * アクティビティログを取得する
 * 管理者は全てのアクティビティ、一般ユーザーは自分のアクティビティのみ取得可能
 * @param limit 取得件数の上限（デフォルト: 20）
 * @returns アクティビティログの配列
 */
export async function getActivitiesAction(limit: number = 20): Promise<GetActivitiesResult> {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        success: false,
        error: '認証が必要です'
      };
    }
    
    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    
    if (profile?.role !== 'admin') {
      // Regular users can only see their own activities
      const { data: activities, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) {
        logger.error('Failed to fetch user activities:', error);
        return {
          success: false,
          error: 'アクティビティの取得に失敗しました'
        };
      }
      
      return {
        success: true,
        activities: activities || []
      };
    }
    
    // Admin can see all activities
    const { data: activities, error } = await supabase.rpc('get_recent_activities', {
      limit_count: Math.min(limit, 100) // 最大100件まで
    });
    
    if (error) {
      logger.error('Failed to fetch admin activities:', error);
      return {
        success: false,
        error: 'アクティビティの取得に失敗しました'
      };
    }
    
    return {
      success: true,
      activities: activities || []
    };
  } catch (error) {
    logger.error('Activity fetch error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'アクティビティ取得中にエラーが発生しました'
    };
  }
}

/**
 * 管理者権限を確認する
 * @returns 管理者かどうか
 */
export async function checkAdminRoleAction(): Promise<{ isAdmin: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        isAdmin: false,
        error: '認証が必要です'
      };
    }
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    
    return {
      isAdmin: profile?.role === 'admin'
    };
  } catch (error) {
    logger.error('Admin check error:', error);
    return {
      isAdmin: false,
      error: error instanceof Error ? error.message : '権限確認中にエラーが発生しました'
    };
  }
}

/**
 * 管理者用: ユーザー統計を取得する
 * @returns ユーザー統計情報
 */
export async function getAdminStatsAction(): Promise<{
  success: boolean;
  stats?: {
    totalUsers: number;
    activeUsers: number;
    totalFiles: number;
    totalTranslations: number;
  };
  error?: string;
}> {
  try {
    const supabase = await createClient();
    
    // Check if user is admin
    const { isAdmin, error: adminError } = await checkAdminRoleAction();
    if (!isAdmin) {
      return {
        success: false,
        error: adminError || '管理者権限が必要です'
      };
    }
    
    // Get user statistics
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    
    // Get active users (logged in within last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { count: activeUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('updated_at', thirtyDaysAgo.toISOString());
    
    // Get file statistics
    const { count: totalFiles } = await supabase
      .from('files')
      .select('*', { count: 'exact', head: true });
    
    // Get translation statistics (completed files)
    const { count: totalTranslations } = await supabase
      .from('files')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed');
    
    return {
      success: true,
      stats: {
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        totalFiles: totalFiles || 0,
        totalTranslations: totalTranslations || 0
      }
    };
  } catch (error) {
    logger.error('Admin stats error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '統計情報の取得中にエラーが発生しました'
    };
  }
}