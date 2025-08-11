import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helpers';
import prisma from '@/lib/prisma';

export async function GET() {
  // Require admin authentication
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const [totalUsers, activeUsers, totalFiles, totalTranslations] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: {
          isActive: true
        }
      }),
      prisma.file.count(),
      prisma.translation.count()
    ]);

    return NextResponse.json({
      totalUsers,
      activeUsers,
      totalFiles,
      totalTranslations
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json(
      { error: '統計情報の取得に失敗しました' },
      { status: 500 }
    );
  }
}