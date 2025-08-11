import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import prisma from '@/lib/prisma';

export async function GET() {
  // Authenticate user
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const user = authResult;

  try {
    // Get user profile with settings
    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        createdAt: true,
        lastLoginAt: true,
        settings: {
          select: {
            translationModel: true,
            targetLanguage: true,
            batchSize: true,
            autoSave: true,
            theme: true
          }
        },
        _count: {
          select: {
            files: true
          }
        },
        files: {
          select: {
            fileSize: true,
            totalSlides: true,
            _count: {
              select: {
                translations: true
              }
            }
          }
        }
      }
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'プロフィールが見つかりません' },
        { status: 404 }
      );
    }

    // Calculate statistics
    const totalFiles = profile._count.files;
    const totalTranslations = profile.files.reduce((sum, file) => sum + file._count.translations, 0);
    const totalSlides = profile.files.reduce((sum, file) => sum + (file.totalSlides || 0), 0);
    const storageUsed = profile.files.reduce((sum, file) => sum + (file.fileSize || 0), 0);

    return NextResponse.json({
      id: profile.id,
      email: profile.email,
      username: profile.username,
      role: profile.role,
      createdAt: profile.createdAt.toISOString(),
      lastLoginAt: profile.lastLoginAt?.toISOString() || null,
      settings: profile.settings || {
        translationModel: 'claude-3-haiku-20240307',
        targetLanguage: 'Japanese',
        batchSize: 5,
        autoSave: true,
        theme: 'light'
      },
      stats: {
        totalFiles,
        totalTranslations,
        totalSlides,
        storageUsed
      }
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json(
      { error: 'プロフィールの取得に失敗しました' },
      { status: 500 }
    );
  }
}