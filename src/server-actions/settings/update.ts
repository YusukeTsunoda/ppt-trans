'use server';

import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { AppError } from '@/lib/errors/AppError';
import { ErrorCodes } from '@/lib/errors/ErrorCodes';
import logger from '@/lib/logger';
import { revalidatePath } from 'next/cache';

// 翻訳設定のスキーマ
const translationSettingsSchema = z.object({
  defaultTargetLanguage: z.enum(['Japanese', 'English', 'Chinese', 'Korean', 'Spanish', 'French', 'German']),
  translationModel: z.enum(['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307']),
  preserveFormatting: z.boolean(),
  customPrompt: z.string().max(1000, 'カスタムプロンプトは1000文字以内で入力してください').optional(),
  glossaryEnabled: z.boolean(),
  autoDetectLanguage: z.boolean(),
  batchSize: z.number().min(1).max(100),
});

// 表示設定のスキーマ
const displaySettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  fontSize: z.enum(['small', 'medium', 'large']),
  compactMode: z.boolean(),
  showLineNumbers: z.boolean(),
  highlightTranslations: z.boolean(),
  sidebarCollapsed: z.boolean(),
});

// API設定のスキーマ
const apiSettingsSchema = z.object({
  anthropicApiKey: z.string().min(1, 'APIキーを入力してください').optional(),
  apiEndpoint: z.string().url('有効なURLを入力してください').optional(),
  maxRetries: z.number().min(0).max(10),
  timeout: z.number().min(1000).max(60000),
  rateLimitPerMinute: z.number().min(1).max(1000),
});

// エクスポート設定のスキーマ
const exportSettingsSchema = z.object({
  defaultFormat: z.enum(['pptx', 'pdf', 'docx', 'txt']),
  includeOriginalText: z.boolean(),
  includeMetadata: z.boolean(),
  compressionEnabled: z.boolean(),
  watermarkEnabled: z.boolean(),
  watermarkText: z.string().max(100).optional(),
});

// セキュリティ設定のスキーマ
const securitySettingsSchema = z.object({
  twoFactorEnabled: z.boolean(),
  sessionTimeout: z.number().min(5).max(1440), // 分単位
  ipWhitelist: z.array(z.string().ip()).optional(),
  apiAccessEnabled: z.boolean(),
  auditLogRetention: z.number().min(7).max(365), // 日単位
});

/**
 * 翻訳設定を更新
 */
export async function updateTranslationSettings(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new AppError(
        'Unauthorized',
        ErrorCodes.AUTH_UNAUTHORIZED,
        401,
        true,
        '認証が必要です'
      );
    }

    // FormDataをオブジェクトに変換
    const data = {
      defaultTargetLanguage: formData.get('defaultTargetLanguage') as string,
      translationModel: formData.get('translationModel') as string,
      preserveFormatting: formData.get('preserveFormatting') === 'true',
      customPrompt: formData.get('customPrompt') as string || undefined,
      glossaryEnabled: formData.get('glossaryEnabled') === 'true',
      autoDetectLanguage: formData.get('autoDetectLanguage') === 'true',
      batchSize: parseInt(formData.get('batchSize') as string || '10'),
    };
    
    // バリデーション
    const validatedData = translationSettingsSchema.parse(data);

    // 設定を更新または作成
    const settings = await prisma.userSettings.upsert({
      where: { userId: session.user.id },
      update: {
        translationSettings: validatedData,
        updatedAt: new Date(),
      },
      create: {
        userId: session.user.id,
        translationSettings: validatedData,
      },
    });

    // 監査ログを記録
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        entityType: 'translation_settings',
        entityId: session.user.id,
        metadata: validatedData,
      },
    });

    logger.info('Translation settings updated successfully', {
      userId: session.user.id,
      settings: validatedData,
    });

    // キャッシュを再検証
    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard');

    return {
      success: true,
      data: settings,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0].message,
      };
    }

    if (error instanceof AppError) {
      logger.logAppError(error);
      return {
        success: false,
        error: error.userMessage || '翻訳設定の更新に失敗しました',
      };
    }

    logger.error('Failed to update translation settings', error);
    return {
      success: false,
      error: '翻訳設定の更新に失敗しました',
    };
  }
}

/**
 * 表示設定を更新
 */
export async function updateDisplaySettings(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new AppError(
        'Unauthorized',
        ErrorCodes.AUTH_UNAUTHORIZED,
        401,
        true,
        '認証が必要です'
      );
    }

    // FormDataをオブジェクトに変換
    const data = {
      theme: formData.get('theme') as string,
      fontSize: formData.get('fontSize') as string,
      compactMode: formData.get('compactMode') === 'true',
      showLineNumbers: formData.get('showLineNumbers') === 'true',
      highlightTranslations: formData.get('highlightTranslations') === 'true',
      sidebarCollapsed: formData.get('sidebarCollapsed') === 'true',
    };
    
    // バリデーション
    const validatedData = displaySettingsSchema.parse(data);

    // 設定を更新または作成
    const settings = await prisma.userSettings.upsert({
      where: { userId: session.user.id },
      update: {
        displaySettings: validatedData,
        updatedAt: new Date(),
      },
      create: {
        userId: session.user.id,
        displaySettings: validatedData,
      },
    });

    // 監査ログを記録
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        entityType: 'display_settings',
        entityId: session.user.id,
        metadata: validatedData,
      },
    });

    logger.info('Display settings updated successfully', {
      userId: session.user.id,
      settings: validatedData,
    });

    // キャッシュを再検証
    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard');

    return {
      success: true,
      data: settings,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0].message,
      };
    }

    if (error instanceof AppError) {
      logger.logAppError(error);
      return {
        success: false,
        error: error.userMessage || '表示設定の更新に失敗しました',
      };
    }

    logger.error('Failed to update display settings', error);
    return {
      success: false,
      error: '表示設定の更新に失敗しました',
    };
  }
}

/**
 * API設定を更新
 */
export async function updateApiSettings(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new AppError(
        'Unauthorized',
        ErrorCodes.AUTH_UNAUTHORIZED,
        401,
        true,
        '認証が必要です'
      );
    }

    // FormDataをオブジェクトに変換
    const data = {
      anthropicApiKey: formData.get('anthropicApiKey') as string || undefined,
      apiEndpoint: formData.get('apiEndpoint') as string || undefined,
      maxRetries: parseInt(formData.get('maxRetries') as string || '3'),
      timeout: parseInt(formData.get('timeout') as string || '30000'),
      rateLimitPerMinute: parseInt(formData.get('rateLimitPerMinute') as string || '60'),
    };
    
    // バリデーション
    const validatedData = apiSettingsSchema.parse(data);

    // APIキーを暗号化（実装は省略、実際には暗号化ライブラリを使用）
    if (validatedData.anthropicApiKey) {
      // TODO: 暗号化処理
      // validatedData.anthropicApiKey = encrypt(validatedData.anthropicApiKey);
    }

    // 設定を更新または作成
    const settings = await prisma.userSettings.upsert({
      where: { userId: session.user.id },
      update: {
        apiSettings: validatedData,
        updatedAt: new Date(),
      },
      create: {
        userId: session.user.id,
        apiSettings: validatedData,
      },
    });

    // 監査ログを記録（APIキーは記録しない）
    const logData = { ...validatedData };
    if (logData.anthropicApiKey) {
      logData.anthropicApiKey = '***REDACTED***';
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        entityType: 'api_settings',
        entityId: session.user.id,
        metadata: logData,
      },
    });

    logger.info('API settings updated successfully', {
      userId: session.user.id,
      settings: logData,
    });

    // キャッシュを再検証
    revalidatePath('/dashboard/settings');

    return {
      success: true,
      data: settings,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0].message,
      };
    }

    if (error instanceof AppError) {
      logger.logAppError(error);
      return {
        success: false,
        error: error.userMessage || 'API設定の更新に失敗しました',
      };
    }

    logger.error('Failed to update API settings', error);
    return {
      success: false,
      error: 'API設定の更新に失敗しました',
    };
  }
}

/**
 * エクスポート設定を更新
 */
export async function updateExportSettings(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new AppError(
        'Unauthorized',
        ErrorCodes.AUTH_UNAUTHORIZED,
        401,
        true,
        '認証が必要です'
      );
    }

    // FormDataをオブジェクトに変換
    const data = {
      defaultFormat: formData.get('defaultFormat') as string,
      includeOriginalText: formData.get('includeOriginalText') === 'true',
      includeMetadata: formData.get('includeMetadata') === 'true',
      compressionEnabled: formData.get('compressionEnabled') === 'true',
      watermarkEnabled: formData.get('watermarkEnabled') === 'true',
      watermarkText: formData.get('watermarkText') as string || undefined,
    };
    
    // バリデーション
    const validatedData = exportSettingsSchema.parse(data);

    // 設定を更新または作成
    const settings = await prisma.userSettings.upsert({
      where: { userId: session.user.id },
      update: {
        exportSettings: validatedData,
        updatedAt: new Date(),
      },
      create: {
        userId: session.user.id,
        exportSettings: validatedData,
      },
    });

    // 監査ログを記録
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        entityType: 'export_settings',
        entityId: session.user.id,
        metadata: validatedData,
      },
    });

    logger.info('Export settings updated successfully', {
      userId: session.user.id,
      settings: validatedData,
    });

    // キャッシュを再検証
    revalidatePath('/dashboard/settings');

    return {
      success: true,
      data: settings,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0].message,
      };
    }

    if (error instanceof AppError) {
      logger.logAppError(error);
      return {
        success: false,
        error: error.userMessage || 'エクスポート設定の更新に失敗しました',
      };
    }

    logger.error('Failed to update export settings', error);
    return {
      success: false,
      error: 'エクスポート設定の更新に失敗しました',
    };
  }
}

/**
 * セキュリティ設定を更新
 */
export async function updateSecuritySettings(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new AppError(
        'Unauthorized',
        ErrorCodes.AUTH_UNAUTHORIZED,
        401,
        true,
        '認証が必要です'
      );
    }

    // FormDataをオブジェクトに変換
    const ipWhitelist = formData.get('ipWhitelist') as string;
    const data = {
      twoFactorEnabled: formData.get('twoFactorEnabled') === 'true',
      sessionTimeout: parseInt(formData.get('sessionTimeout') as string || '60'),
      ipWhitelist: ipWhitelist ? ipWhitelist.split(',').map(ip => ip.trim()) : undefined,
      apiAccessEnabled: formData.get('apiAccessEnabled') === 'true',
      auditLogRetention: parseInt(formData.get('auditLogRetention') as string || '90'),
    };
    
    // バリデーション
    const validatedData = securitySettingsSchema.parse(data);

    // 設定を更新または作成
    const settings = await prisma.userSettings.upsert({
      where: { userId: session.user.id },
      update: {
        securitySettings: validatedData,
        updatedAt: new Date(),
      },
      create: {
        userId: session.user.id,
        securitySettings: validatedData,
      },
    });

    // 監査ログを記録
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        entityType: 'security_settings',
        entityId: session.user.id,
        metadata: validatedData,
      },
    });

    logger.info('Security settings updated successfully', {
      userId: session.user.id,
      settings: validatedData,
    });

    // キャッシュを再検証
    revalidatePath('/dashboard/settings');

    return {
      success: true,
      data: settings,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0].message,
      };
    }

    if (error instanceof AppError) {
      logger.logAppError(error);
      return {
        success: false,
        error: error.userMessage || 'セキュリティ設定の更新に失敗しました',
      };
    }

    logger.error('Failed to update security settings', error);
    return {
      success: false,
      error: 'セキュリティ設定の更新に失敗しました',
    };
  }
}

/**
 * すべての設定をリセット
 */
export async function resetAllSettings() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new AppError(
        'Unauthorized',
        ErrorCodes.AUTH_UNAUTHORIZED,
        401,
        true,
        '認証が必要です'
      );
    }

    // デフォルト設定
    const defaultSettings = {
      translationSettings: {
        defaultTargetLanguage: 'Japanese',
        translationModel: 'claude-3-sonnet-20240229',
        preserveFormatting: true,
        glossaryEnabled: false,
        autoDetectLanguage: false,
        batchSize: 10,
      },
      displaySettings: {
        theme: 'system',
        fontSize: 'medium',
        compactMode: false,
        showLineNumbers: false,
        highlightTranslations: true,
        sidebarCollapsed: false,
      },
      exportSettings: {
        defaultFormat: 'pptx',
        includeOriginalText: true,
        includeMetadata: false,
        compressionEnabled: true,
        watermarkEnabled: false,
      },
      securitySettings: {
        twoFactorEnabled: false,
        sessionTimeout: 60,
        apiAccessEnabled: false,
        auditLogRetention: 90,
      },
    };

    // 設定をリセット
    const settings = await prisma.userSettings.upsert({
      where: { userId: session.user.id },
      update: {
        ...defaultSettings,
        updatedAt: new Date(),
      },
      create: {
        userId: session.user.id,
        ...defaultSettings,
      },
    });

    // 監査ログを記録
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        entityType: 'all_settings',
        entityId: session.user.id,
        metadata: {
          action: 'reset_to_defaults',
        },
      },
    });

    logger.info('All settings reset successfully', {
      userId: session.user.id,
    });

    // キャッシュを再検証
    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard');

    return {
      success: true,
      data: settings,
      message: 'すべての設定をデフォルトに戻しました',
    };
  } catch (error) {
    if (error instanceof AppError) {
      logger.logAppError(error);
      return {
        success: false,
        error: error.userMessage || '設定のリセットに失敗しました',
      };
    }

    logger.error('Failed to reset settings', error);
    return {
      success: false,
      error: '設定のリセットに失敗しました',
    };
  }
}