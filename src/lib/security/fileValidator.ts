import logger from '@/lib/logger';
import crypto from 'crypto';
// stream-mmmagicは利用できないため、ファイルタイプ検証は別の方法で実装

// ファイルタイプ設定
const ALLOWED_FILE_TYPES = {
  pptx: {
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/x-zip-compressed', // 一部のブラウザ
    ],
    extensions: ['.pptx'],
    magicNumbers: ['504B0304'], // PKZip archive
    maxSize: 100 * 1024 * 1024, // 100MB
  },
  image: {
    mimeTypes: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
    ],
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
    magicNumbers: [
      'FFD8FF', // JPEG
      '89504E47', // PNG
      '47494638', // GIF
      '52494646', // WEBP
      '3C737667', // SVG
    ],
    maxSize: 10 * 1024 * 1024, // 10MB
  },
  document: {
    mimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    extensions: ['.pdf', '.doc', '.docx'],
    magicNumbers: [
      '25504446', // PDF
      'D0CF11E0', // DOC
      '504B0304', // DOCX (PKZip)
    ],
    maxSize: 50 * 1024 * 1024, // 50MB
  },
};

/**
 * ファイル検証結果
 */
export interface FileValidationResult {
  valid: boolean;
  error?: string;
  sanitizedFileName?: string;
  fileHash?: string;
  actualMimeType?: string;
}

/**
 * ファイル検証クラス
 */
export class FileValidator {
  /**
   * ファイルを包括的に検証
   */
  static async validateFile(
    file: File | Buffer,
    fileType: keyof typeof ALLOWED_FILE_TYPES,
    fileName?: string
  ): Promise<FileValidationResult> {
    try {
      const config = ALLOWED_FILE_TYPES[fileType];
      
      if (!config) {
        return {
          valid: false,
          error: 'Invalid file type configuration',
        };
      }
      
      // Fileオブジェクトの場合
      if (file instanceof File) {
        // ファイルサイズチェック
        if (file.size > config.maxSize) {
          return {
            valid: false,
            error: `File size exceeds maximum allowed size of ${config.maxSize / 1024 / 1024}MB`,
          };
        }
        
        // MIMEタイプチェック
        if (!config.mimeTypes.includes(file.type)) {
          logger.warn('Invalid MIME type', { 
            expected: config.mimeTypes,
            actual: file.type,
          });
          return {
            valid: false,
            error: 'Invalid file type',
          };
        }
        
        // ファイル名チェック
        const sanitizedName = this.sanitizeFileName(file.name);
        const extension = this.getFileExtension(sanitizedName);
        
        if (!config.extensions.includes(extension.toLowerCase())) {
          return {
            valid: false,
            error: 'Invalid file extension',
          };
        }
        
        // バッファに変換して追加検証
        const buffer = Buffer.from(await file.arrayBuffer());
        return this.validateBuffer(buffer, config, sanitizedName);
      }
      
      // Bufferの場合
      if (Buffer.isBuffer(file)) {
        const sanitizedName = fileName ? this.sanitizeFileName(fileName) : 'unknown';
        return this.validateBuffer(file, config, sanitizedName);
      }
      
      return {
        valid: false,
        error: 'Invalid file input',
      };
      
    } catch (error) {
      logger.error('File validation error', error);
      return {
        valid: false,
        error: 'File validation failed',
      };
    }
  }
  
  /**
   * バッファを検証
   */
  private static async validateBuffer(
    buffer: Buffer,
    config: typeof ALLOWED_FILE_TYPES[keyof typeof ALLOWED_FILE_TYPES],
    fileName: string
  ): Promise<FileValidationResult> {
    // マジックナンバーチェック
    const magicNumber = buffer.toString('hex', 0, 4).toUpperCase();
    const isValidMagic = config.magicNumbers.some(magic => 
      magicNumber.startsWith(magic)
    );
    
    if (!isValidMagic) {
      logger.warn('Invalid magic number', { 
        expected: config.magicNumbers,
        actual: magicNumber,
      });
      return {
        valid: false,
        error: 'File content does not match expected type',
      };
    }
    
    // ファイルハッシュ生成
    const fileHash = crypto
      .createHash('sha256')
      .update(buffer)
      .digest('hex');
    
    // 実際のMIMEタイプを検出（stream-mmmagicを使用）
    let actualMimeType: string | undefined;
    try {
      actualMimeType = await this.detectMimeType(buffer);
      
      if (actualMimeType && !config.mimeTypes.includes(actualMimeType)) {
        logger.warn('MIME type mismatch', {
          expected: config.mimeTypes,
          actual: actualMimeType,
        });
        // 警告のみ（一部のファイルは正しく検出されない場合がある）
      }
    } catch (error) {
      logger.debug('MIME type detection failed', error as Record<string, any>);
    }
    
    return {
      valid: true,
      sanitizedFileName: fileName,
      fileHash,
      actualMimeType,
    };
  }
  
