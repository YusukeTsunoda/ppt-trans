/**
 * Supabaseクライアントの中央管理
 * 重複初期化を防ぎ、単一のインスタンスを提供
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

/**
 * 環境変数の検証
 */
function validateEnvironmentVariables(): { url: string; key: string } {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }

  if (!supabaseKey) {
    throw new Error('Missing Supabase key environment variable');
  }

  return { url: supabaseUrl, key: supabaseKey };
}

/**
 * Supabaseクライアントのシングルトンインスタンスを取得
 * @param forceNew 新しいインスタンスを強制的に作成するか
 */
export function getSupabaseClient(forceNew = false): SupabaseClient {
  if (!supabaseInstance || forceNew) {
    const { url, key } = validateEnvironmentVariables();
    
    supabaseInstance = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          'x-application-name': 'pptx-translator'
        }
      }
    });

    console.log('Supabase client initialized');
  }

  return supabaseInstance;
}

/**
 * サーバーサイド専用のSupabaseクライアント
 * Service Role Keyを使用
 */
export function getSupabaseAdminClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase admin credentials');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });
}

/**
 * ストレージバケットの存在確認と作成
 */
export async function ensureStorageBucket(
  bucketName: string,
  isPublic = false
): Promise<boolean> {
  const supabase = getSupabaseClient();

  try {
    // バケットの存在確認
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('Error listing buckets:', listError);
      return false;
    }

    const bucketExists = buckets?.some(bucket => bucket.name === bucketName);

    if (!bucketExists) {
      // バケットを作成
      const { error: createError } = await supabase.storage.createBucket(bucketName, {
        public: isPublic,
        fileSizeLimit: 52428800, // 50MB
        allowedMimeTypes: [
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'application/octet-stream',
          'image/png',
          'image/jpeg'
        ]
      });

      if (createError && !createError.message.includes('already exists')) {
        console.error('Error creating bucket:', createError);
        return false;
      }

      console.log(`Bucket '${bucketName}' created successfully`);
    }

    return true;
  } catch (error) {
    console.error('Error ensuring bucket:', error);
    return false;
  }
}

/**
 * ファイルアップロードのヘルパー関数
 */
export async function uploadToSupabase(
  bucketName: string,
  path: string,
  file: Buffer | Blob | File,
  contentType?: string
): Promise<{ url: string | null; error: Error | null }> {
  const supabase = getSupabaseClient();

  try {
    // バケットの確認/作成
    await ensureStorageBucket(bucketName);

    // ファイルのアップロード
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(path, file, {
        contentType: contentType || 'application/octet-stream',
        upsert: true,
        cacheControl: '3600'
      });

    if (error) {
      return { url: null, error };
    }

    // 公開URLの取得
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(path);

    return { url: urlData.publicUrl, error: null };
  } catch (error) {
    return { 
      url: null, 
      error: error instanceof Error ? error : new Error('Upload failed') 
    };
  }
}

/**
 * ファイル削除のヘルパー関数
 */
export async function deleteFromSupabase(
  bucketName: string,
  paths: string[]
): Promise<{ success: boolean; error: Error | null }> {
  const supabase = getSupabaseClient();

  try {
    const { error } = await supabase.storage
      .from(bucketName)
      .remove(paths);

    if (error) {
      return { success: false, error };
    }

    return { success: true, error: null };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error : new Error('Delete failed') 
    };
  }
}

/**
 * 一時ファイルのクリーンアップ
 * 24時間以上経過したファイルを削除
 */
export async function cleanupOldFiles(bucketName: string): Promise<void> {
  const supabase = getSupabaseClient();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  try {
    const { data: files, error } = await supabase.storage
      .from(bucketName)
      .list('', {
        limit: 1000,
        offset: 0
      });

    if (error) {
      console.error('Error listing files for cleanup:', error);
      return;
    }

    const filesToDelete = files
      ?.filter(file => {
        const createdAt = new Date(file.created_at);
        return createdAt < oneDayAgo;
      })
      .map(file => file.name) || [];

    if (filesToDelete.length > 0) {
      await deleteFromSupabase(bucketName, filesToDelete);
      console.log(`Cleaned up ${filesToDelete.length} old files`);
    }
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}