# 重要修正ロードマップ

## 修正優先順位と実施計画

### 🚨 Phase 1: 即座対応必須（今すぐ〜24時間以内）

#### 1.1 環境変数の露出を削除（セキュリティ Critical）

**対象ファイル: `src/components/providers/AuthProvider.tsx`**

```typescript
// Line 88-94: 削除すべきコード
console.log('🔍 Supabase環境変数確認:');
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 
  `${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 20)}...` : 
  'undefined'
);

// 修正後: 完全に削除するか、開発環境のみに制限
if (process.env.NODE_ENV === 'development') {
  console.log('🔍 Supabase configuration loaded');
  // 具体的な値は出力しない
}
```

**対象ファイル: `src/components/providers/test-mode.ts`**

```typescript
// Line 20-23: 削除すべきコード
console.log('⚠️ Test Mode Detection:', {
  pathname,
  env: process.env.NEXT_PUBLIC_TEST_MODE
});

// 修正後: 削除
// テストモードの検出はログに残さない
```

#### 1.2 XSS脆弱性の修正（セキュリティ Critical）

**対象ファイル: `src/components/preview/PreviewScreen.tsx` (Line 156)**

```typescript
// 危険な実装
<div dangerouslySetInnerHTML={{ __html: content }} />

// 修正後: サニタイズを追加
import DOMPurify from 'isomorphic-dompurify';

const sanitizedContent = DOMPurify.sanitize(content, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'li', 'ol'],
  ALLOWED_ATTR: []
});

<div dangerouslySetInnerHTML={{ __html: sanitizedContent }} />
```

**必要なパッケージのインストール:**
```bash
npm install isomorphic-dompurify @types/dompurify
```

**対象ファイル: `src/components/translation/TranslationDisplay.tsx` (Line 89)**

```typescript
// 同様の修正を適用
import DOMPurify from 'isomorphic-dompurify';

// 翻訳テキストをサニタイズ
const sanitizedTranslation = DOMPurify.sanitize(translatedText);
```

#### 1.3 CSPヘッダーの実装（セキュリティ Critical）

**対象ファイル: `src/middleware.ts`**

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 既存のインポートに追加
const CSP_HEADER = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https: blob:;
  font-src 'self' data:;
  connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
`.replace(/\s{2,}/g, ' ').trim();

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // CSPヘッダーを追加
  response.headers.set('Content-Security-Policy', CSP_HEADER);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // 既存のミドルウェアロジック...
  
  return response;
}
```

### 🔥 Phase 2: 48時間以内に対応

#### 2.1 メモリリークの修正（パフォーマンス High）

**対象ファイル: `src/components/upload/UploadStatus.tsx`**

```typescript
// useEffectのクリーンアップを追加
useEffect(() => {
  let intervalId: NodeJS.Timeout;
  
  if (status === 'processing') {
    intervalId = setInterval(() => {
      // 処理
    }, 1000);
  }
  
  return () => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  };
}, [status]);
```

**対象ファイル: `src/components/translation/TranslationProgress.tsx`**

```typescript
// 同様のクリーンアップパターンを適用
useEffect(() => {
  const controller = new AbortController();
  
  fetchTranslationStatus(controller.signal);
  
  return () => {
    controller.abort();
  };
}, []);
```

#### 2.2 過度な再レンダリングの修正（パフォーマンス High）

**対象ファイル: `src/components/dashboard/FileList.tsx`**

```typescript
import { memo, useCallback, useMemo } from 'react';

// メモ化を追加
const FileListItem = memo(({ file, onDelete, onTranslate }) => {
  // コンポーネント実装
}, (prevProps, nextProps) => {
  return prevProps.file.id === nextProps.file.id &&
         prevProps.file.status === nextProps.file.status;
});

// コールバックをメモ化
const handleDelete = useCallback((fileId: string) => {
  // 削除処理
}, []);

const handleTranslate = useCallback((fileId: string) => {
  // 翻訳処理
}, []);
```

#### 2.3 TODOの実装完了（品質 High）

**対象ファイル: `src/lib/memory/MemoryManager.ts` (Line 145)**

```typescript
// TODO: エラーハンドリングを実装
async updateSlideMemory(slideId: string, updates: Partial<SlideMemory>): Promise<void> {
  try {
    const currentMemory = await this.getSlideMemory(slideId);
    if (!currentMemory) {
      throw new Error(`Slide memory not found: ${slideId}`);
    }
    
    const updatedMemory = {
      ...currentMemory,
      ...updates,
      lastUpdated: Date.now()
    };
    
    await this.storage.set(`slide:${slideId}`, updatedMemory);
    
    // キャッシュも更新
    this.cache.set(`slide:${slideId}`, updatedMemory);
    
  } catch (error) {
    logger.error('Failed to update slide memory', { slideId, error });
    throw new MemoryUpdateError(`Failed to update slide ${slideId}`, error);
  }
}
```

### 📝 Phase 3: 1週間以内に対応

