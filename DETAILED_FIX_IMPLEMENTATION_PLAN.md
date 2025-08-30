# 🔧 詳細修正実装計画書

## 📋 エグゼクティブサマリー
3つの重大な問題に対する具体的な修正計画と実装手順を定義します。

---

## 🔴 問題1: テストの質の問題

### 現状の問題点（詳細）

#### 1.1 表面的なテスト
```typescript
// 現在のテスト（e2e/server-actions/translate.spec.ts）
test('should upload and translate file', async ({ page }) => {
  await page.click('button:has-text("🌐 翻訳")');
  await expect(page.locator('text=翻訳が完了しました')).toBeVisible();
  // 問題: UIの変化のみ確認、実際の処理を検証していない
});
```

**問題:**
- Server Actionが実際に呼ばれたか不明
- データベースの状態変化を確認していない
- 翻訳結果の正確性を検証していない

### 具体的な修正実装

#### Step 1: Server Actions呼び出し検証テスト
```typescript
// tests/integration/server-actions-call-verification.test.ts
import { translatePPTXAction } from '@/app/actions/pptx';
import { createClient } from '@/lib/supabase/server';

describe('Server Actions呼び出し検証', () => {
  let mockSupabase: any;
  let originalConsoleLog: any;
  let logSpy: jest.SpyInstance;
  
  beforeEach(() => {
    // コンソールログをスパイ
    originalConsoleLog = console.log;
    logSpy = jest.spyOn(console, 'log');
    
    // Supabaseモック設定
    mockSupabase = createMockSupabase();
    jest.mocked(createClient).mockResolvedValue(mockSupabase);
  });
  
  afterEach(() => {
    logSpy.mockRestore();
  });
  
  test('translatePPTXActionが正しく呼び出される', async () => {
    // Arrange
    const fileId = 'test-file-123';
    const expectedUser = { id: 'user1', email: 'test@example.com' };
    
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: expectedUser },
      error: null
    });
    
    // Act
    const result = await translatePPTXAction(fileId);
    
    // Assert - 呼び出しを検証
    expect(mockSupabase.auth.getUser).toHaveBeenCalledTimes(1);
    expect(mockSupabase.from).toHaveBeenCalledWith('files');
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Server Action called'),
      expect.objectContaining({ action: 'translatePPTX', fileId })
    );
  });
  
  test('データベースの状態が正しく更新される', async () => {
    // Arrange
    const fileId = 'test-file-123';
    const updateSpy = jest.fn().mockResolvedValue({ error: null });
    
    mockSupabase.from.mockReturnValue({
      update: updateSpy
    });
    
    // Act
    await translatePPTXAction(fileId);
    
    // Assert - DB更新を検証
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'processing'
      })
    );
    
    // 完了後の更新も確認
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: expect.stringMatching(/completed|failed/)
      })
    );
  });
});
```

#### Step 2: エラーケースの網羅的テスト
```typescript
// tests/integration/error-cases.test.ts
describe('エラーケース網羅テスト', () => {
  
  test.each([
    // [入力, 期待されるエラー]
    [null, '必須パラメータが不足'],
    ['', 'ファイルIDが無効'],
    ['../../../etc/passwd', 'パストラバーサル攻撃を検出'],
    ['x'.repeat(1000), 'IDが長すぎます'],
    ['<script>alert(1)</script>', 'XSS攻撃を検出'],
    ["'; DROP TABLE files; --", 'SQLインジェクション攻撃を検出'],
  ])('異常な入力 %s でエラー: %s', async (input, expectedError) => {
    const result = await extractTextFromPPTXAction(input as any, 'path');
    
    expect(result.success).toBe(false);
    expect(result.error).toContain(expectedError);
  });
  
  test('大きすぎるファイルでエラー', async () => {
    const largeFile = {
      id: 'large-file',
      file_size: 100 * 1024 * 1024, // 100MB
    };
    
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockResolvedValue({ data: largeFile })
    });
    
    const result = await extractTextFromPPTXAction('large-file', 'path');
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('ファイルサイズが上限を超えています');
  });
  
  test('同時実行での競合状態', async () => {
    const fileId = 'concurrent-file';
    
    // 10個の並行リクエスト
    const promises = Array(10).fill(null).map(() => 
      translatePPTXAction(fileId)
    );
    
    const results = await Promise.allSettled(promises);
    
    // 少なくとも1つは成功、他はロック待ちエラー
    const succeeded = results.filter(r => 
      r.status === 'fulfilled' && r.value.success
    );
    const locked = results.filter(r => 
      r.status === 'fulfilled' && 
      r.value.error?.includes('処理中')
    );
    
    expect(succeeded.length).toBe(1);
    expect(locked.length).toBeGreaterThan(0);
  });
});
```

