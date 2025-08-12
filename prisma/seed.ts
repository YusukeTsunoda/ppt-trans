import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 シードデータの投入を開始します...');

  // 既存のデータをクリア（開発環境のみ）
  if (process.env.NODE_ENV !== 'production') {
    console.log('既存データをクリアしています...');
    await prisma.auditLog.deleteMany();
    await prisma.translation.deleteMany();
    await prisma.file.deleteMany();
    await prisma.session.deleteMany();
    await prisma.userSettings.deleteMany();
    await prisma.user.deleteMany();
  }

  // 管理者ユーザーの作成
  const adminPassword = await bcrypt.hash('Admin123!', 12);
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      username: 'admin',
      password: adminPassword,  // passwordHashからpasswordに変更
      role: Role.ADMIN,
      isActive: true,
      settings: {
        create: {
          translationModel: 'claude-3-haiku-20240307',
          targetLanguage: 'Japanese',
          batchSize: 5,
          autoSave: true,
          theme: 'light'
        }
      }
    }
  });

  console.log('✅ 管理者ユーザーを作成しました:');
  console.log('   Email: admin@example.com');
  console.log('   Username: admin');
  console.log('   Password: Admin123!');
  console.log('   Role: ADMIN');

  // 一般ユーザー1の作成
  const user1Password = await bcrypt.hash('User123!', 12);
  const user1 = await prisma.user.create({
    data: {
      email: 'user1@example.com',
      username: 'testuser1',
      password: user1Password,  // passwordHashからpasswordに変更
      role: Role.USER,
      isActive: true,
      settings: {
        create: {
          translationModel: 'claude-3-haiku-20240307',
          targetLanguage: 'Japanese',
          batchSize: 5,
          autoSave: true,
          theme: 'light'
        }
      }
    }
  });

  console.log('\n✅ 一般ユーザー1を作成しました:');
  console.log('   Email: user1@example.com');
  console.log('   Username: testuser1');
  console.log('   Password: User123!');
  console.log('   Role: USER');

  // 一般ユーザー2の作成
  const user2Password = await bcrypt.hash('User456!', 12);
  const user2 = await prisma.user.create({
    data: {
      email: 'user2@example.com',
      username: 'testuser2',
      password: user2Password,  // passwordHashからpasswordに変更
      role: Role.USER,
      isActive: true,
      settings: {
        create: {
          translationModel: 'claude-3-5-sonnet-20241022',
          targetLanguage: 'English',
          batchSize: 10,
          autoSave: false,
          theme: 'dark'
        }
      }
    }
  });

  console.log('\n✅ 一般ユーザー2を作成しました:');
  console.log('   Email: user2@example.com');
  console.log('   Username: testuser2');
  console.log('   Password: User456!');
  console.log('   Role: USER');

  // サンプルファイルデータの作成（オプション）
  const sampleFile1 = await prisma.file.create({
    data: {
      userId: user1.id,
      fileName: 'sample_presentation.pptx',
      originalFileUrl: '/samples/sample1.pptx',
      fileSize: 1024000,
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      status: 'COMPLETED',
      processedAt: new Date(),
      totalSlides: 10,
      sourceLanguage: 'English',
      targetLanguage: 'Japanese',
      translationModel: 'claude-3-haiku-20240307'
    }
  });

  const sampleFile2 = await prisma.file.create({
    data: {
      userId: user2.id,
      fileName: 'business_report.pptx',
      originalFileUrl: '/samples/sample2.pptx',
      fileSize: 2048000,
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      status: 'COMPLETED',
      processedAt: new Date(),
      totalSlides: 15,
      sourceLanguage: 'Japanese',
      targetLanguage: 'English',
      translationModel: 'claude-3-5-sonnet-20241022'
    }
  });

  // 監査ログの作成
  await prisma.auditLog.createMany({
    data: [
      {
        userId: adminUser.id,
        action: 'USER_CREATE',
        entityType: 'user',
        entityId: adminUser.id,
        metadata: { email: adminUser.email }
      },
      {
        userId: user1.id,
        action: 'LOGIN',
        entityType: 'session',
        metadata: { method: 'credentials' }
      },
      {
        userId: user1.id,
        action: 'FILE_UPLOAD',
        entityType: 'file',
        entityId: sampleFile1.id,
        metadata: { fileName: sampleFile1.fileName }
      },
      {
        userId: user2.id,
        action: 'LOGIN',
        entityType: 'session',
        metadata: { method: 'credentials' }
      },
      {
        userId: user2.id,
        action: 'FILE_UPLOAD',
        entityType: 'file',
        entityId: sampleFile2.id,
        metadata: { fileName: sampleFile2.fileName }
      }
    ]
  });

  console.log('\n✅ サンプルファイルと監査ログを作成しました');
  console.log('\n🎉 シードデータの投入が完了しました！');
}

main()
  .catch((e) => {
    console.error('エラー:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });