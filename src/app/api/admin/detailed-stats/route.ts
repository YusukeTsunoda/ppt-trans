import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helpers';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  // Require admin authentication
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const range = searchParams.get('range') || 'week';
    
    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch (range) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setDate(now.getDate() - 30);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    // Fetch all statistics in parallel
    const [
      totalUsers,
      activeUsers,
      files,
      translations,
      mostActiveUsers,
      recentFiles,
      auditLogs
    ] = await Promise.all([
      // Total users
      prisma.user.count(),
      
      // Active users (logged in within range)
      prisma.user.count({
        where: {
          lastLoginAt: {
            gte: startDate
          }
        }
      }),
      
      // Files with details
      prisma.file.findMany({
        where: {
          createdAt: {
            gte: startDate
          }
        },
        select: {
          fileSize: true,
          totalSlides: true,
          targetLanguage: true,
          translationModel: true,
          status: true,
          createdAt: true
        }
      }),
      
      // Translations
      prisma.translation.findMany({
        where: {
          createdAt: {
            gte: startDate
          }
        },
        select: {
          id: true,
          createdAt: true
        }
      }),
      
      // Most active users
      prisma.user.findMany({
        select: {
          id: true,
          username: true,
          email: true,
          _count: {
            select: {
              files: true
            }
          },
          files: {
            select: {
              totalSlides: true,
              _count: {
                select: {
                  translations: true
                }
              }
            }
          }
        },
        orderBy: {
          files: {
            _count: 'desc'
          }
        },
        take: 5
      }),
      
      // Recent files
      prisma.file.findMany({
        select: {
          id: true,
          fileName: true,
          status: true,
          totalSlides: true,
          createdAt: true,
          user: {
            select: {
              username: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 10
      }),
      
      // Audit logs for daily activity
      prisma.auditLog.findMany({
        where: {
          createdAt: {
            gte: startDate
          },
          action: {
            in: ['FILE_UPLOAD', 'FILE_TRANSLATE', 'FILE_DOWNLOAD']
          }
        },
        select: {
          action: true,
          createdAt: true
        }
      })
    ]);

    // Calculate statistics
    const totalFiles = files.length;
    const totalTranslations = translations.length;
    const totalSlides = files.reduce((sum, file) => sum + (file.totalSlides || 0), 0);
    const totalTexts = translations.length; // Approximation
    const storageUsed = files.reduce((sum, file) => sum + (file.fileSize || 0), 0);
    const averageFilesPerUser = totalUsers > 0 ? totalFiles / totalUsers : 0;
    const averageSlidesPerFile = totalFiles > 0 ? totalSlides / totalFiles : 0;

    // Process model statistics
    const modelCounts = files.reduce((acc, file) => {
      if (file.translationModel) {
        acc[file.translationModel] = (acc[file.translationModel] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const totalWithModel = Object.values(modelCounts).reduce((sum, count) => sum + count, 0);
    const translationStats = Object.entries(modelCounts).map(([model, count]) => ({
      model,
      count,
      percentage: totalWithModel > 0 ? (count / totalWithModel) * 100 : 0
    }));

    // Process language statistics
    const languageCounts = files.reduce((acc, file) => {
      if (file.targetLanguage) {
        acc[file.targetLanguage] = (acc[file.targetLanguage] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const totalWithLang = Object.values(languageCounts).reduce((sum, count) => sum + count, 0);
    const languageStats = Object.entries(languageCounts).map(([language, count]) => ({
      language,
      count,
      percentage: totalWithLang > 0 ? (count / totalWithLang) * 100 : 0
    }));

    // Process daily activity
    const dailyActivityMap = new Map<string, { uploads: number; translations: number; downloads: number }>();
    
    // Initialize dates
    for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      dailyActivityMap.set(dateStr, { uploads: 0, translations: 0, downloads: 0 });
    }

    // Count activities
    auditLogs.forEach(log => {
      const dateStr = log.createdAt.toISOString().split('T')[0];
      const activity = dailyActivityMap.get(dateStr);
      if (activity) {
        switch (log.action) {
          case 'FILE_UPLOAD':
            activity.uploads++;
            break;
          case 'FILE_TRANSLATE':
            activity.translations++;
            break;
          case 'FILE_DOWNLOAD':
            activity.downloads++;
            break;
        }
      }
    });

    const dailyActivity = Array.from(dailyActivityMap.entries())
      .map(([date, activity]) => ({ date, ...activity }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7); // Last 7 days for display

    // Format most active users
    const formattedMostActiveUsers = mostActiveUsers.map(user => {
      const totalUserSlides = user.files.reduce((sum, file) => sum + (file.totalSlides || 0), 0);
      const totalUserTranslations = user.files.reduce((sum, file) => sum + file._count.translations, 0);
      
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        fileCount: user._count.files,
        translationCount: totalUserTranslations,
        totalSlides: totalUserSlides
      };
    });

    // Format recent files
    const formattedRecentFiles = recentFiles.map(file => ({
      id: file.id,
      fileName: file.fileName,
      username: file.user.username,
      status: file.status,
      slideCount: file.totalSlides || 0,
      createdAt: file.createdAt.toISOString()
    }));

    return NextResponse.json({
      totalUsers,
      activeUsers,
      totalFiles,
      totalTranslations,
      totalSlides,
      totalTexts,
      storageUsed,
      averageFilesPerUser,
      averageSlidesPerFile,
      mostActiveUsers: formattedMostActiveUsers,
      recentFiles: formattedRecentFiles,
      translationStats,
      languageStats,
      dailyActivity
    });
  } catch (error) {
    console.error('Error fetching detailed stats:', error);
    return NextResponse.json(
      { error: '統計情報の取得に失敗しました' },
      { status: 500 }
    );
  }
}