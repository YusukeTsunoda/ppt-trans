'use server';

import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { AppError } from '@/lib/errors/AppError';
import { ErrorCodes } from '@/lib/errors/ErrorCodes';
import logger from '@/lib/logger';
import { revalidatePath } from 'next/cache';

// ユーザー検索のスキーマ
const searchUsersSchema = z.object({
  query: z.string().optional(),
  role: z.enum(['USER', 'ADMIN']).optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'name', 'email', 'lastLoginAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ユーザー更新のスキーマ
const updateUserSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  role: z.enum(['USER', 'ADMIN']).optional(),
  isActive: z.boolean().optional(),
  // emailVerified: z.boolean().optional(), // Userモデルに存在しないためコメントアウト
});

// ユーザー作成のスキーマ
const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['USER', 'ADMIN']).default('USER'),
  sendWelcomeEmail: z.boolean().default(true),
});

/**
 * 管理者権限をチェック
 */
async function checkAdminPermission() {
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
    select: { role: true },
  });

  if (user?.role !== 'ADMIN') {
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

/**
 * ユーザー一覧を取得
 */
export async function getUsers(params: z.infer<typeof searchUsersSchema>) {
  try {
    const adminUserId = await checkAdminPermission();

    // パラメータをバリデーション
    const validatedParams = searchUsersSchema.parse(params);

    // 検索条件を構築
    const where: any = {};

    if (validatedParams.query) {
      where.OR = [
        { name: { contains: validatedParams.query, mode: 'insensitive' } },
        { email: { contains: validatedParams.query, mode: 'insensitive' } },
      ];
    }

    if (validatedParams.role) {
      where.role = validatedParams.role;
    }

    if (validatedParams.status) {
      switch (validatedParams.status) {
        case 'active':
          where.isActive = true;
          where.deletedAt = null;
          break;
        case 'inactive':
          where.isActive = false;
          where.deletedAt = null;
          break;
        case 'suspended':
          where.deletedAt = { not: null };
          break;
      }
    }

    // ユーザー数を取得
    const totalCount = await prisma.user.count({ where });

    // ユーザー一覧を取得
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        // emailVerified: true, // Userモデルに存在しないためコメントアウト
        createdAt: true,
        lastLoginAt: true,
        // avatarUrl: true, // Userモデルに存在しないためコメントアウト
        _count: {
          select: {
            files: true,
            auditLogs: true,
          },
        },
      },
      orderBy: {
        [validatedParams.sortBy]: validatedParams.sortOrder,
      },
      skip: (validatedParams.page - 1) * validatedParams.limit,
      take: validatedParams.limit,
    });

    // 監査ログを記録
    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'USER_UPDATE', // ユーザー一覧の閲覧をUSER_UPDATEで記録
        entityType: 'users',
        entityId: 'list',
        metadata: {
          query: validatedParams.query,
          role: validatedParams.role,
          status: validatedParams.status,
          page: validatedParams.page,
        },
      },
    });

    logger.info('Users list retrieved', {
      adminUserId,
      params: validatedParams,
      resultCount: users.length,
    });

    return {
      success: true,
      data: {
        users,
        pagination: {
          page: validatedParams.page,
          limit: validatedParams.limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / validatedParams.limit),
        },
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0].message,
      };
    }

    if (error instanceof AppError) {
      logger.logAppError(error);
      return {
        success: false,
        error: error.userMessage || 'ユーザー一覧の取得に失敗しました',
      };
    }

    logger.error('Failed to get users', error);
    return {
      success: false,
      error: 'ユーザー一覧の取得に失敗しました',
    };
  }
}

/**
 * ユーザー詳細を取得
 */
export async function getUserDetail(userId: string) {
  try {
    const adminUserId = await checkAdminPermission();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        sessions: {
          select: {
            id: true,
            sessionToken: true,
            expires: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        files: {
          select: {
            id: true,
            fileName: true,
            fileSize: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        auditLogs: {
          select: {
            id: true,
            action: true,
            entityType: true,
            entityId: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        _count: {
          select: {
            files: true,
            sessions: true,
            auditLogs: true,
          },
        },
      },
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

    // 監査ログを記録
    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'USER_UPDATE', // ユーザー一覧の閲覧をUSER_UPDATEで記録
        entityType: 'user',
        entityId: userId,
        metadata: {
          action: 'view_detail',
        },
      },
    });

    logger.info('User detail retrieved', {
      adminUserId,
      viewedUserId: userId,
    });

    return {
      success: true,
      data: user,
    };
  } catch (error) {
    if (error instanceof AppError) {
      logger.logAppError(error);
      return {
        success: false,
        error: error.userMessage || 'ユーザー詳細の取得に失敗しました',
      };
    }

    logger.error('Failed to get user detail', error);
    return {
      success: false,
      error: 'ユーザー詳細の取得に失敗しました',
    };
  }
}

/**
 * ユーザー情報を更新
 */
export async function updateUser(data: z.infer<typeof updateUserSchema>) {
  try {
    const adminUserId = await checkAdminPermission();

    // バリデーション
    const validatedData = updateUserSchema.parse(data);

    // 自分自身の管理者権限は変更できない
    if (validatedData.userId === adminUserId && validatedData.role === 'USER') {
      throw new AppError(
        'Cannot demote self',
        ErrorCodes.VALIDATION_INVALID_FORMAT,
        400,
        true,
        '自分自身の管理者権限を解除することはできません'
      );
    }

    // ユーザーを更新
    const { userId, ...updateData } = validatedData;
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        // emailVerified: true, // Userモデルに存在しないためコメントアウト
      },
    });

    // 監査ログを記録
    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'USER_UPDATE',
        entityType: 'user',
        entityId: userId,
        metadata: {
          updatedFields: Object.keys(updateData),
          changes: updateData,
        },
      },
    });

    logger.info('User updated successfully', {
      adminUserId,
      updatedUserId: userId,
      changes: updateData,
    });

    // キャッシュを再検証
    revalidatePath('/admin/users');
    revalidatePath(`/admin/users/${userId}`);

    return {
      success: true,
      data: updatedUser,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0].message,
      };
    }

    if (error instanceof AppError) {
      logger.logAppError(error);
      return {
        success: false,
        error: error.userMessage || 'ユーザー情報の更新に失敗しました',
      };
    }

    logger.error('Failed to update user', error);
    return {
      success: false,
      error: 'ユーザー情報の更新に失敗しました',
    };
  }
}

/**
 * ユーザーを作成
 */
export async function createUser(formData: FormData) {
  try {
    const adminUserId = await checkAdminPermission();

    // FormDataをオブジェクトに変換
    const data = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      password: formData.get('password') as string,
      role: formData.get('role') as 'USER' | 'ADMIN' || 'USER',
      sendWelcomeEmail: formData.get('sendWelcomeEmail') === 'true',
    };

    // バリデーション
    const validatedData = createUserSchema.parse(data);

    // メールアドレスの重複チェック
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      throw new AppError(
        'Email already exists',
        ErrorCodes.VALIDATION_INVALID_FORMAT,
        400,
        true,
        'このメールアドレスは既に登録されています'
      );
    }

    // パスワードをハッシュ化
    const { hash } = await import('bcryptjs');
    const hashedPassword = await hash(validatedData.password, 10);

    // ユーザーを作成
    const newUser = await prisma.user.create({
      data: {
        name: validatedData.name,
        email: validatedData.email,
        username: validatedData.email.split('@')[0], // メールアドレスからusernameを生成
        password: hashedPassword,
        role: validatedData.role,
        // emailVerified: true, // Userモデルに存在しないためコメントアウト // 管理者が作成したユーザーは確認済みとする
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    // ウェルカムメールを送信（実装は省略）
    if (validatedData.sendWelcomeEmail) {
      // TODO: メール送信処理
      logger.info('Welcome email would be sent', { userId: newUser.id });
    }

    // 監査ログを記録
    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'USER_CREATE',
        entityType: 'user',
        entityId: newUser.id,
        metadata: {
          name: validatedData.name,
          email: validatedData.email,
          role: validatedData.role,
        },
      },
    });

    logger.info('User created successfully', {
      adminUserId,
      newUserId: newUser.id,
    });

    // キャッシュを再検証
    revalidatePath('/admin/users');

    return {
      success: true,
      data: newUser,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0].message,
      };
    }

    if (error instanceof AppError) {
      logger.logAppError(error);
      return {
        success: false,
        error: error.userMessage || 'ユーザーの作成に失敗しました',
      };
    }

    logger.error('Failed to create user', error);
    return {
      success: false,
      error: 'ユーザーの作成に失敗しました',
    };
  }
}

/**
 * ユーザーを削除（論理削除）
 */
export async function deleteUser(userId: string) {
  try {
    const adminUserId = await checkAdminPermission();

    // 自分自身は削除できない
    if (userId === adminUserId) {
      throw new AppError(
        'Cannot delete self',
        ErrorCodes.VALIDATION_INVALID_FORMAT,
        400,
        true,
        '自分自身を削除することはできません'
      );
    }

    // ユーザーを論理削除
    const deletedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        // deletedAt: new Date(), // Userモデルに存在しないためコメントアウト
        email: `deleted_${userId}_${Date.now()}@deleted.com`, // メールアドレスを変更
      },
      select: {
        id: true,
        name: true,
      },
    });

    // 監査ログを記録
    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'USER_DELETE',
        entityType: 'user',
        entityId: userId,
        metadata: {
          action: 'soft_delete',
        },
      },
    });

    logger.info('User deleted successfully', {
      adminUserId,
      deletedUserId: userId,
    });

    // キャッシュを再検証
    revalidatePath('/admin/users');

    return {
      success: true,
      message: `ユーザー ${deletedUser.name} を削除しました`,
    };
  } catch (error) {
    if (error instanceof AppError) {
      logger.logAppError(error);
      return {
        success: false,
        error: error.userMessage || 'ユーザーの削除に失敗しました',
      };
    }

    logger.error('Failed to delete user', error);
    return {
      success: false,
      error: 'ユーザーの削除に失敗しました',
    };
  }
}

/**
 * ユーザーのセッションを強制終了
 */
export async function terminateUserSessions(userId: string) {
  try {
    const adminUserId = await checkAdminPermission();

    // すべてのセッションを削除
    const result = await prisma.session.deleteMany({
      where: { userId },
    });

    // 監査ログを記録
    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'USER_DELETE',
        entityType: 'sessions',
        entityId: userId,
        metadata: {
          action: 'terminate_all_sessions',
          sessionsDeleted: result.count,
        },
      },
    });

    logger.info('User sessions terminated', {
      adminUserId,
      targetUserId: userId,
      sessionsDeleted: result.count,
    });

    return {
      success: true,
      message: `${result.count}個のセッションを終了しました`,
    };
  } catch (error) {
    if (error instanceof AppError) {
      logger.logAppError(error);
      return {
        success: false,
        error: error.userMessage || 'セッションの終了に失敗しました',
      };
    }

    logger.error('Failed to terminate sessions', error);
    return {
      success: false,
      error: 'セッションの終了に失敗しました',
    };
  }
}

/**
 * ユーザーのパスワードをリセット
 */
export async function resetUserPassword(userId: string) {
  try {
    const adminUserId = await checkAdminPermission();

    // 一時パスワードを生成
    const tempPassword = Math.random().toString(36).slice(-12) + 'Aa1!';

    // パスワードをハッシュ化
    const { hash } = await import('bcryptjs');
    const hashedPassword = await hash(tempPassword, 10);

    // パスワードを更新
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        updatedAt: new Date(),
      },
      select: {
        email: true,
        name: true,
      },
    });

    // パスワードリセットトークンを生成（実装は省略）
    // TODO: パスワードリセットメールを送信

    // 監査ログを記録
    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'USER_UPDATE',
        entityType: 'password',
        entityId: userId,
        metadata: {
          action: 'admin_password_reset',
        },
      },
    });

    logger.info('User password reset', {
      adminUserId,
      targetUserId: userId,
    });

    return {
      success: true,
      message: `${user.email} に一時パスワードを設定しました`,
      tempPassword, // 実際の実装では、メールで送信して画面には表示しない
    };
  } catch (error) {
    if (error instanceof AppError) {
      logger.logAppError(error);
      return {
        success: false,
        error: error.userMessage || 'パスワードのリセットに失敗しました',
      };
    }

    logger.error('Failed to reset password', error);
    return {
      success: false,
      error: 'パスワードのリセットに失敗しました',
    };
  }
}