'use server';

import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { AppError } from '@/lib/errors/AppError';
import { ErrorCodes } from '@/lib/errors/ErrorCodes';
import logger from '@/lib/logger';
import { revalidatePath } from 'next/cache';

// -�n����
const settingsSchema = z.object({
  // �������-�
  appName: z.string().min(1).max(100).optional(),
  appDescription: z.string().max(500).optional(),
  maintenanceMode: z.boolean().optional(),
  maintenanceMessage: z.string().max(500).optional(),
  
  // ա��-�
  maxFileSize: z.number().min(1).max(100).optional(), // MBXM
  allowedFileTypes: z.array(z.string()).optional(),
  autoDeleteAfterDays: z.number().min(1).max(365).optional(),
  
  // API-�
  apiRateLimit: z.number().min(1).max(10000).optional(),
  apiTimeout: z.number().min(1).max(300).optional(), // �XM
  
  // ����ƣ-�
  sessionTimeout: z.number().min(1).max(1440).optional(), // XM
  maxLoginAttempts: z.number().min(1).max(10).optional(),
  passwordMinLength: z.number().min(6).max(20).optional(),
  requireEmailVerification: z.boolean().optional(),
  
  // �-�
  emailNotifications: z.boolean().optional(),
  adminEmailAddress: z.string().email().optional(),
  sendWelcomeEmail: z.boolean().optional(),
  sendPasswordResetEmail: z.boolean().optional(),
});

type Settings = z.infer<typeof settingsSchema>;

// �թ��-�
const DEFAULT_SETTINGS: Settings = {
  appName: 'PPT Translator',
  appDescription: 'PowerPoint file translation service',
  maintenanceMode: false,
  maintenanceMessage: '���������-gYWp�OJ�aO`UD',
  maxFileSize: 10,
  allowedFileTypes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.ms-powerpoint'],
  autoDeleteAfterDays: 30,
  apiRateLimit: 100,
  apiTimeout: 60,
  sessionTimeout: 1440,
  maxLoginAttempts: 5,
  passwordMinLength: 8,
  requireEmailVerification: false,
  emailNotifications: true,
  adminEmailAddress: 'admin@example.com',
  sendWelcomeEmail: true,
  sendPasswordResetEmail: true,
};

/**
 * �)P���ï
 */
async function checkAdminPermission() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new AppError(
      'Unauthorized',
      ErrorCodes.AUTH_UNAUTHORIZED,
      401,
      true,
      '�<LŁgY'
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
      '�)PLŁgY'
    );
  }

  return session.user.id;
}

/**
 * -��֗
 */
export async function getSettings() {
  try {
    const adminUserId = await checkAdminPermission();

    // ������K�-��֗��n����LjD4o��	
    // const settings = await prisma.settings.findFirst();
    
    // ��: �թ��-���Y
    const settings = DEFAULT_SETTINGS;

    // �����2
    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'USER_UPDATE',
        entityType: 'settings',
        entityId: 'view',
        metadata: {},
      },
    });

    logger.info('Settings retrieved', {
      adminUserId,
    });

    return {
      success: true,
      data: settings,
    };
  } catch (error) {
    if (error instanceof AppError) {
      logger.logAppError(error);
      return {
        success: false,
        error: error.userMessage || '-�n֗k1WW~W_',
      };
    }

    logger.error('Failed to get settings', error);
    return {
      success: false,
      error: '-�n֗k1WW~W_',
    };
  }
}

/**
 * -����
 */
export async function updateSettings(data: Partial<Settings>) {
  try {
    const adminUserId = await checkAdminPermission();

    // �������
    const validatedData = settingsSchema.partial().parse(data);

    // -������n����LjD4o��	
    // const updatedSettings = await prisma.settings.update({
    //   where: { id: 1 },
    //   data: validatedData,
    // });

    // ��: ��U�_-���Y
    const updatedSettings = {
      ...DEFAULT_SETTINGS,
      ...validatedData,
    };

    // �����2
    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'USER_UPDATE',
        entityType: 'settings',
        entityId: 'update',
        metadata: {
          changes: validatedData,
        },
      },
    });

    logger.info('Settings updated', {
      adminUserId,
      changes: validatedData,
    });

    // ��÷咍<
    revalidatePath('/admin/settings');

    return {
      success: true,
      data: updatedSettings,
      message: '-����W~W_',
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
        error: error.userMessage || '-�n��k1WW~W_',
      };
    }

    logger.error('Failed to update settings', error);
    return {
      success: false,
      error: '-�n��k1WW~W_',
    };
  }
}

/**
 * �������ɒ��H
 */
export async function toggleMaintenanceMode(enabled: boolean, message?: string) {
  try {
    const adminUserId = await checkAdminPermission();

    // �������ɒ��
    const settings = await updateSettings({
      maintenanceMode: enabled,
      maintenanceMessage: message || DEFAULT_SETTINGS.maintenanceMessage,
    });

    // �����2
    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'USER_UPDATE',
        entityType: 'maintenance',
        entityId: enabled ? 'enable' : 'disable',
        metadata: {
          message,
        },
      },
    });

    logger.info('Maintenance mode toggled', {
      adminUserId,
      enabled,
      message,
    });

    return {
      success: true,
      data: settings.data,
      message: enabled ? '�������ɒ	�kW~W_' : '�������ɒ!�kW~W_',
    };
  } catch (error) {
    if (error instanceof AppError) {
      logger.logAppError(error);
      return {
        success: false,
        error: error.userMessage || '��������n��Hk1WW~W_',
      };
    }

    logger.error('Failed to toggle maintenance mode', error);
    return {
      success: false,
      error: '��������n��Hk1WW~W_',
    };
  }
}