#### 3.1 単体テストの追加（品質 Critical）

**作成すべきテストファイル:**

1. `tests/lib/validators/fileValidator.test.ts`
```typescript
import { validateFile, validateFileSize, validateFileType } from '@/lib/validators/fileValidator';

describe('fileValidator', () => {
  describe('validateFileType', () => {
    it('should accept valid PPTX files', () => {
      const file = new File([''], 'test.pptx', { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
      expect(validateFileType(file)).toBe(true);
    });
    
    it('should reject invalid file types', () => {
      const file = new File([''], 'test.pdf', { type: 'application/pdf' });
      expect(validateFileType(file)).toBe(false);
    });
  });
  
  describe('validateFileSize', () => {
    it('should accept files under 100MB', () => {
      const file = new File(['a'.repeat(50 * 1024 * 1024)], 'test.pptx');
      expect(validateFileSize(file)).toBe(true);
    });
    
    it('should reject files over 100MB', () => {
      const file = new File(['a'.repeat(101 * 1024 * 1024)], 'test.pptx');
      expect(validateFileSize(file)).toBe(false);
    });
  });
});
```

2. `tests/lib/memory/MemoryManager.test.ts`
```typescript
import { MemoryManager } from '@/lib/memory/MemoryManager';
import { LocalStorageAdapter } from '@/lib/memory/storage/LocalStorageAdapter';

describe('MemoryManager', () => {
  let manager: MemoryManager;
  
  beforeEach(() => {
    const storage = new LocalStorageAdapter();
    manager = new MemoryManager(storage);
  });
  
  afterEach(() => {
    localStorage.clear();
  });
  
  describe('saveSlideMemory', () => {
    it('should save slide memory correctly', async () => {
      const slideMemory = {
        slideId: 'slide-1',
        originalText: 'Original',
        translatedText: 'Translated',
        confidence: 0.95
      };
      
      await manager.saveSlideMemory(slideMemory);
      const retrieved = await manager.getSlideMemory('slide-1');
      
      expect(retrieved).toEqual(expect.objectContaining(slideMemory));
    });
  });
});
```

#### 3.2 コンポーネントの分割（保守性 Medium）

**対象ファイル: `src/components/preview/PreviewScreen.tsx`**

分割計画:
```
PreviewScreen.tsx (400行) → 
  ├── PreviewScreen.tsx (100行 - メインコンテナ)
  ├── PreviewSlide.tsx (80行 - スライド表示)
  ├── PreviewControls.tsx (60行 - コントロール)
  ├── PreviewNavigation.tsx (50行 - ナビゲーション)
  ├── PreviewToolbar.tsx (50行 - ツールバー)
  └── hooks/usePreviewState.ts (60行 - ステート管理)
```

### 📊 Phase 4: 2週間以内に対応

#### 4.1 パフォーマンス最適化

**バンドルサイズの削減:**

1. `next.config.js`に追加:
```javascript
module.exports = {
  // 既存の設定...
  
  // バンドル分析の有効化
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          vendor: {
            name: 'vendor',
            chunks: 'all',
            test: /node_modules/,
            priority: 20
          },
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            priority: 10,
            reuseExistingChunk: true,
            enforce: true
          }
        }
      };
    }
    return config;
  }
};
```

2. 動的インポートの活用:
```typescript
// src/components/preview/PreviewScreen.tsx
const TranslationModal = dynamic(
  () => import('@/components/modals/TranslationModal'),
  { loading: () => <LoadingSpinner /> }
);
```

## 実装チェックリスト

### Week 1 (Critical Security & Performance)
- [ ] 環境変数ログの削除
- [ ] XSS脆弱性の修正（DOMPurify導入）
- [ ] CSPヘッダーの実装
- [ ] メモリリークの修正
- [ ] 再レンダリング最適化

### Week 2 (Quality & Testing)
- [ ] 単体テスト追加（最低10ファイル）
- [ ] TODOの実装完了
- [ ] エラーハンドリングの統一
- [ ] コンポーネント分割

### Week 3 (Optimization)
- [ ] バンドルサイズ最適化
- [ ] 画像最適化
- [ ] API応答時間改善
- [ ] キャッシュ戦略の実装

### Week 4 (Documentation & Monitoring)
- [ ] API ドキュメント整備
- [ ] パフォーマンス監視設定
- [ ] エラー監視設定（Sentry等）
- [ ] デプロイメントドキュメント更新

## 成功指標

1. **セキュリティ**: 全ての Critical 脆弱性が修正される
2. **パフォーマンス**: Lighthouse スコア 90+ 達成
3. **品質**: テストカバレッジ 80% 以上
4. **保守性**: 全てのTODO解決、コンポーネント100行以下

## リスクと対策

| リスク | 影響度 | 対策 |
|--------|--------|------|
| 本番環境への影響 | High | ステージング環境で十分にテスト |
| 既存機能の破壊 | Medium | E2Eテストの実行を必須化 |
| スケジュール遅延 | Low | 週次レビューで進捗確認 |