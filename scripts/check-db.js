const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    const userCount = await prisma.user.count();
    const activeUserCount = await prisma.user.count({ where: { isActive: true } });
    const fileCount = await prisma.file.count();
    const translationCount = await prisma.translation.count();
    const activityLogCount = await prisma.activityLog.count();
    
    console.log('Database Statistics:');
    console.log('===================');
    console.log(`Total Users: ${userCount}`);
    console.log(`Active Users: ${activeUserCount}`);
    console.log(`Total Files: ${fileCount}`);
    console.log(`Total Translations: ${translationCount}`);
    console.log(`Total Activity Logs: ${activityLogCount}`);
    
    // 最初の5人のユーザーを表示
    const users = await prisma.user.findMany({ take: 5 });
    console.log('\nFirst 5 Users:');
    users.forEach(user => {
      console.log(`- ${user.email} (${user.role}) - Active: ${user.isActive}`);
    });
    
    // 最初の5件のアクティビティログを表示
    const logs = await prisma.activityLog.findMany({ 
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { user: true }
    });
    console.log('\nRecent Activity Logs:');
    if (logs.length === 0) {
      console.log('No activity logs found');
    } else {
      logs.forEach(log => {
        console.log(`- ${log.action} by ${log.user.email} (${log.targetType || 'N/A'})`);
      });
    }
    
  } catch (error) {
    console.error('Error checking database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();