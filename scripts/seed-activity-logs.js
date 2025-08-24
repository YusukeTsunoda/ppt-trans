const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedActivityLogs() {
  try {
    // 最初のユーザー（管理者）を取得
    const adminUser = await prisma.user.findFirst({
      where: { role: 'ADMIN' }
    });

    if (!adminUser) {
      console.log('No admin user found');
      return;
    }

    // サンプルのアクティビティログを作成
    const activities = [
      {
        userId: adminUser.id,
        action: 'LOGIN',
        targetType: 'user',
        targetId: adminUser.id,
        metadata: { loginMethod: 'credentials', ip: '192.168.1.1' }
      },
      {
        userId: adminUser.id,
        action: 'FILE_UPLOAD',
        targetType: 'file',
        targetId: 'file-001',
        metadata: { fileName: 'presentation.pptx', fileSize: 5242880 }
      },
      {
        userId: adminUser.id,
        action: 'FILE_TRANSLATE',
        targetType: 'translation',
        targetId: 'trans-001',
        metadata: { sourceLang: 'English', targetLang: 'Japanese', slideCount: 15 }
      },
      {
        userId: adminUser.id,
        action: 'SETTINGS_UPDATE',
        targetType: 'settings',
        targetId: adminUser.id,
        metadata: { changes: ['translationModel', 'theme'] }
      },
      {
        userId: adminUser.id,
        action: 'FILE_DOWNLOAD',
        targetType: 'file',
        targetId: 'file-001',
        metadata: { fileName: 'presentation_translated.pptx' }
      }
    ];

    console.log('Creating activity logs...');
    
    for (const activity of activities) {
      await prisma.activityLog.create({
        data: activity
      });
      console.log(`Created activity: ${activity.action}`);
    }

    const count = await prisma.activityLog.count();
    console.log(`\nTotal activity logs in database: ${count}`);

  } catch (error) {
    console.error('Error seeding activity logs:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedActivityLogs();