import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { AuditAction } from '@prisma/client';

export async function getCurrentUser() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user?.id) {
    return null;
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: { settings: true }
  });

  return dbUser;
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
  action: AuditAction,
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