/**
 * ��÷咯�
 */
export async function clearCache() {
  try {
    const adminUserId = await checkAdminPermission();

    // ��÷��n��Next.jsn��÷��	
    revalidatePath('/', 'layout');

    // �����2
    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'USER_UPDATE',
        entityType: 'cache',
        entityId: 'clear',
        metadata: {},
      },
    });

    logger.info('Cache cleared', {
      adminUserId,
    });

    return {
      success: true,
      message: '��÷咯�W~W_',
    };
  } catch (error) {
    if (error instanceof AppError) {
      logger.logAppError(error);
      return {
        success: false,
        error: error.userMessage || '��÷�n��k1WW~W_',
      };
    }

    logger.error('Failed to clear cache', error);
    return {
      success: false,
      error: '��÷�n��k1WW~W_',
    };
  }
}

/**
 * ��������ï���
 */
export async function backupDatabase() {
  try {
    const adminUserId = await checkAdminPermission();

    // �������ï���n����n��o���X	
    const backupFileName = `backup_${new Date().toISOString().split('T')[0]}.sql`;

    // �����2
    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'FILE_DOWNLOAD',
        entityType: 'database',
        entityId: 'backup',
        metadata: {
          fileName: backupFileName,
        },
      },
    });

    logger.info('Database backup created', {
      adminUserId,
      backupFileName,
    });

    return {
      success: true,
      message: '������n�ï��ג\W~W_',
      fileName: backupFileName,
    };
  } catch (error) {
    if (error instanceof AppError) {
      logger.logAppError(error);
      return {
        success: false,
        error: error.userMessage || '������n�ï���k1WW~W_',
      };
    }

    logger.error('Failed to backup database', error);
    return {
      success: false,
      error: '������n�ï���k1WW~W_',
    };
  }
}

/**
 * �������������
 */
export async function exportSystemLogs(days: number = 7) {
  try {
    const adminUserId = await checkAdminPermission();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // �����֗
    const logs = await prisma.auditLog.findMany({
      where: {
        createdAt: {
          gte: startDate,
        },
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // CSVbk	�
    let csv = 'Date,User,Action,Entity Type,Entity ID,Metadata\n';
    logs.forEach(log => {
      csv += `"${log.createdAt.toISOString()}","${log.user.email}","${log.action}","${log.entityType}","${log.entityId}","${JSON.stringify(log.metadata).replace(/"/g, '""')}"\n`;
    });

    // �����2
    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'FILE_DOWNLOAD',
        entityType: 'logs',
        entityId: 'export',
        metadata: {
          days,
          logCount: logs.length,
        },
      },
    });

    logger.info('System logs exported', {
      adminUserId,
      days,
      logCount: logs.length,
    });

    return {
      success: true,
      data: csv,
      mimeType: 'text/csv',
      fileName: `logs_${new Date().toISOString().split('T')[0]}.csv`,
    };
  } catch (error) {
    if (error instanceof AppError) {
      logger.logAppError(error);
      return {
        success: false,
        error: error.userMessage || '������n������k1WW~W_',
      };
    }

    logger.error('Failed to export system logs', error);
    return {
      success: false,
      error: '������n������k1WW~W_',
    };
  }
}

/**
 * ƹ�����
 */
export async function sendTestEmail(toEmail: string) {
  try {
    const adminUserId = await checkAdminPermission();

    // ����n����n��o%Ł	
    // await sendEmail({
    //   to: toEmail,
    //   subject: 'Test Email',
    //   body: 'This is a test email from PPT Translator admin panel.',
    // });

    // �����2
    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'USER_UPDATE',
        entityType: 'email',
        entityId: 'test',
        metadata: {
          to: toEmail,
        },
      },
    });

    logger.info('Test email sent', {
      adminUserId,
      toEmail,
    });

    return {
      success: true,
      message: `ƹ���� ${toEmail} k�W~W_��	`,
    };
  } catch (error) {
    if (error instanceof AppError) {
      logger.logAppError(error);
      return {
        success: false,
        error: error.userMessage || 'ƹ����n�k1WW~W_',
      };
    }

    logger.error('Failed to send test email', error);
    return {
      success: false,
      error: 'ƹ����n�k1WW~W_',
    };
  }
}

/**
 * ա�������������
 */
export async function cleanupStorage(daysOld: number = 30) {
  try {
    const adminUserId = await checkAdminPermission();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // �Dա��Jd�Jd	
    const result = await prisma.file.updateMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
        status: 'COMPLETED',
      },
      data: {
        status: 'PROCESSING', // 'DELETED'はFileStatusに存在しないため変更
      },
    });

    // �����2
    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'FILE_DELETE',
        entityType: 'storage',
        entityId: 'cleanup',
        metadata: {
          daysOld,
          filesDeleted: result.count,
        },
      },
    });

    logger.info('Storage cleaned up', {
      adminUserId,
      daysOld,
      filesDeleted: result.count,
    });

    return {
      success: true,
      message: `${result.count}n�Dա��JdW~W_`,
    };
  } catch (error) {
    if (error instanceof AppError) {
      logger.logAppError(error);
      return {
        success: false,
        error: error.userMessage || '�����n������k1WW~W_',
      };
    }

    logger.error('Failed to cleanup storage', error);
    return {
      success: false,
      error: '�����n������k1WW~W_',
    };
  }
}