---

## 🛡️ 問題2: セキュリティの脆弱性

### 現状の問題点（詳細）

#### 2.1 入力検証の不足
```typescript
// 現在のコード（pptx.ts）
export async function extractTextFromPPTXAction(
  fileId: string,  // 検証なし
  filePath: string  // 検証なし
) {
  // 直接使用している - 危険！
  const tempFilePath = path.join(tempDir, `temp_${fileId}.pptx`);
}
```

#### 2.2 レート制限なし
```typescript
// 現在: 無制限にAPIを呼び出せる
// DDoS攻撃やリソース枯渇の危険
```

### 具体的な修正実装

#### Step 1: 入力検証層の追加
```typescript
// lib/validation/server-actions-schemas.ts
import { z } from 'zod';

// UUIDパターン
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ファイルパス検証（パストラバーサル防止）
const safePathRegex = /^[a-zA-Z0-9/_.-]+$/;

export const extractTextSchema = z.object({
  fileId: z.string()
    .min(1, 'ファイルIDは必須です')
    .max(50, 'ファイルIDが長すぎます')
    .regex(uuidRegex, '無効なファイルID形式'),
  
  filePath: z.string()
    .min(1, 'ファイルパスは必須です')
    .max(500, 'ファイルパスが長すぎます')
    .regex(safePathRegex, '無効なファイルパス')
    .refine(path => !path.includes('..'), 'パストラバーサル攻撃を検出')
});

export const translateTextsSchema = z.object({
  texts: z.array(
    z.object({
      id: z.string().max(100),
      text: z.string().max(10000, 'テキストが長すぎます'),
    })
  )
  .max(100, '一度に翻訳できるテキスト数を超えています')
  .min(1, 'テキストが指定されていません'),
  
  targetLanguage: z.enum(['ja', 'en', 'zh', 'ko', 'es', 'fr', 'de']),
});

// 修正後のServer Action
export async function extractTextFromPPTXAction(
  fileId: unknown,
  filePath: unknown
): Promise<ExtractResult> {
  try {
    // 入力検証
    const validated = extractTextSchema.safeParse({ fileId, filePath });
    
    if (!validated.success) {
      logger.warn('Invalid input detected', { 
        errors: validated.error.errors,
        input: { fileId, filePath }
      });
      
      return {
        success: false,
        error: validated.error.errors[0]?.message || '入力が無効です'
      };
    }
    
    const { fileId: validFileId, filePath: validFilePath } = validated.data;
    
    // 以降、検証済みの値を使用
    // ...
  } catch (error) {
    // エラー処理
  }
}
```

#### Step 2: レート制限の実装
```typescript
// lib/security/rate-limiter.ts
import { LRUCache } from 'lru-cache';

interface RateLimitOptions {
  interval: number;  // ミリ秒
  uniqueTokenPerInterval: number;  // トークン数
}

export class RateLimiter {
  private cache: LRUCache<string, number[]>;
  
  constructor(private options: RateLimitOptions) {
    this.cache = new LRUCache<string, number[]>({
      max: 5000,  // 最大5000ユーザー
      ttl: options.interval,
    });
  }
  
  async check(key: string): Promise<{ success: boolean; remaining: number }> {
    const now = Date.now();
    const tokens = this.cache.get(key) || [];
    
    // 期限切れトークンを削除
    const validTokens = tokens.filter(
      token => now - token < this.options.interval
    );
    
    if (validTokens.length >= this.options.uniqueTokenPerInterval) {
      return { 
        success: false, 
        remaining: 0 
      };
    }
    
    validTokens.push(now);
    this.cache.set(key, validTokens);
    
    return {
      success: true,
      remaining: this.options.uniqueTokenPerInterval - validTokens.length
    };
  }
}

// レート制限インスタンス
const translationLimiter = new RateLimiter({
  interval: 60 * 1000,  // 1分
  uniqueTokenPerInterval: 10,  // 10リクエスト/分
});

const heavyOperationLimiter = new RateLimiter({
  interval: 60 * 60 * 1000,  // 1時間
  uniqueTokenPerInterval: 100,  // 100リクエスト/時
});

// Server Actionに適用
export async function translatePPTXAction(
  fileId: string,
  targetLanguage: string = 'ja'
): Promise<TranslatePPTXResult> {
  try {
    // 認証
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: '認証が必要です' };
    }
    
    // レート制限チェック
    const rateLimitKey = `translate:${user.id}`;
    const { success, remaining } = await heavyOperationLimiter.check(rateLimitKey);
    
    if (!success) {
      return {
        success: false,
        error: 'リクエスト制限に達しました。しばらくお待ちください。'
      };
    }
    
    logger.info('Rate limit check passed', { 
      userId: user.id, 
      remaining 
    });
    
    // 処理続行
    // ...
  } catch (error) {
    // エラー処理
  }
}
```

