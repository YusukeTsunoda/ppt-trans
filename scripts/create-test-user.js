const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createTestUser() {
  try {
    const hashedPassword = await bcrypt.hash('test123', 10);
    
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        username: 'testuser',
        password: hashedPassword,
        name: 'Test User',
        isActive: true,
      },
    });
    
    console.log('Test user created:', user);
    
    // Create usage limit for the user
    await prisma.usageLimit.create({
      data: {
        userId: user.id,
        monthlyFileLimit: 100,
        maxFileSize: 10485760, // 10MB
        currentMonthFiles: 0,
        resetDate: new Date(),
      },
    });
    
    console.log('Usage limit created for test user');
  } catch (error) {
    console.error('Error creating test user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();