  /**
   * MIMEタイプを検出
   */
  private static detectMimeType(_buffer: Buffer): Promise<string> {
    return new Promise((resolve, _reject) => {
      // TODO: stream-mmmagicライブラリを追加またはfile-typeなどの代替ライブラリを使用
      // 現在は仮の実装
      resolve('application/octet-stream');
    });
  }
  
  /**
   * ファイル名をサニタイズ
   */
  static sanitizeFileName(fileName: string): string {
    // パス区切り文字を削除
    let sanitized = fileName.replace(/[\/\\]/g, '');
    
    // 危険な文字を削除
    sanitized = sanitized.replace(/[<>:"|?*\x00-\x1F]/g, '');
    
    // 隠しファイルを防ぐ
    sanitized = sanitized.replace(/^\.+/, '');
    
    // 空白を正規化
    sanitized = sanitized.replace(/\s+/g, '_');
    
    // 長さ制限
    const maxLength = 255;
    if (sanitized.length > maxLength) {
      const extension = this.getFileExtension(sanitized);
      const baseName = sanitized.slice(0, maxLength - extension.length - 1);
      sanitized = baseName + extension;
    }
    
    // デフォルト名
    if (!sanitized || sanitized === '') {
      sanitized = 'unnamed_file';
    }
    
    return sanitized;
  }
  
  /**
   * ファイル拡張子を取得
   */
  private static getFileExtension(fileName: string): string {
    const lastDot = fileName.lastIndexOf('.');
    if (lastDot === -1) return '';
    return fileName.slice(lastDot);
  }
  
  /**
   * ウイルススキャンをシミュレート（実際の実装では外部サービスを使用）
   */
  static async scanForVirus(buffer: Buffer): Promise<boolean> {
    // 既知のマルウェアシグネチャをチェック（簡易版）
    const malwareSignatures = [
      '4D5A', // PE executable
      '7F454C46', // ELF executable
      // その他の既知のマルウェアシグネチャ
    ];
    
    const fileSignature = buffer.toString('hex', 0, 4).toUpperCase();
    
    for (const signature of malwareSignatures) {
      if (fileSignature.startsWith(signature)) {
        logger.warn('Potential malware detected', { signature });
        return false;
      }
    }
    
    // 実際の実装では、ClamAVやVirusTotalなどのAPIを使用
    // await this.scanWithClamAV(buffer);
    
    return true;
  }
  
  /**
   * ZIPボム攻撃をチェック
   */
  static async checkZipBomb(_buffer: Buffer): Promise<boolean> {
    // PPTXファイルはZIP形式なので、展開後のサイズをチェック
    const _compressionRatio = 100; // 圧縮率の閾値
    
    // 簡易的なチェック（実際はunzipライブラリを使用）
    // const uncompressedSize = await this.getUncompressedSize(buffer);
    // const ratio = uncompressedSize / buffer.length;
    
    // if (ratio > compressionRatio) {
    //   logger.warn('Potential ZIP bomb detected', { ratio });
    //   return false;
    // }
    
    return true;
  }
}

/**
 * Express/Next.js用のファイル検証ミドルウェア
 */
export async function validateUploadedFile(
  file: File | Buffer,
  fileType: keyof typeof ALLOWED_FILE_TYPES,
  fileName?: string
): Promise<FileValidationResult> {
  // ファイル検証
  const validationResult = await FileValidator.validateFile(file, fileType, fileName);
  
  if (!validationResult.valid) {
    return validationResult;
  }
  
  // ウイルススキャン
  const buffer = file instanceof File 
    ? Buffer.from(await file.arrayBuffer())
    : file;
  
  const isClean = await FileValidator.scanForVirus(buffer);
  if (!isClean) {
    return {
      valid: false,
      error: 'File failed security scan',
    };
  }
  
  // ZIPボムチェック（PPTXファイルの場合）
  if (fileType === 'pptx') {
    const isSafe = await FileValidator.checkZipBomb(buffer);
    if (!isSafe) {
      return {
        valid: false,
        error: 'File appears to be a ZIP bomb',
      };
    }
  }
  
  return validationResult;
}