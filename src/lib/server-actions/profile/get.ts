'use server';

import { ServerActionState, createSuccessState, createErrorState } from '../types';
import prisma from '@/lib/prisma';
import logger from '@/lib/logger';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export interface ProfileData {
  id: string;
  email: string;
  name: string | null;
  username: string;
  role: string;
  createdAt: Date;
  filesCount: number;
  settings?: {
    translationModel: string;
    targetLanguage: string;
    batchSize: number;
  };
}

/**
 * プロフィール取得 Server Action
 */
export async function getProfile(
  _prevState: ServerActionState<ProfileData>,
  _formData: FormData
): Promise<ServerActionState<ProfileData>> {
  try {
    const session = await getServerSession(authOptions);
    
    console.log('Session in getProfile:', JSON.stringify(session, null, 2));
    
    if (!session?.user) {
      console.error('No session user found');
      return createErrorState('ログインが必要です');
    }
    
    const userId = (session.user as any).id;
    console.log('User ID from session:', userId);
    
    if (!userId) {
      console.error('No user ID in session');
      return createErrorState('ユーザーIDが取得できません');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            files: true,
          },
        },
        settings: {
          select: {
            translationModel: true,
            targetLanguage: true,
            batchSize: true,
          },
        },
      },
    });

    if (!user) {
      console.error('User not found for ID:', userId);
      return createErrorState('ユーザーが見つかりません');
    }

    logger.info('Profile fetched', {
      userId: user.id,
    });

    return createSuccessState(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt,
        filesCount: user._count.files,
        settings: user.settings ? {
          translationModel: user.settings.translationModel,
          targetLanguage: user.settings.targetLanguage,
          batchSize: user.settings.batchSize,
        } : undefined,
      },
      'プロフィールを取得しました'
    );
  } catch (error) {
    logger.error('Get profile error', error);
    console.error('Error in getProfile:', error);
    return createErrorState('プロフィール取得中にエラーが発生しました');
  }
}

/**
 * プロフィール設定更新 Server Action
 */
export async function updateProfileSettings(
  prevState: ServerActionState<ProfileData>,
  formData: FormData
): Promise<ServerActionState<ProfileData>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return createErrorState('ログインが必要です');
    }

    const translationModel = formData.get('translationModel') as string;
    const targetLanguage = formData.get('targetLanguage') as string;
    const batchSize = parseInt(formData.get('batchSize') as string) || 5;

    // 設定を更新または作成
    await prisma.userSettings.upsert({
      where: { userId: session.user.id },
      update: {
        translationModel,
        targetLanguage,
        batchSize,
      },
      create: {
        userId: session.user.id,
        translationModel,
        targetLanguage,
        batchSize,
      },
    });

    logger.info('Profile settings updated', {
      userId: session.user.id,
      translationModel,
      targetLanguage,
      batchSize,
    });

    // 更新後のプロフィールを返す
    return getProfile(prevState, formData);
  } catch (error) {
    logger.error('Update profile settings error', error);
    return createErrorState('プロフィール設定の更新中にエラーが発生しました');
  }
}