#### Step 3: ファイルロック機構
```typescript
// lib/concurrency/file-lock.ts
class FileLockManager {
  private locks = new Map<string, Promise<void>>();
  
  async acquireLock(fileId: string, timeout = 30000): Promise<() => void> {
    const lockKey = `file:${fileId}`;
    
    // 既存のロックを待つ
    while (this.locks.has(lockKey)) {
      const existingLock = this.locks.get(lockKey);
      try {
        await Promise.race([
          existingLock,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Lock timeout')), timeout)
          )
        ]);
      } catch (error) {
        // タイムアウトした場合、強制的にロックを解放
        this.locks.delete(lockKey);
        throw new Error('ファイルが処理中です。しばらくお待ちください。');
      }
    }
    
    // 新しいロックを作成
    let releaseLock: () => void;
    const lockPromise = new Promise<void>(resolve => {
      releaseLock = resolve;
    });
    
    this.locks.set(lockKey, lockPromise);
    
    // ロック解放関数を返す
    return () => {
      this.locks.delete(lockKey);
      releaseLock!();
    };
  }
}

const fileLockManager = new FileLockManager();

// 使用例
export async function translatePPTXAction(fileId: string) {
  let releaseLock: (() => void) | null = null;
  
  try {
    // ファイルロックを取得
    releaseLock = await fileLockManager.acquireLock(fileId);
    
    // 処理実行
    // ...
    
  } finally {
    // 必ずロックを解放
    if (releaseLock) {
      releaseLock();
    }
  }
}
```

---

## 🔔 問題3: エラー処理の不明確さ

### 現状の問題点（詳細）

#### 3.1 曖昧なエラーメッセージ
```typescript
// 現在のコード（PreviewView.tsx:551-575）
if (result.translatedPath) {
  alert('翻訳が完了しました');  // 成功
} else {
  alert('翻訳が完了しました');  // 失敗でも同じメッセージ！
}
```

#### 3.2 エラー詳細の喪失
```typescript
// 現在のコード（dashboard.ts）
catch (error) {
  logger.error('Translation error:', error);
  return { error: '翻訳処理中にエラーが発生しました' };  // 詳細が失われる
}
```

### 具体的な修正実装

#### Step 1: 構造化エラークラス
```typescript
// lib/errors/app-errors.ts
export enum ErrorCode {
  // 認証エラー
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  AUTH_EXPIRED = 'AUTH_EXPIRED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  
  // 検証エラー
  INVALID_INPUT = 'INVALID_INPUT',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  UNSUPPORTED_FORMAT = 'UNSUPPORTED_FORMAT',
  
  // リソースエラー
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_LOCKED = 'RESOURCE_LOCKED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  
  // 外部サービスエラー
  TRANSLATION_API_ERROR = 'TRANSLATION_API_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  
  // システムエラー
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  TIMEOUT = 'TIMEOUT',
}

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public message: string,
    public userMessage: string,  // ユーザー向けメッセージ
    public details?: any,
    public isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'AppError';
  }
  
  toJSON() {
    return {
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      details: this.details,
      isRetryable: this.isRetryable,
    };
  }
}

// エラーファクトリー
export class ErrorFactory {
  static authRequired(): AppError {
    return new AppError(
      ErrorCode.AUTH_REQUIRED,
      'Authentication required',
      'ログインが必要です。',
      null,
      false
    );
  }
  
  static fileTooLarge(size: number, maxSize: number): AppError {
    return new AppError(
      ErrorCode.FILE_TOO_LARGE,
      `File size ${size} exceeds maximum ${maxSize}`,
      `ファイルサイズが上限（${Math.round(maxSize / 1024 / 1024)}MB）を超えています。`,
      { size, maxSize },
      false
    );
  }
  
  static translationApiError(originalError: any): AppError {
    // Anthropic APIのエラーを解析
    if (originalError?.status === 429) {
      return new AppError(
        ErrorCode.QUOTA_EXCEEDED,
        'API rate limit exceeded',
        'APIの利用制限に達しました。しばらくお待ちください。',
        { retryAfter: originalError.headers?.['retry-after'] },
        true
      );
    }
    
    return new AppError(
      ErrorCode.TRANSLATION_API_ERROR,
      originalError?.message || 'Translation API error',
      '翻訳サービスでエラーが発生しました。',
      { originalError },
      true
    );
  }
}
```

