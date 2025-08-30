import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';

// メールアドレスの検証（RFC 5322準拠）
const emailSchema = z.string()
  .min(3, 'メールアドレスが短すぎます')
  .max(254, 'メールアドレスが長すぎます')
  .email('有効なメールアドレスを入力してください')
  .transform(email => email.toLowerCase().trim());

// パスワードの検証（NIST SP 800-63B準拠）
const passwordSchema = z.string()
  .min(8, 'パスワードは8文字以上必要です')
  .max(128, 'パスワードが長すぎます')
  .refine(password => {
    // 最低限の複雑性チェック
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    // 少なくとも3つのカテゴリを満たす必要がある
    const categoriesMet = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar]
      .filter(Boolean).length;
    
    return categoriesMet >= 3;
  }, 'パスワードは大文字、小文字、数字、特殊文字のうち3種類以上を含む必要があります')
  .refine(password => {
    // 連続する文字のチェック
    return !/(.)\1{2,}/.test(password);
  }, '同じ文字を3回以上連続で使用できません')
  .refine(password => {
    // 一般的な弱いパスワードのチェック
    const weakPasswords = [
      'password', '12345678', 'qwerty', 'abc123', 'password123',
      'admin', 'letmein', 'welcome', 'monkey', '1234567890'
    ];
    const lowerPassword = password.toLowerCase();
    return !weakPasswords.some(weak => lowerPassword.includes(weak));
  }, '一般的すぎるパスワードは使用できません');

// XSS対策のためのサニタイゼーション
export function sanitizeInput(input: string): string {
  // HTMLタグを完全に除去
  const cleaned = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // すべてのHTMLタグを削除
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true, // テキストコンテンツは保持
  });
  
  // 追加の安全対策
  return cleaned
    .replace(/javascript:/gi, '') // JavaScriptプロトコルを除去
    .replace(/on\w+=/gi, '') // イベントハンドラを除去
    .trim();
}

// SQLインジェクション対策（Supabase/Prismaを使用）
export function escapeSQL(input: string): string {
  // Supabase/Prismaはパラメータ化クエリを使用するため基本的に不要
  // ただし、動的クエリを構築する場合の保険として
  return input
    .replace(/['";\\]/g, '\\$&')
    .replace(/\x00/g, '\\x00') // NULL文字をエスケープ
    .replace(/\x1a/g, '\\x1a'); // SUB文字をエスケープ
}

// ログイン検証スキーマ
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'パスワードを入力してください'),
  rememberMe: z.boolean().optional().default(false),
});

// サインアップ検証スキーマ
export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  acceptTerms: z.boolean().refine(val => val === true, {
    message: '利用規約に同意する必要があります',
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "パスワードが一致しません",
  path: ["confirmPassword"],
});

// パスワードリセット検証スキーマ
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

// パスワード再設定スキーマ
export const resetPasswordSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string(),
  token: z.string().min(1, 'トークンが必要です'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "パスワードが一致しません",
  path: ["confirmPassword"],
});

// ファイルアップロード検証
export const fileUploadSchema = z.object({
  filename: z.string()
    .max(255, 'ファイル名が長すぎます')
    .regex(/^[a-zA-Z0-9-_. ]+$/, 'ファイル名に使用できない文字が含まれています')
    .transform(sanitizeInput),
  size: z.number()
    .positive('ファイルサイズが不正です')
    .max(10 * 1024 * 1024, 'ファイルサイズは10MB以下にしてください'),
  mimetype: z.enum([
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ] as const).describe('PowerPointファイル（.ppt, .pptx）のみアップロード可能です'),
});

// プロフィール更新スキーマ
export const profileUpdateSchema = z.object({
  name: z.string()
    .min(1, '名前を入力してください')
    .max(100, '名前が長すぎます')
    .transform(sanitizeInput),
  email: emailSchema.optional(),
  bio: z.string()
    .max(500, '自己紹介は500文字以下にしてください')
    .transform(sanitizeInput)
    .optional(),
});

// 汎用的なID検証
export const idSchema = z.string()
  .uuid('無効なIDフォーマットです');

// ページネーション検証
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['asc', 'desc']).optional().default('desc'),
  sortBy: z.string().optional(),
});

// 検索クエリ検証
export const searchSchema = z.object({
  query: z.string()
    .min(1, '検索キーワードを入力してください')
    .max(100, '検索キーワードが長すぎます')
    .transform(sanitizeInput),
  filters: z.record(z.string(), z.string()).optional(),
});

// エクスポート用のタイプ定義
export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type FileUploadInput = z.infer<typeof fileUploadSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type SearchInput = z.infer<typeof searchSchema>;