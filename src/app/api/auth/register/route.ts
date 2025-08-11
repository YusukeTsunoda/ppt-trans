import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const registerSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  username: z.string().min(3, 'ユーザー名は3文字以上にしてください').max(30, 'ユーザー名は30文字以内にしてください'),
  password: z.string().min(8, 'パスワードは8文字以上にしてください').max(100, 'パスワードは100文字以内にしてください')
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate input
    const validatedData = registerSchema.parse(body);
    
    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: validatedData.email },
          { username: validatedData.username }
        ]
      }
    });
    
    if (existingUser) {
      if (existingUser.email === validatedData.email) {
        return NextResponse.json(
          { error: 'このメールアドレスは既に登録されています' },
          { status: 400 }
        );
      }
      if (existingUser.username === validatedData.username) {
        return NextResponse.json(
          { error: 'このユーザー名は既に使用されています' },
          { status: 400 }
        );
      }
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(validatedData.password, 12);
    
    // Create user
    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        username: validatedData.username,
        passwordHash,
        settings: {
          create: {
            translationModel: 'claude-3-haiku-20240307',
            targetLanguage: 'Japanese',
            batchSize: 5,
            autoSave: true,
            theme: 'light'
          }
        }
      },
      select: {
        id: true,
        email: true,
        username: true,
        createdAt: true
      }
    });
    
    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'USER_CREATE',
        entityType: 'user',
        entityId: user.id,
        metadata: {
          email: user.email,
          username: user.username
        }
      }
    });
    
    return NextResponse.json({
      message: 'ユーザー登録が完了しました',
      user: {
        id: user.id,
        email: user.email,
        username: user.username
      }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'ユーザー登録に失敗しました' },
      { status: 500 }
    );
  }
}