#### Step 2: エラーハンドリング改善
```typescript
// app/actions/pptx.ts（改善版）
export async function translatePPTXAction(
  fileId: string,
  targetLanguage: string = 'ja'
): Promise<TranslatePPTXResult> {
  const startTime = Date.now();
  let currentStep = 'initialization';
  
  try {
    // Step 1: 認証
    currentStep = 'authentication';
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      throw ErrorFactory.authRequired();
    }
    
    // Step 2: ファイル検証
    currentStep = 'file-validation';
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .eq('user_id', user.id)
      .single();
    
    if (fileError || !file) {
      throw new AppError(
        ErrorCode.RESOURCE_NOT_FOUND,
        `File ${fileId} not found for user ${user.id}`,
        'ファイルが見つかりません。',
        { fileId, userId: user.id },
        false
      );
    }
    
    // ファイルサイズチェック
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.file_size > MAX_FILE_SIZE) {
      throw ErrorFactory.fileTooLarge(file.file_size, MAX_FILE_SIZE);
    }
    
    // Step 3: 処理実行
    currentStep = 'processing';
    // ... 処理 ...
    
    return {
      success: true,
      message: '翻訳が完了しました',
      fileId
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    // 構造化ログ
    logger.error('translatePPTXAction failed', {
      fileId,
      targetLanguage,
      currentStep,
      duration,
      error: error instanceof AppError ? error.toJSON() : {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    
    // エラーレスポンス
    if (error instanceof AppError) {
      return {
        success: false,
        error: error.userMessage,
        errorCode: error.code,
        isRetryable: error.isRetryable,
        details: error.details
      };
    }
    
    // 予期しないエラー
    return {
      success: false,
      error: 'システムエラーが発生しました。サポートにお問い合わせください。',
      errorCode: ErrorCode.INTERNAL_ERROR,
      isRetryable: false
    };
  }
}
```

#### Step 3: クライアント側のエラー表示改善
```typescript
// components/ErrorDisplay.tsx
import { useState } from 'react';
import { ErrorCode } from '@/lib/errors/app-errors';

interface ErrorDisplayProps {
  error: {
    error: string;
    errorCode?: ErrorCode;
    isRetryable?: boolean;
    details?: any;
  };
  onRetry?: () => void;
}

export function ErrorDisplay({ error, onRetry }: ErrorDisplayProps) {
  const [showDetails, setShowDetails] = useState(false);
  
  // エラーコードに応じたアイコン
  const getIcon = () => {
    switch (error.errorCode) {
      case ErrorCode.AUTH_REQUIRED:
        return '🔐';
      case ErrorCode.FILE_TOO_LARGE:
        return '📦';
      case ErrorCode.QUOTA_EXCEEDED:
        return '⏱️';
      default:
        return '⚠️';
    }
  };
  
  // エラーコードに応じた背景色
  const getBgColor = () => {
    switch (error.errorCode) {
      case ErrorCode.AUTH_REQUIRED:
      case ErrorCode.INSUFFICIENT_PERMISSIONS:
        return 'bg-yellow-50 border-yellow-200';
      case ErrorCode.INVALID_INPUT:
      case ErrorCode.FILE_TOO_LARGE:
        return 'bg-orange-50 border-orange-200';
      default:
        return 'bg-red-50 border-red-200';
    }
  };
  
  return (
    <div className={`p-4 rounded-lg border ${getBgColor()}`}>
      <div className="flex items-start">
        <span className="text-2xl mr-3">{getIcon()}</span>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">
            エラーが発生しました
          </h3>
          <p className="mt-1 text-gray-700">{error.error}</p>
          
          {error.isRetryable && onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              再試行
            </button>
          )}
          
          {error.details && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="mt-3 text-sm text-gray-500 hover:text-gray-700"
            >
              {showDetails ? '詳細を隠す' : '詳細を表示'}
            </button>
          )}
          
          {showDetails && error.details && (
            <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
              {JSON.stringify(error.details, null, 2)}
            </pre>
          )}
          
          {error.errorCode && (
            <p className="mt-2 text-xs text-gray-400">
              エラーコード: {error.errorCode}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// PreviewView.tsx の修正
const handleDownload = async () => {
  try {
    const result = await applyTranslationsAction(
      file.id,
      file.filename || file.file_path || '',
      translationsData
    );
    
    if (!result.success) {
      // エラー表示コンポーネントを使用
      setError(
        <ErrorDisplay 
          error={result} 
          onRetry={result.isRetryable ? handleDownload : undefined}
        />
      );
      return;
    }
    
    // 成功処理
    if (result.translatedPath) {
      // 成功通知（トースト推奨）
      showToast({
        type: 'success',
        title: '翻訳完了',
        message: 'ファイルのダウンロードを開始します。',
        duration: 3000
      });
      
      // ダウンロード処理
      // ...
    }
  } catch (error) {
    // 予期しないエラー
    setError(
      <ErrorDisplay 
        error={{
          error: 'システムエラーが発生しました',
          errorCode: ErrorCode.INTERNAL_ERROR
        }}
      />
    );
  }
};
```

