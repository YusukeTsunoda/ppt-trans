import { NextResponse } from 'next/server';
import { requireAuth, logUserAction } from '@/lib/auth-helpers';
import prisma from '@/lib/prisma';

export async function PUT(request: Request) {
  // Authenticate user
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const user = authResult;

  try {
    const body = await request.json();
    
    // Validate input
    const { translationModel, targetLanguage, batchSize, autoSave, theme } = body;
    
    if (!translationModel || !targetLanguage || !batchSize || theme === undefined) {
      return NextResponse.json(
        { error: '必須項目が不足しています' },
        { status: 400 }
      );
    }

    // Check if settings exist
    const existingSettings = await prisma.userSettings.findUnique({
      where: { userId: user.id }
    });

    let settings;
    
    if (existingSettings) {
      // Update existing settings
      settings = await prisma.userSettings.update({
        where: { userId: user.id },
        data: {
          translationModel,
          targetLanguage,
          batchSize,
          autoSave,
          theme,
          updatedAt: new Date()
        }
      });
    } else {
      // Create new settings
      settings = await prisma.userSettings.create({
        data: {
          userId: user.id,
          translationModel,
          targetLanguage,
          batchSize,
          autoSave,
          theme
        }
      });
    }

    // Log the action
    await logUserAction(
      user.id,
      'SETTINGS_UPDATE',
      'settings',
      settings.id,
      {
        translationModel,
        targetLanguage,
        batchSize,
        autoSave,
        theme
      }
    );

    return NextResponse.json({
      message: '設定を更新しました',
      settings: {
        translationModel: settings.translationModel,
        targetLanguage: settings.targetLanguage,
        batchSize: settings.batchSize,
        autoSave: settings.autoSave,
        theme: settings.theme
      }
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { error: '設定の更新に失敗しました' },
      { status: 500 }
    );
  }
}