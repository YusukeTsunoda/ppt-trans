/**
 * 共通ダウンロードユーティリティ
 * 重複していたダウンロードロジックを統合
 */

interface DownloadOptions {
  url: string;
  fileName: string;
  onProgress?: (progress: number) => void;
  onError?: (error: Error) => void;
}

/**
 * ファイルをダウンロードする共通関数
 * Supabase URLとその他のURLの両方に対応
 */
export async function downloadFile({
  url,
  fileName,
  onProgress,
  onError
}: DownloadOptions): Promise<boolean> {
  try {
    // ファイル名の正規化（.pptx拡張子の確認）
    const normalizedFileName = fileName.endsWith('.pptx') 
      ? fileName 
      : `${fileName}.pptx`;

    console.log('Downloading file from:', url);

    // Supabase URLの場合、fetchを試みる
    if (url.includes('supabase')) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/vnd.openxmlformats-officedocument.presentationml.presentation, application/octet-stream'
          }
        });

        if (response.ok) {
          // プログレス追跡が可能な場合
          const contentLength = response.headers.get('content-length');
          if (contentLength && onProgress) {
            const total = parseInt(contentLength, 10);
            let loaded = 0;

            const reader = response.body?.getReader();
            const chunks: Uint8Array[] = [];

            if (reader) {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                chunks.push(value);
                loaded += value.length;
                onProgress(loaded / total);
              }

              const blob = new Blob(chunks as BlobPart[]);
              return downloadBlob(blob, normalizedFileName);
            }
          }

          // プログレス追跡なしの通常ダウンロード
          const blob = await response.blob();
          return downloadBlob(blob, normalizedFileName);
        }
      } catch (fetchError) {
        console.log('Fetch download failed, trying direct link...', fetchError);
      }
    }

    // 直接リンクでダウンロード（CORS エラーの場合や他のURL）
    return downloadViaAnchor(url, normalizedFileName);

  } catch (error) {
    console.error('Download error:', error);
    if (onError) {
      onError(error instanceof Error ? error : new Error('Download failed'));
    }
    return false;
  }
}

/**
 * Blobオブジェクトをダウンロード
 */
function downloadBlob(blob: Blob, fileName: string): boolean {
  try {
    const downloadUrl = window.URL.createObjectURL(blob);
    const success = downloadViaAnchor(downloadUrl, fileName);
    
    // メモリリークを防ぐためURLを解放
    setTimeout(() => {
      window.URL.revokeObjectURL(downloadUrl);
    }, 100);
    
    return success;
  } catch (error) {
    console.error('Blob download error:', error);
    return false;
  }
}

/**
 * アンカー要素を使用したダウンロード
 */
function downloadViaAnchor(url: string, fileName: string): boolean {
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.style.display = 'none';
    
    // 一部のブラウザではtarget="_blank"が必要
    if (url.includes('http')) {
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
    }
    
    document.body.appendChild(anchor);
    anchor.click();
    
    // クリーンアップ
    setTimeout(() => {
      document.body.removeChild(anchor);
    }, 100);
    
    console.log('Download initiated successfully');
    return true;
  } catch (error) {
    console.error('Anchor download error:', error);
    return false;
  }
}

/**
 * 複数ファイルの一括ダウンロード
 */
export async function downloadMultipleFiles(
  files: Array<{ url: string; fileName: string }>,
  onProgress?: (current: number, total: number) => void
): Promise<{ successful: string[]; failed: string[] }> {
  const results = {
    successful: [] as string[],
    failed: [] as string[]
  };

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (onProgress) {
      onProgress(i + 1, files.length);
    }

    const success = await downloadFile({
      url: file.url,
      fileName: file.fileName
    });

    if (success) {
      results.successful.push(file.fileName);
    } else {
      results.failed.push(file.fileName);
    }

    // ダウンロード間に短い遅延を入れる
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
}

/**
 * ダウンロード可能かチェック
 */
export async function isDownloadable(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'HEAD'
    });
    return response.ok;
  } catch {
    // HEADリクエストが失敗しても、GETで試せる可能性がある
    return true;
  }
}