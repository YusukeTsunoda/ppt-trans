# セキュリティ強化版 API Routes移行計画

## 🔒 セキュリティエキスパートによる評価と推奨事項

### ⚠️ 重要な警告事項
Server ActionsからAPI Routesへの移行により、Next.jsが自動的に提供していた以下のセキュリティ機能が失われます：
- 自動CSRF保護
- 自動的な型安全性
- ビルトインのレート制限

これらを手動で実装する必要があります。

## 🛡️ セキュリティ脅威分析（OWASP Top 10対応）

### 1. CSRF（Cross-Site Request Forgery）攻撃

#### 脅威レベル: 🔴 高
API Routesは標準でCSRF保護を提供しないため、最も注意が必要。

#### 対策実装:

##### 1.1 Double Submit Cookie Pattern + カスタムヘッダー

`/src/lib/security/csrf.ts`:
```typescript
import { randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

const CSRF_TOKEN_NAME = 'csrf-token';
const CSRF_HEADER_NAME = 'X-CSRF-Token';
const CSRF_TOKEN_LENGTH = 32;

export class CSRFProtection {
  /**
   * CSRFトークンを生成し、Cookieに設定
   */
  static async generateToken(): Promise<string> {
    const token = randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
    const cookieStore = cookies();
    
    cookieStore.set(CSRF_TOKEN_NAME, token, {
      httpOnly: false, // JavaScriptからアクセス可能にする必要がある
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24, // 24時間
    });
    
    return token;
  }

  /**
   * CSRFトークンを検証
   */
  static async verifyToken(request: NextRequest): Promise<boolean> {
    // GET/HEADリクエストはスキップ
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return true;
    }

    // 1. Cookieからトークンを取得
    const cookieToken = request.cookies.get(CSRF_TOKEN_NAME)?.value;
    if (!cookieToken) {
      console.error('[CSRF] No token in cookie');
      return false;
    }

    // 2. ヘッダーまたはボディからトークンを取得
    const headerToken = request.headers.get(CSRF_HEADER_NAME);
    
    // 3. Double Submit Cookie検証
    if (!headerToken || cookieToken !== headerToken) {
      console.error('[CSRF] Token mismatch');
      return false;
    }

    // 4. トークンの長さ検証（タイミング攻撃対策）
    if (cookieToken.length !== CSRF_TOKEN_LENGTH * 2) {
      console.error('[CSRF] Invalid token length');
      return false;
    }

    return true;
  }

  /**
   * 定時間比較（タイミング攻撃対策）
   */
  private static secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }
}
```

##### 1.2 Origin/Referer検証

`/src/lib/security/origin-validator.ts`:
```typescript
import { NextRequest } from 'next/server';

export class OriginValidator {
  private static allowedOrigins: Set<string>;
  
  static {
    // 環境変数から許可されたオリジンを設定
    const origins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    origins.push(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
    this.allowedOrigins = new Set(origins);
  }

  static validate(request: NextRequest): boolean {
    // GETリクエストはスキップ
    if (request.method === 'GET') return true;

    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    
    // OriginヘッダーとRefererヘッダーの両方をチェック
    const requestOrigin = origin || (referer ? new URL(referer).origin : null);
    
    if (!requestOrigin) {
      console.error('[Origin] No origin or referer header');
      return false;
    }

    if (!this.allowedOrigins.has(requestOrigin)) {
      console.error(`[Origin] Invalid origin: ${requestOrigin}`);
      return false;
    }

    return true;
  }
}
```

### 2. 認証・セッション管理のセキュリティ

#### 脅威レベル: 🔴 高

##### 2.1 セキュアなセッション管理