---

## 📅 実装スケジュール

### Phase 1: セキュリティ強化（Week 1）
**優先度: 🔴 緊急**

1. **Day 1-2**: 入力検証層の実装
   - Zodスキーマ定義
   - 各Server Actionへの適用
   - テストケース作成

2. **Day 3-4**: レート制限の実装
   - RateLimiterクラス作成
   - Server Actionsへの統合
   - 負荷テスト実施

3. **Day 5**: ファイルロック機構
   - FileLockManager実装
   - 並行処理テスト

### Phase 2: エラー処理改善（Week 2）
**優先度: 🟡 重要**

1. **Day 1-2**: エラークラス体系
   - AppErrorクラス定義
   - ErrorFactory実装
   - 既存コードへの適用

2. **Day 3-4**: ロギング強化
   - 構造化ログ実装
   - エラー追跡システム
   - アラート設定

3. **Day 5**: UI改善
   - ErrorDisplayコンポーネント
   - トースト通知
   - リトライUI

### Phase 3: テスト品質向上（Week 3）
**優先度: 🟢 必要**

1. **Day 1-2**: 統合テスト
   - Server Actions呼び出し検証
   - データベース状態確認
   - エンドツーエンドフロー

2. **Day 3-4**: セキュリティテスト
   - ペネトレーションテスト
   - 負荷テスト
   - 境界値テスト

3. **Day 5**: ドキュメント化
   - テスト戦略文書
   - エラーコード一覧
   - トラブルシューティングガイド

---

## 🎯 成功指標

### セキュリティ
- [ ] 全Server Actionsに入力検証実装
- [ ] レート制限により99%のDDoS攻撃を防御
- [ ] OWASP Top 10の脆弱性なし

### エラー処理
- [ ] エラーメッセージの明確性スコア > 90%
- [ ] エラーからの平均回復時間 < 30秒
- [ ] ユーザーサポート問い合わせ50%減少

### テスト品質
- [ ] コードカバレッジ > 80%
- [ ] エラーケーステスト > 100件
- [ ] E2Eテスト成功率 > 95%

---

## 📝 チェックリスト

### 実装前
- [ ] 現在のコードのバックアップ
- [ ] ステージング環境の準備
- [ ] ロールバック計画の策定

### 実装中
- [ ] 各フェーズのコードレビュー
- [ ] セキュリティ監査
- [ ] パフォーマンステスト

### 実装後
- [ ] 本番環境へのデプロイ
- [ ] モニタリング設定
- [ ] ドキュメント更新

---

## 🚀 次のアクション

1. **即座に実施**
   - セキュリティ脆弱性の修正（入力検証）
   - クリティカルなエラーハンドリング修正

2. **今週中に実施**
   - レート制限の実装
   - 主要なエラーケースのテスト追加

3. **今月中に実施**
   - 完全なテストスイートの構築
   - ドキュメント整備