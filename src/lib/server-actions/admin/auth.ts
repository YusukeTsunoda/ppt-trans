'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * 現在のユーザー情報を取得
 */
export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.email) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
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