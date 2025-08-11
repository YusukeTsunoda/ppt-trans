import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../../../lib/supabaseClient';
import type { SlideData, ProcessingResult } from '@/types';
import { requireAuth, logUserAction } from '@/lib/auth-helpers';
import prisma from '@/lib/prisma';

type ProcessPptxResponse = ProcessingResult;

interface ProcessingError {
  error: string;
  details?: string;
}

export async function POST(request: NextRequest) {
  // Authenticate user
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const user = authResult;

  let tempDir: string | null = null;
  let tempPptxPath: string | null = null;

  try {
    // Parse the multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json<ProcessingError>(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.includes('presentationml.presentation')) {
      return NextResponse.json<ProcessingError>(
        { error: 'Invalid file type. Only .pptx files are supported.' },
        { status: 400 }
      );
    }

    // Create temporary directory for processing
    const tempId = uuidv4();
    tempDir = join(process.cwd(), 'tmp', tempId);
    await mkdir(tempDir, { recursive: true });

    // Save uploaded file to temporary location
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    tempPptxPath = join(tempDir, 'input.pptx');
    await writeFile(tempPptxPath, fileBuffer);

    // Upload original file to Supabase with user ID
    const originalFileName = `uploads/${user.id}/${tempId}.pptx`;
    
    // Check Supabase configuration
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('Supabase環境変数が設定されていません');
      // ローカルファイルシステムを使用
      console.log('Using local file system instead of Supabase');
      const localUrl = `/tmp/${tempId}/input.pptx`;
      
      // Skip Supabase upload and use local path
      const originalFileUrl = localUrl;
      
      // Process the PPTX file using Python script
      const processingResult = await processPptxWithPython(tempPptxPath, tempDir, tempId);
      
      // Return the processed data with local URLs
      const response: ProcessPptxResponse = {
        slides: processingResult.slides.map(slide => ({
          ...slide,
          originalFileUrl
        })),
        totalSlides: processingResult.slides.length
      };
      
      return NextResponse.json(response);
    }
    
    // Try to create bucket if it doesn't exist
    try {
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      
      if (listError) {
        console.error('Failed to list buckets:', listError);
        // Continue without checking bucket existence
      } else {
        const bucketExists = buckets?.some(bucket => bucket.name === 'pptx-files');
        
        if (!bucketExists) {
          console.log('Creating pptx-files bucket...');
          const { error: createError } = await supabase.storage.createBucket('pptx-files', {
            public: true,
            fileSizeLimit: 52428800, // 50MB
          });
          
          if (createError) {
            console.warn('Failed to create bucket (might already exist):', createError.message);
            // Continue anyway - bucket might already exist
          }
        }
      }
    } catch (bucketError) {
      console.warn('Bucket check/creation failed, continuing anyway:', bucketError);
    }
    
    // Now upload the file
    const { error: uploadError } = await supabase.storage
      .from('pptx-files')
      .upload(originalFileName, fileBuffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        upsert: true // Overwrite if exists
      });

    if (uploadError) {
      console.error('Upload error details:', uploadError);
      // Fallback to local processing
      console.log('Falling back to local processing');
      const localUrl = `/tmp/${tempId}/input.pptx`;
      
      const processingResult = await processPptxWithPython(tempPptxPath, tempDir, tempId);
      
      const response: ProcessPptxResponse = {
        slides: processingResult.slides.map(slide => ({
          ...slide,
          originalFileUrl: localUrl
        })),
        totalSlides: processingResult.slides.length
      };
      
      return NextResponse.json(response);
    }

    // Get public URL for the original file
    const { data: originalFileData } = supabase.storage
      .from('pptx-files')
      .getPublicUrl(originalFileName);

    const originalFileUrl = originalFileData.publicUrl;

    // Process the PPTX file using Python script
    const processingResult = await processPptxWithPython(tempPptxPath, tempDir, tempId);
    
    // Save file information to database
    const fileRecord = await prisma.file.create({
      data: {
        userId: user.id,
        fileName: file.name,
        originalFileUrl,
        fileSize: fileBuffer.length,
        mimeType: file.type,
        status: 'COMPLETED',
        processedAt: new Date(),
        totalSlides: processingResult.slides.length,
      }
    });

    // Log user action
    await logUserAction(
      user.id,
      'FILE_UPLOAD',
      'file',
      fileRecord.id,
      {
        fileName: file.name,
        fileSize: fileBuffer.length,
        slideCount: processingResult.slides.length
      }
    );
    
    // Return the processed data with file ID
    const response: ProcessPptxResponse = {
      slides: processingResult.slides.map(slide => ({
        ...slide,
        originalFileUrl
      })),
      totalSlides: processingResult.slides.length,
      fileName: file.name,
      processedAt: new Date().toISOString(),
      fileId: fileRecord.id
    };

    return NextResponse.json(response);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error processing PPTX:', error);
    return NextResponse.json<ProcessingError>(
      { 
        error: 'Failed to process PPTX file',
        details: errorMessage
      },
      { status: 500 }
    );
  } finally {
    // Cleanup temporary files
    if (tempPptxPath) {
      try {
        await unlink(tempPptxPath);
      } catch (e) {
        console.warn('Failed to clean up temporary PPTX file:', e);
      }
    }
    // Note: We'll keep the temp directory for now as Python might need it
    // In production, implement proper cleanup after Python processing is complete
  }
}

async function processPptxWithPython(
  pptxPath: string, 
  tempDir: string, 
  tempId: string
): Promise<{ slides: SlideData[] }> {
  return new Promise((resolve, reject) => {
    // Path to the Python processing script
    const pythonScriptPath = join(process.cwd(), 'scripts', 'process_pptx.py');
    
    // Spawn Python process using uv
    const pythonProcess = spawn('uv', ['run', 'python', pythonScriptPath, pptxPath, tempDir, tempId], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        SUPABASE_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      }
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python process exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        // Parse the JSON output from Python script
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (parseError) {
        reject(new Error(`Failed to parse Python output: ${parseError}`));
      }
    });

    pythonProcess.on('error', (error) => {
      reject(new Error(`Failed to start Python process: ${error.message}`));
    });

    // Set a timeout to prevent hanging
    setTimeout(() => {
      pythonProcess.kill('SIGTERM');
      reject(new Error('Python processing timeout'));
    }, 60000); // 60 seconds timeout
  });
}