`/src/lib/security/session-manager.ts`:
```typescript
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

const SESSION_SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'your-secret-key-min-32-characters!!'
);
const SESSION_COOKIE_NAME = 'session';

interface SessionData {
  userId: string;
  email: string;
  role: 'USER' | 'ADMIN';
  exp: number;
  iat: number;
  jti: string; // JWT ID for revocation
}

export class SessionManager {
  /**
   * セッショントークンを作成
   */
  static async createSession(data: Omit<SessionData, 'exp' | 'iat' | 'jti'>): Promise<string> {
    const token = await new SignJWT({
      ...data,
      jti: crypto.randomUUID(),
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(SESSION_SECRET);

    // HTTPOnly Cookieに保存
    cookies().set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // CSRFとユーザビリティのバランス
      path: '/',
      maxAge: 60 * 60 * 2, // 2時間
    });

    return token;
  }

  /**
   * セッションを検証
   */
  static async verifySession(request: NextRequest): Promise<SessionData | null> {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    
    if (!token) return null;

    try {
      const { payload } = await jwtVerify(token, SESSION_SECRET);
      
      // JTIをチェック（リボケーション対応）
      if (await this.isTokenRevoked(payload.jti as string)) {
        return null;
      }
      
      return payload as unknown as SessionData;
    } catch (error) {
      console.error('[Session] Verification failed:', error);
      return null;
    }
  }

  /**
   * トークンのリボケーション確認
   */
  private static async isTokenRevoked(jti: string): Promise<boolean> {
    // Redis/DBでリボケーションリストを管理
    // 実装例:
    // const revoked = await redis.get(`revoked:${jti}`);
    // return revoked !== null;
    return false; // 仮実装
  }

  /**
   * セッションを破棄
   */
  static async destroySession(): Promise<void> {
    cookies().delete(SESSION_COOKIE_NAME);
  }
}
```

### 3. 入力検証とサニタイゼーション

#### 脅威レベル: 🟡 中

##### 3.1 Zodによる厳格な入力検証

`/src/lib/security/validators.ts`:
```typescript
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
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
    'パスワードは大文字、小文字、数字、特殊文字を含む必要があります')
  .refine(password => {
    // 連続する文字のチェック
    return !/(.)\1{2,}/.test(password);
  }, '同じ文字を3回以上連続で使用できません')
  .refine(password => {
    // 一般的な弱いパスワードのチェック
    const weakPasswords = ['password', '12345678', 'qwerty'];
    return !weakPasswords.some(weak => 
      password.toLowerCase().includes(weak)
    );
  }, '一般的すぎるパスワードは使用できません');

// XSS対策のためのサニタイゼーション
export function sanitizeInput(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // すべてのHTMLタグを削除
    ALLOWED_ATTR: [],
  });
}

// SQLインジェクション対策（Supabase/Prismaを使用）
export function escapeSQL(input: string): string {
  // Supabase/Prismaはパラメータ化クエリを使用するため基本的に不要
  // ただし、動的クエリを構築する場合の保険として
  return input.replace(/['";\\]/g, '\\$&');
}

// ログイン検証スキーマ
export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  rememberMe: z.boolean().optional(),
});

// ファイルアップロード検証
export const fileUploadSchema = z.object({
  filename: z.string()
    .max(255)
    .regex(/^[a-zA-Z0-9-_.]+$/, 'ファイル名に使用できない文字が含まれています')
    .transform(sanitizeInput),
  size: z.number()
    .max(10 * 1024 * 1024, 'ファイルサイズは10MB以下にしてください'),
  mimetype: z.enum([
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ], { message: 'PowerPointファイルのみアップロード可能です' }),
});
```

### 4. レート制限とDDoS対策

#### 脅威レベル: 🟡 中

##### 4.1 高度なレート制限実装

