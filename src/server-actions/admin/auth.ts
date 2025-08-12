'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { AppError } from '@/lib/errors/AppError';
import { ErrorCodes } from '@/lib/errors/ErrorCodes';

export async function checkAdminPermission(): Promise<string> {
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

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, isActive: true },
  });

  if (!user) {
    throw new AppError(
      'User not found',
      ErrorCodes.AUTH_USER_NOT_FOUND,
      404,
      true,
      'ユーザーが見つかりません'
    );
  }

  if (!user.isActive) {
    throw new AppError(
      'User inactive',
      ErrorCodes.AUTH_UNAUTHORIZED,
      403,
      true,
      'アカウントが無効化されています'
    );
  }

  if (user.role !== 'ADMIN') {
    throw new AppError(
      'Forbidden',
      ErrorCodes.AUTH_UNAUTHORIZED,
      403,
      true,
      '管理者権限が必要です'
    );
  }

  return session.user.id;
}

export async function checkUserPermission(): Promise<string> {
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

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isActive: true },
  });

  if (!user) {
    throw new AppError(
      'User not found',
      ErrorCodes.AUTH_USER_NOT_FOUND,
      404,
      true,
      'ユーザーが見つかりません'
    );
  }

  if (!user.isActive) {
    throw new AppError(
      'User inactive',
      ErrorCodes.AUTH_UNAUTHORIZED,
      403,
      true,
      'アカウントが無効化されています'
    );
  }

  return session.user.id;
}

export async function checkResourceAccess(
  resourceType: 'file' | 'translation' | 'user',
  resourceId: string,
  userId: string
): Promise<boolean> {
  switch (resourceType) {
    case 'file':
      const file = await prisma.file.findUnique({
        where: { id: resourceId },
        select: { userId: true },
      });
      return file?.userId === userId;

    case 'user':
      return resourceId === userId;

    default:
      return false;
  }
}

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      lastLoginAt: true,
    },
  });

  return user;
}

export async function getClientIp(request?: Request): Promise<string> {
  if (!request) return 'unknown';
  
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  return 'unknown';
}