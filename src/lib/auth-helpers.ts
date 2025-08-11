import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { settings: true }
  });

  return user;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  
  if (!user) {
    return NextResponse.json(
      { error: '認証が必要です' },
      { status: 401 }
    );
  }
  
  return user;
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  
  if (!user) {
    return NextResponse.json(
      { error: '認証が必要です' },
      { status: 401 }
    );
  }
  
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { error: '管理者権限が必要です' },
      { status: 403 }
    );
  }
  
  return user;
}

export async function logUserAction(
  userId: string,
  action: string,
  entityType: string,
  entityId?: string,
  metadata?: any
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        metadata: metadata || {},
      }
    });
  } catch (error) {
    console.error('Failed to log user action:', error);
  }
}