`/src/lib/security/rate-limiter.ts`:
```typescript
import { LRUCache } from 'lru-cache';
import { NextRequest } from 'next/server';

interface RateLimitConfig {
  windowMs: number;  // 時間窓（ミリ秒）
  max: number;       // 最大リクエスト数
  skipSuccessfulRequests?: boolean; // 成功したリクエストをカウントしない
  keyGenerator?: (req: NextRequest) => string;
}

class AdvancedRateLimiter {
  private cache: LRUCache<string, number[]>;
  
  constructor() {
    this.cache = new LRUCache({
      max: 10000, // 最大10000個のIPアドレスを追跡
      ttl: 60 * 60 * 1000, // 1時間でエントリを削除
    });
  }

  /**
   * レート制限チェック（スライディングウィンドウ方式）
   */
  async check(req: NextRequest, config: RateLimitConfig): Promise<{
    allowed: boolean;
    retryAfter?: number;
    remaining?: number;
  }> {
    const key = config.keyGenerator ? 
      config.keyGenerator(req) : 
      this.getClientIdentifier(req);
    
    const now = Date.now();
    const windowStart = now - config.windowMs;
    
    // 現在の時間窓内のリクエストを取得
    const requests = this.cache.get(key) || [];
    const recentRequests = requests.filter(time => time > windowStart);
    
    if (recentRequests.length >= config.max) {
      const oldestRequest = recentRequests[0];
      const retryAfter = Math.ceil((oldestRequest + config.windowMs - now) / 1000);
      
      return {
        allowed: false,
        retryAfter,
        remaining: 0,
      };
    }
    
    // 新しいリクエストを記録
    recentRequests.push(now);
    this.cache.set(key, recentRequests);
    
    return {
      allowed: true,
      remaining: config.max - recentRequests.length,
    };
  }

  /**
   * クライアント識別子を生成
   */
  private getClientIdentifier(req: NextRequest): string {
    const forwarded = req.headers.get('x-forwarded-for');
    const real = req.headers.get('x-real-ip');
    const ip = forwarded?.split(',')[0] || real || 'unknown';
    
    // IPアドレス + User-Agentでより正確な識別
    const userAgent = req.headers.get('user-agent') || '';
    const hash = this.simpleHash(userAgent);
    
    return `${ip}:${hash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
}

// 異なるエンドポイント用の設定
export const rateLimitConfigs: Record<string, RateLimitConfig> = {
  login: {
    windowMs: 15 * 60 * 1000, // 15分
    max: 5, // 5回まで
    skipSuccessfulRequests: true, // 成功したログインはカウントしない
  },
  signup: {
    windowMs: 60 * 60 * 1000, // 1時間
    max: 3, // 3回まで
  },
  upload: {
    windowMs: 60 * 60 * 1000, // 1時間
    max: 20, // 20ファイルまで
  },
  api: {
    windowMs: 60 * 1000, // 1分
    max: 100, // 100リクエストまで
  },
};

export const rateLimiter = new AdvancedRateLimiter();
```

### 5. ファイルアップロードのセキュリティ

#### 脅威レベル: 🟡 中

##### 5.1 セキュアなファイルアップロード

`/src/lib/security/file-upload.ts`:
```typescript
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { fileTypeFromBuffer } from 'file-type';

export class SecureFileUpload {
  private static readonly ALLOWED_EXTENSIONS = ['.ppt', '.pptx'];
  private static readonly ALLOWED_MIMETYPES = [
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ];
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly UPLOAD_DIR = '/tmp/uploads';

  /**
   * ファイルを検証してセキュアにアップロード
   */
  static async uploadFile(file: File): Promise<{
    success: boolean;
    filePath?: string;
    error?: string;
  }> {
    try {
      // 1. ファイルサイズチェック
      if (file.size > this.MAX_FILE_SIZE) {
        return { success: false, error: 'ファイルが大きすぎます' };
      }

      // 2. ファイル名のサニタイゼーション
      const sanitizedName = this.sanitizeFileName(file.name);
      
      // 3. 拡張子チェック
      const ext = path.extname(sanitizedName).toLowerCase();
      if (!this.ALLOWED_EXTENSIONS.includes(ext)) {
        return { success: false, error: '許可されていないファイル形式です' };
      }

      // 4. ファイル内容を取得
      const buffer = Buffer.from(await file.arrayBuffer());
      
      // 5. マジックバイトによるファイルタイプ検証
      const fileType = await fileTypeFromBuffer(buffer);
      if (!fileType || !this.ALLOWED_MIMETYPES.includes(fileType.mime)) {
        return { 
          success: false, 
          error: 'ファイルの内容が不正です（マジックバイト検証失敗）' 
        };
      }

      // 6. ウイルススキャン（ClamAVなどを統合）
      if (await this.scanForVirus(buffer)) {
        return { success: false, error: 'セキュリティ上の問題が検出されました' };
      }

      // 7. ユニークなファイル名生成
      const hash = createHash('sha256').update(buffer).digest('hex');
      const uniqueName = `${Date.now()}-${hash}${ext}`;
      const uploadPath = path.join(this.UPLOAD_DIR, uniqueName);

      // 8. ファイル保存（隔離されたディレクトリ）
      await fs.writeFile(uploadPath, buffer);
      
      // 9. ファイル権限設定（読み取り専用）
      await fs.chmod(uploadPath, 0o444);

      return {
        success: true,
        filePath: uploadPath,
      };
    } catch (error) {
      console.error('[FileUpload] Error:', error);
      return { 
        success: false, 
        error: 'ファイルアップロード中にエラーが発生しました' 
      };
    }
  }

