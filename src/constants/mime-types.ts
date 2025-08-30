/**
 * MIMEタイプ定義の中央管理
 */

export const ALLOWED_MIME_TYPES = {
  PPTX: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  PPT: 'application/vnd.ms-powerpoint',
} as const;

export const ALLOWED_MIME_TYPES_ARRAY = Object.values(ALLOWED_MIME_TYPES);

export const FILE_SIZE_LIMITS = {
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  MAX_FILE_SIZE_LABEL: '100MB',
} as const;

export const FILE_EXTENSIONS = {
  POWERPOINT: '.ppt,.pptx',
} as const;

/**
 * ファイルがPowerPointファイルかどうかを検証
 */
export function isPowerPointFile(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES_ARRAY.includes(mimeType as any);
}

/**
 * ファイルサイズが制限内かどうかを検証
 */
export function isFileSizeValid(size: number): boolean {
  return size <= FILE_SIZE_LIMITS.MAX_FILE_SIZE;
}