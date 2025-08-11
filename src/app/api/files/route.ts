import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import prisma from '@/lib/prisma';

export async function GET() {
  // Authenticate user
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const user = authResult;

  try {
    // Get user's files
    const files = await prisma.file.findMany({
      where: {
        userId: user.id
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        fileName: true,
        originalFileUrl: true,
        translatedFileUrl: true,
        fileSize: true,
        status: true,
        totalSlides: true,
        sourceLanguage: true,
        targetLanguage: true,
        createdAt: true,
        processedAt: true
      }
    });

    return NextResponse.json({ files });
  } catch (error) {
    console.error('Error fetching files:', error);
    return NextResponse.json(
      { error: 'ファイルの取得に失敗しました' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  // Authenticate user
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const user = authResult;

  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('id');

    if (!fileId) {
      return NextResponse.json(
        { error: 'ファイルIDが指定されていません' },
        { status: 400 }
      );
    }

    // Check if file belongs to user
    const file = await prisma.file.findFirst({
      where: {
        id: fileId,
        userId: user.id
      }
    });

    if (!file) {
      return NextResponse.json(
        { error: 'ファイルが見つかりません' },
        { status: 404 }
      );
    }

    // Delete file from database
    await prisma.file.delete({
      where: {
        id: fileId
      }
    });

    // Log action
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'FILE_DELETE',
        entityType: 'file',
        entityId: fileId,
        metadata: {
          fileName: file.fileName
        }
      }
    });

    return NextResponse.json({ message: 'ファイルを削除しました' });
  } catch (error) {
    console.error('Error deleting file:', error);
    return NextResponse.json(
      { error: 'ファイルの削除に失敗しました' },
      { status: 500 }
    );
  }
}