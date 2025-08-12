'use server';

import prisma from '@/lib/prisma';
import logger from '@/lib/logger';

/**
 * ユーザー一覧を取得
 */
export async function getUsers(params?: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  try {
    const page = params?.page || 1;
    const limit = params?.limit || 20;
    const search = params?.search;

    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { name: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          lastLoginAt: true,
          _count: {
            select: {
              files: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    logger.info('Users listed', {
      count: users.length,
      page,
      search,
    });

    return {
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    };
  } catch (error) {
    logger.error('Get users error', error);
    return {
      success: false,
      message: 'ユーザー一覧の取得中にエラーが発生しました',
    };
  }
}