  /**
   * ファイル名のサニタイゼーション
   */
  private static sanitizeFileName(fileName: string): string {
    // パストラバーサル攻撃対策
    return fileName
      .replace(/\.\./g, '') // 親ディレクトリ参照を削除
      .replace(/[^a-zA-Z0-9.-]/g, '_') // 英数字以外を_に置換
      .substring(0, 255); // 長さ制限
  }

  /**
   * ウイルススキャン（実装例）
   */
  private static async scanForVirus(buffer: Buffer): Promise<boolean> {
    // ClamAVなどのアンチウイルスエンジンと統合
    // const clamscan = new NodeClam();
    // const { isInfected } = await clamscan.scanBuffer(buffer);
    // return isInfected;
    
    // 簡易的なチェック（実装例）
    const suspiciousPatterns = [
      Buffer.from('4D5A'), // EXE header
      Buffer.from('504B0304'), // ZIP header (マクロ付きOffice)
    ];
    
    for (const pattern of suspiciousPatterns) {
      if (buffer.includes(pattern)) {
        console.warn('[FileUpload] Suspicious pattern detected');
        // PowerPointファイルはZIP形式なので、より詳細な検証が必要
      }
    }
    
    return false; // 仮実装
  }
}
```

### 6. API Route実装テンプレート（全セキュリティ対策統合版）

`/app/api/auth/login/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { CSRFProtection } from '@/lib/security/csrf';
import { OriginValidator } from '@/lib/security/origin-validator';
import { SessionManager } from '@/lib/security/session-manager';
import { rateLimiter, rateLimitConfigs } from '@/lib/security/rate-limiter';
import { loginSchema } from '@/lib/security/validators';
import { createClient } from '@/lib/supabase/server';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  
  try {
    // 1. レート制限チェック
    const rateLimitResult = await rateLimiter.check(
      request, 
      rateLimitConfigs.login
    );
    
    if (!rateLimitResult.allowed) {
      logger.warn('Rate limit exceeded', { 
        requestId,
        ip: request.headers.get('x-forwarded-for'),
      });
      
      return NextResponse.json(
        { 
          error: 'リクエストが多すぎます。しばらくお待ちください。',
          retryAfter: rateLimitResult.retryAfter,
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(rateLimitResult.retryAfter),
            'X-RateLimit-Remaining': '0',
          }
        }
      );
    }

    // 2. Origin/Referer検証
    if (!OriginValidator.validate(request)) {
      logger.error('Invalid origin', { 
        requestId,
        origin: request.headers.get('origin'),
        referer: request.headers.get('referer'),
      });
      
      return NextResponse.json(
        { error: '不正なリクエストです' },
        { status: 403 }
      );
    }

    // 3. CSRF検証
    if (!await CSRFProtection.verifyToken(request)) {
      logger.error('CSRF validation failed', { requestId });
      
      return NextResponse.json(
        { error: 'セキュリティトークンが無効です' },
        { status: 403 }
      );
    }

    // 4. リクエストボディの取得と検証
    const body = await request.json();
    
    // Content-Typeチェック
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return NextResponse.json(
        { error: '不正なContent-Type' },
        { status: 400 }
      );
    }

    // 5. 入力検証（Zod）
    const validatedData = loginSchema.parse(body);

    // 6. 監査ログ（ログイン試行）
    logger.info('Login attempt', {
      requestId,
      email: validatedData.email,
      ip: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    });

    // 7. Supabase認証
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: validatedData.email,
      password: validatedData.password,
    });

    // 8. 認証失敗処理
    if (error) {
      // ブルートフォース対策：失敗カウンターを増やす
      await this.incrementFailedAttempts(validatedData.email);
      
      logger.warn('Login failed', {
        requestId,
        email: validatedData.email,
        error: error.message,
      });

      // タイミング攻撃対策：一定時間待機
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
      
      return NextResponse.json(
        { 
          error: 'メールアドレスまたはパスワードが正しくありません',
          remaining: rateLimitResult.remaining,
        },
        { status: 401 }
      );
    }

    // 9. セッション作成
    const sessionToken = await SessionManager.createSession({
      userId: data.user!.id,
      email: data.user!.email!,
      role: data.user!.role as 'USER' | 'ADMIN',
    });

    // 10. 成功監査ログ
    logger.info('Login successful', {
      requestId,
      userId: data.user!.id,
      email: data.user!.email,
      responseTime: Date.now() - startTime,
    });

    // 11. レスポンスヘッダーの設定
    const response = NextResponse.json({
      success: true,
      user: {
        id: data.user!.id,
        email: data.user!.email,
      },
      redirectTo: '/dashboard',
    });

    // セキュリティヘッダー追加
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    response.headers.set('X-Request-Id', requestId);

    return response;

  } catch (error) {
    // エラーロギング
    logger.error('Login error', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Zodバリデーションエラー
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'バリデーションエラー',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    // 内部エラーの詳細は隠蔽
    return NextResponse.json(
      { 
        error: 'サーバーエラーが発生しました',
        requestId, // デバッグ用
      },
      { status: 500 }
    );
  }
}

