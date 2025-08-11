import { z } from 'zod';
import { XSSProtection, InputValidator } from '@/lib/security/xss';

/**
 * カスタム変換関数
 */
const sanitizeString = (val: string) => XSSProtection.sanitizeString(val);

/**
 * 基本的な型定義
 */
export const emailSchema = z
  .string()
  .email('有効なメールアドレスを入力してください')
  .max(254, 'メールアドレスは254文字以内で入力してください')
  .transform(sanitizeString)
  .refine(InputValidator.isValidEmail, {
    message: 'メールアドレスの形式が正しくありません',
  });

export const passwordSchema = z
  .string()
  .min(8, 'パスワードは8文字以上で入力してください')
  .max(128, 'パスワードは128文字以内で入力してください')
  .refine((password) => {
    const result = InputValidator.isValidPassword(password);
    return result.valid;
  }, {
    message: 'パスワードは大文字、小文字、数字、特殊文字を含む必要があります',
  });

export const usernameSchema = z
  .string()
  .min(3, 'ユーザー名は3文字以上で入力してください')
  .max(30, 'ユーザー名は30文字以内で入力してください')
  .transform(sanitizeString)
  .refine(InputValidator.isValidUsername, {
    message: 'ユーザー名は英数字、ハイフン、アンダースコアのみ使用できます',
  });

export const urlSchema = z
  .string()
  .url('有効なURLを入力してください')
  .refine(InputValidator.isValidURL, {
    message: 'HTTPまたはHTTPSのURLを入力してください',
  })
  .transform((url) => XSSProtection.sanitizeURL(url) || '');

/**
 * 認証関連のスキーマ
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'パスワードを入力してください'),
  remember: z.boolean().optional(),
});

export const registerSchema = z.object({
  name: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  terms: z.boolean().refine((val) => val === true, {
    message: '利用規約に同意する必要があります',
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'パスワードが一致しません',
  path: ['confirmPassword'],
});

export const resetPasswordSchema = z.object({
  email: emailSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, '現在のパスワードを入力してください'),
  newPassword: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'パスワードが一致しません',
  path: ['confirmPassword'],
});

/**
 * ファイル関連のスキーマ
 */
export const fileUploadSchema = z.object({
  fileName: z
    .string()
    .max(255, 'ファイル名は255文字以内で入力してください')
    .transform((name) => XSSProtection.sanitizeFileName(name)),
  fileSize: z
    .number()
    .positive('ファイルサイズは正の数である必要があります')
    .max(100 * 1024 * 1024, 'ファイルサイズは100MB以内である必要があります'),
  mimeType: z
    .string()
    .refine((type) => {
      const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/x-zip-compressed',
      ];
      return allowedTypes.includes(type);
    }, {
      message: 'PowerPoint (.pptx) ファイルのみアップロード可能です',
    }),
});

/**
 * 翻訳関連のスキーマ
 */
export const translationRequestSchema = z.object({
  texts: z.array(
    z.object({
      id: z.string().transform(sanitizeString),
      originalText: z.string().max(10000, 'テキストは10000文字以内で入力してください'),
    })
  ).max(100, '一度に翻訳できるテキストは100個までです'),
  targetLanguage: z.enum([
    'Japanese',
    'English',
    'Chinese',
    'Korean',
    'Spanish',
    'French',
    'German',
  ]),
  model: z.enum(['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku']).optional(),
});

/**
 * プロフィール更新スキーマ
 */
export const profileUpdateSchema = z.object({
  name: usernameSchema.optional(),
  email: emailSchema.optional(),
  bio: z
    .string()
    .max(500, '自己紹介は500文字以内で入力してください')
    .transform(sanitizeString)
    .optional(),
  website: urlSchema.optional(),
  company: z
    .string()
    .max(100, '会社名は100文字以内で入力してください')
    .transform(sanitizeString)
    .optional(),
});

/**
 * 検索・フィルタリングスキーマ
 */
export const searchSchema = z.object({
  query: z
    .string()
    .max(100, '検索クエリは100文字以内で入力してください')
    .transform(sanitizeString),
  page: z
    .number()
    .int()
    .positive()
    .default(1),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20),
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'name', 'size'])
    .optional(),
  sortOrder: z
    .enum(['asc', 'desc'])
    .optional(),
  filters: z
    .record(z.string(), z.any())
    .optional(),
});

/**
 * 管理者用スキーマ
 */
export const userManagementSchema = z.object({
  userId: z.string().uuid('有効なユーザーIDを指定してください'),
  action: z.enum(['activate', 'deactivate', 'delete', 'changeRole']),
  role: z.enum(['USER', 'ADMIN', 'SUPER_ADMIN']).optional(),
  reason: z
    .string()
    .max(500, '理由は500文字以内で入力してください')
    .transform(sanitizeString)
    .optional(),
});

/**
 * 設定スキーマ
 */
export const settingsSchema = z.object({
  notifications: z.object({
    email: z.boolean(),
    push: z.boolean(),
    sms: z.boolean().optional(),
  }),
  privacy: z.object({
    profileVisibility: z.enum(['public', 'private', 'friends']),
    showEmail: z.boolean(),
    allowMessages: z.boolean(),
  }),
  language: z.enum(['ja', 'en', 'zh', 'ko']),
  timezone: z.string(),
  theme: z.enum(['light', 'dark', 'system']),
});

/**
 * APIレスポンススキーマ
 */
export const apiResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z
      .object({
        code: z.string(),
        message: z.string(),
        details: z.any().optional(),
      })
      .optional(),
    metadata: z
      .object({
        timestamp: z.string().datetime(),
        version: z.string(),
        requestId: z.string().optional(),
      })
      .optional(),
  });

/**
 * ページネーションスキーマ
 */
export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().min(1).max(100).default(20),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

/**
 * バリデーションヘルパー関数
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, errors: result.error };
  }
}

/**
 * エラーメッセージのフォーマット
 */
export function formatValidationErrors(errors: z.ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};
  
  for (const error of errors.issues) {
    const path = error.path.join('.');
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(error.message);
  }
  
  return formatted;
}