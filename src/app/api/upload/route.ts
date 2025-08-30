import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@/lib/supabase/server';
import { CSRFProtection } from '@/lib/security/csrf';
import { OriginValidator } from '@/lib/security/origin-validator';
import { AdvancedRateLimiter } from '@/lib/security/advanced-rate-limiter';
import { SessionManager } from '@/lib/security/session-manager';

const rateLimiter = new AdvancedRateLimiter();

// Maximum file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Allowed file extensions
const ALLOWED_EXTENSIONS = ['.ppt', '.pptx'];

export async function POST(request: NextRequest) {
  try {
    // Security checks
    const csrfValid = await CSRFProtection.verifyToken(request);
    if (!csrfValid) {
      return NextResponse.json(
        { error: 'CSRFトークンが無効です' },
        { status: 403 }
      );
    }

    const originValid = OriginValidator.validate(request);
    if (!originValid) {
      return NextResponse.json(
        { error: 'オリジンが無効です' },
        { status: 403 }
      );
    }

    // Rate limiting
    const rateLimit = await rateLimiter.check(request, {
      max: 10,
      windowMs: 15 * 60 * 1000, // 15 minutes
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'アップロード制限に達しました。しばらくお待ちください。' },
        { 
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfter),
          }
        }
      );
    }

    // Session validation
    const sessionData = await SessionManager.validateSession(request);
    if (!sessionData) {
      return NextResponse.json(
        { error: 'ログインが必要です' },
        { status: 401 }
      );
    }

    // Get form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'ファイルが選択されていません' },
        { status: 400 }
      );
    }

    // Validate file extension
    const fileExt = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
      return NextResponse.json(
        { error: 'PowerPointファイル（.ppt, .pptx）のみアップロード可能です' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'ファイルサイズは50MB以下にしてください' },
        { status: 400 }
      );
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Generate unique filename
    const uniqueId = uuidv4();
    const fileName = `${uniqueId}${fileExt}`;
    const filePath = path.join(uploadsDir, fileName);

    // Save file to disk
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Save file info to database
    const supabase = await createClient();
    
    const { data: fileRecord, error: dbError } = await supabase
      .from('files')
      .insert({
        user_id: sessionData.userId,
        original_name: file.name,
        file_path: fileName,
        file_size: file.size,
        status: 'pending',
      })
      .select()
      .single();

    if (dbError) {
      // Clean up uploaded file if DB insert fails
      const fs = await import('fs/promises');
      await fs.unlink(filePath).catch(() => {});
      
      return NextResponse.json(
        { error: 'ファイル情報の保存に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      fileId: fileRecord.id,
      fileName: file.name,
      message: 'ファイルがアップロードされました',
    });

  } catch (error) {
    console.error('Upload error:', error);
    
    return NextResponse.json(
      { error: 'ファイルのアップロードに失敗しました' },
      { status: 500 }
    );
  }
}