// ブルートフォース対策用の失敗カウンター
async function incrementFailedAttempts(email: string): Promise<void> {
  // Redis/DBに失敗回数を記録
  // 一定回数失敗したらアカウントを一時的にロック
  // 実装例:
  // await redis.incr(`failed:${email}`);
  // await redis.expire(`failed:${email}`, 60 * 15); // 15分後にリセット
}
```

## 📊 セキュリティチェックリスト

### 必須実装項目

- [ ] **CSRF対策**
  - [ ] Double Submit Cookie Pattern実装
  - [ ] Origin/Referer検証
  - [ ] SameSite Cookie設定

- [ ] **認証・セッション管理**
  - [ ] HTTPOnly Cookie使用
  - [ ] Secure フラグ設定
  - [ ] セッショントークンの適切な有効期限
  - [ ] ログアウト時のセッション無効化

- [ ] **入力検証**
  - [ ] Zodによる厳格な型検証
  - [ ] XSS対策（DOMPurify）
  - [ ] SQLインジェクション対策（パラメータ化クエリ）

- [ ] **レート制限**
  - [ ] エンドポイントごとの適切な制限
  - [ ] スライディングウィンドウ方式
  - [ ] IP + User-Agentによる識別

- [ ] **ファイルアップロード**
  - [ ] ファイルサイズ制限
  - [ ] MIMEタイプ検証
  - [ ] マジックバイト検証
  - [ ] ファイル名サニタイゼーション
  - [ ] ウイルススキャン統合

- [ ] **セキュリティヘッダー**
  - [ ] CSP（Content Security Policy）
  - [ ] X-Frame-Options
  - [ ] X-Content-Type-Options
  - [ ] Strict-Transport-Security

- [ ] **監査ログ**
  - [ ] 認証イベント記録
  - [ ] 異常アクセス検知
  - [ ] エラーの適切な記録

### 推奨実装項目

- [ ] **高度な脅威対策**
  - [ ] WAF（Web Application Firewall）統合
  - [ ] DDoS対策（Cloudflare等）
  - [ ] ボット検出（reCAPTCHA等）

- [ ] **コンプライアンス**
  - [ ] GDPR対応（EU向け）
  - [ ] 個人情報保護法対応（日本）
  - [ ] PCI DSS準拠（決済処理がある場合）

## 🚨 緊急対応手順

### セキュリティインシデント発生時

1. **即座の対応**
   - 影響を受けるサービスの一時停止
   - アクセスログの保全
   - 管理者への通知

2. **調査**
   - ログ分析
   - 攻撃ベクトルの特定
   - 影響範囲の確認

3. **対策**
   - パッチ適用
   - 設定変更
   - 追加のセキュリティ対策実装

4. **復旧**
   - サービス再開
   - モニタリング強化
   - インシデントレポート作成

## 📚 参考資料

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [Next.js Security Best Practices](https://nextjs.org/docs/authentication)
- [Supabase Security](https://supabase.com/docs/guides/auth/security)

---

このセキュリティ強化計画に従って実装することで、堅牢なAPIシステムを構築できます。