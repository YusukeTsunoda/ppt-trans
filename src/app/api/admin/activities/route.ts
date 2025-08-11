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
    const activities = await prisma.auditLog.findMany({
      include: {
        user: {
          select: {
            username: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50 // Last 50 activities
    });

    const formattedActivities = activities.map(activity => ({
      id: activity.id,
      userId: activity.userId,
      username: activity.user.username,
      email: activity.user.email,
      action: activity.action,
      entityType: activity.entityType,
      entityId: activity.entityId,
      metadata: activity.metadata,
      createdAt: activity.createdAt.toISOString()
    }));

    return NextResponse.json({ activities: formattedActivities });
  } catch (error) {
    console.error('Error fetching activities:', error);
    return NextResponse.json(
      { error: 'アクティビティの取得に失敗しました' },
      { status: 500 }
    );
  }
}