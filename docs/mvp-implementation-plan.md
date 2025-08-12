# MVP実装計画書

## 概要
PPTTranslatorAppのMVP機能完成に向けた実装計画書です。
作成日: 2025-01-12

## 優先順位と実装順序

### Phase 1: エラーハンドリング強化（優先度: 最高）
**推定工数**: 3-4時間
**理由**: ユーザー体験に直接影響し、現在のシステムの安定性を向上させる

#### 1.1 リトライ機能の実装
**対象ファイル**:
- `/src/server-actions/translate/process.ts`
- `/src/server-actions/files/upload.ts`
- `/src/lib/utils/retry.ts` (新規作成)

**実装内容**:
```typescript
// retry.ts
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    delay?: number;
    backoff?: boolean;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T>
```

**具体的な変更**:
1. Claude API呼び出しにリトライロジック追加
2. ファイルアップロード処理にリトライ追加
3. PPTX生成処理にリトライ追加

#### 1.2 エラーメッセージの改善
**対象ファイル**:
- `/src/lib/errors/ErrorCodes.ts`
- `/src/lib/errors/AppError.ts`
- `/src/components/ErrorBoundary.tsx` (新規作成)

**実装内容**:
1. エラーコードの詳細化
2. ユーザー向けメッセージの日本語化
3. 技術的詳細をログに記録
4. ErrorBoundaryコンポーネントの実装

### Phase 2: PPTX生成機能の完成（優先度: 高）
**推定工数**: 4-5時間
**理由**: コア機能の一貫性を保ち、技術的負債を削減

#### 2.1 EditorScreenのServer Action移行
**対象ファイル**:
- `/src/components/EditorScreen.tsx`
- `/src/server-actions/generate/pptx.ts`

**実装内容**:
```typescript
// EditorScreen.tsx の変更
// Before:
const response = await fetch('/api/generate-pptx', {...});

// After:
import { generatePptx } from '@/server-actions/generate/pptx';
const result = await generatePptx(formData);
```

#### 2.2 PreviewScreenのServer Action移行
**対象ファイル**:
- `/src/components/PreviewScreen.tsx`
- `/src/server-actions/generate/pptx.ts`

**実装内容**:
- ダウンロード処理のServer Action化
- エラーハンドリングの統一

### Phase 3: パフォーマンス最適化（優先度: 中）
**推定工数**: 5-6時間
**理由**: ユーザー体験の向上とシステムの安定性確保

#### 3.1 翻訳進捗表示の実装
**対象ファイル**:
- `/src/components/ProgressIndicator.tsx` (新規作成)
- `/src/app/page.tsx`
- `/src/server-actions/translate/process.ts`

**実装内容**:
```typescript
// ProgressIndicator.tsx
interface ProgressIndicatorProps {
  current: number;
  total: number;
  status: 'idle' | 'processing' | 'completed' | 'error';
  message?: string;
}
```

**具体的な実装**:
1. Server-Sent Events (SSE) を使用したリアルタイム進捗更新
2. 各スライドの処理状況を表示
3. 推定残り時間の表示

#### 3.2 タイムアウト対策
**対象ファイル**:
- `/src/lib/config.ts`
- `/src/server-actions/translate/process.ts`
- `/src/server-actions/files/upload.ts`

**実装内容**:
```typescript
// config.ts
export const TIMEOUT_CONFIG = {
  upload: 60000,        // 60秒
  translation: 300000,  // 5分
  generation: 180000,   // 3分
};
```

**具体的な実装**:
1. 各処理に適切なタイムアウト設定
2. タイムアウト時の適切なエラーメッセージ
3. 部分的な成功の処理

#### 3.3 大容量ファイル対応
**対象ファイル**:
- `/src/middleware.ts`
- `/src/server-actions/files/upload.ts`
- `/src/lib/utils/stream.ts` (新規作成)

**実装内容**:
1. ストリーミングアップロードの実装
2. チャンク処理の実装
3. メモリ効率的な処理

## 実装スケジュール

### Day 1 (今日)
- [ ] Phase 1.1: リトライ機能の実装 (2時間)
- [ ] Phase 1.2: エラーメッセージの改善 (2時間)

### Day 2
- [ ] Phase 2.1: EditorScreenのServer Action移行 (2.5時間)
- [ ] Phase 2.2: PreviewScreenのServer Action移行 (2.5時間)

### Day 3
- [ ] Phase 3.1: 翻訳進捗表示の実装 (3時間)
- [ ] Phase 3.2: タイムアウト対策 (1.5時間)

### Day 4
- [ ] Phase 3.3: 大容量ファイル対応 (2時間)
- [ ] テストとドキュメント更新 (2時間)

## 成功基準

### Phase 1
- [ ] ネットワークエラー時に自動リトライが動作する
- [ ] ユーザーに分かりやすいエラーメッセージが表示される
- [ ] エラーログが適切に記録される

### Phase 2
- [ ] EditorScreen/PreviewScreenがServer Actionを使用
- [ ] APIエンドポイント `/api/generate-pptx` が削除可能
- [ ] ダウンロード機能が正常に動作

### Phase 3
- [ ] 翻訳進捗がリアルタイムで表示される
- [ ] 50MB以上のファイルが処理可能
- [ ] タイムアウトエラーが適切に処理される

## リスクと対策

### リスク1: Server Action移行時のデグレード
**対策**: 
- 既存の処理をバックアップ
- 段階的な移行とテスト
- ロールバック計画の準備

### リスク2: パフォーマンス改善による複雑性増加
**対策**:
- シンプルな実装を優先
- 必要に応じて外部ライブラリを活用
- コード分割とモジュール化

### リスク3: 時間超過
**対策**:
- 各フェーズを独立して実装可能に設計
- 優先順位に基づいて実装
- 必要に応じてスコープ調整

## 技術的決定事項

### Server Actions vs API Routes
- **決定**: Server Actionsを全面採用
- **理由**: 型安全性、開発効率、Next.js 14の推奨パターン

### エラーハンドリング戦略
- **決定**: AppError + ErrorBoundary + リトライ
- **理由**: 一貫性のあるエラー処理と優れたUX

### 進捗表示の実装方法
- **決定**: Server-Sent Events (SSE)
- **理由**: リアルタイム性とシンプルな実装

## 次のステップ

1. この計画書のレビューと承認
2. Phase 1.1のリトライ機能実装開始
3. 各フェーズ完了後の動作確認
4. ドキュメントの更新

---
**作成者**: Claude Assistant
**最終更新**: 2025-01-12