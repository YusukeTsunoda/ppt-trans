'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface FileRecord {
  id: string;
  filename: string;
  original_name: string;
  file_size: number;
  status: string;
  extracted_data?: {
    translated_path?: string;
    slide_count?: number;
    translation_completed_at?: string;
    error?: string;
    [key: string]: any;
  };
  created_at: string;
}

interface UseFilePollingOptions {
  userId: string;
  interval?: number; // ポーリング間隔（ミリ秒）
  enabled?: boolean; // ポーリングの有効/無効
}

export function useFilePolling({ 
  userId, 
  interval = 5000, // デフォルト5秒
  enabled = true 
}: UseFilePollingOptions) {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const fetchFiles = useCallback(async () => {
    if (!userId || !enabled) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from('files')
        .select(`
          id,
          filename,
          original_name,
          file_size,
          status,
          created_at,
          extracted_data
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (fetchError) {
        throw fetchError;
      }

      if (data) {
        setFiles(data);
      }
    } catch (err) {
      console.error('Error fetching files:', err);
      setError(err instanceof Error ? err.message : 'ファイルの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [userId, enabled, supabase]);

  // 初回とポーリング
  useEffect(() => {
    if (!enabled || !userId) return;

    // 初回取得
    fetchFiles();

    // ポーリング設定
    const intervalId = setInterval(fetchFiles, interval);

    // クリーンアップ
    return () => {
      clearInterval(intervalId);
    };
  }, [fetchFiles, interval, enabled, userId]);

  // リアルタイムサブスクリプション（オプション）
  useEffect(() => {
    if (!enabled || !userId) return;

    // Supabaseのリアルタイム機能を使用
    const channel = supabase
      .channel('files-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE全て監視
          schema: 'public',
          table: 'files',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('File change detected:', payload);
          
          // 変更を検知したらすぐに再取得
          fetchFiles();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, enabled, supabase, fetchFiles]);

  // 手動リフレッシュ
  const refresh = useCallback(() => {
    fetchFiles();
    router.refresh();
  }, [fetchFiles, router]);

  // ファイル削除
  const deleteFile = useCallback(async (fileId: string) => {
    try {
      const { error } = await supabase
        .from('files')
        .delete()
        .eq('id', fileId)
        .eq('user_id', userId);

      if (error) throw error;

      // ローカル状態を即座に更新（オプティミスティック更新）
      setFiles(prev => prev.filter(f => f.id !== fileId));
    } catch (err) {
      console.error('Error deleting file:', err);
      throw err;
    }
  }, [userId, supabase]);

  return {
    files,
    loading,
    error,
    refresh,
    deleteFile,
  };
}