import prisma from '@/lib/prisma';
import logger from '@/lib/logger';

export type ActivityAction = 
  | 'LOGIN'
  | 'LOGOUT'
  | 'FILE_UPLOAD'
  | 'FILE_DOWNLOAD'
  | 'FILE_DELETE'
  | 'FILE_TRANSLATE'
  | 'SETTINGS_UPDATE'
  | 'USER_CREATE'
  | 'USER_UPDATE'
  | 'USER_DELETE';

export type ActivityTargetType = 'file' | 'user' | 'settings' | 'translation';

interface LogActivityParams {
  userId: string;
  action: ActivityAction;
  targetType?: ActivityTargetType;
  targetId?: string;
  fileId?: string;
  metadata?: any;
}

/**
 * アクティビティログを記録
 */
export async function logActivity(params: LogActivityParams) {
  try {
    await prisma.activityLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        fileId: params.fileId,
        metadata: params.metadata || undefined,
      },
    });
    logger.info('Activity logged', { action: params.action, userId: params.userId });
  } catch (error) {
    logger.error('Failed to log activity', { error, params });
    // アクティビティログの失敗は処理を中断させない
  }
}