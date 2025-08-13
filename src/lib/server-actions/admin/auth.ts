'use server';

import { getCurrentUser as getAuthUser } from '@/lib/auth-helpers';
import prisma from '@/lib/prisma';

/**
 * 現在のユーザー情報を取得
 */
export async function getCurrentAdminUser() {
  const user = await getAuthUser();
  
  if (!user) {
    return null;
  }

  const adminUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
    },
  });

  return user;
}