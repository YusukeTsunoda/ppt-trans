# 技術的負債管理ドキュメント

## 概要
このドキュメントは、PPTTranslatorAppプロジェクトにおける技術的負債を記録し、将来的な改善計画を管理するためのものです。

---

## 未対応タスク一覧

### 1. EditorScreenとPreviewScreenのServer Action移行
**優先度**: 中
**推定工数**: 4-6時間
**作成日**: 2025-01-12

#### 概要
`EditorScreen.tsx`と`PreviewScreen.tsx`コンポーネントが、`/api/generate-pptx`エンドポイントを直接呼び出している箇所を、既存のServer Action `generatePptx`を使用するようにリファクタリングする。

#### 現状
```typescript
// 現在の実装（EditorScreen.tsx:56, PreviewScreen.tsx:298）
const response = await fetch('/api/generate-pptx', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ fileId, translatedTexts })
});
```

#### 期待される実装
```typescript
// Server Actionを使用した実装
import { generatePptx } from '@/server-actions/generate/pptx';
const result = await generatePptx({ fileId, translatedTexts });
```

#### リファクタリングが必要な理由
1. **コードの一貫性**: プロジェクト全体でServer Actionsへの移行を進めており、一貫性を保つため
2. **開発体験の向上**: 型安全性の向上、エラーハンドリングの統一
3. **セキュリティ強化**: Server Actionsによる自動的な認証チェック、CSRFトークン管理
4. **保守性の向上**: APIエンドポイントの削減により、管理対象が減少

#### 見送った理由
1. **コンポーネントの規模**: 両コンポーネントとも500行以上の大規模なファイル
2. **デグレードリスク**: PPTXダウンロード機能は重要な機能であり、慎重なテストが必要
3. **工数とROIのバランス**: 現在の実装も正常に動作しており、緊急性が低い
4. **リリース優先度**: 今回のスプリントでは新機能開発を優先

#### 推奨される対応時期
- **ケース1**: EditorScreenまたはPreviewScreenに機能追加・修正が必要になった際に同時に対応
- **ケース2**: 技術的負債返済スプリントを設けて集中的に対応
- **ケース3**: パフォーマンス改善プロジェクトの一環として対応

#### 影響範囲
- `/src/components/EditorScreen.tsx`
- `/src/components/PreviewScreen.tsx`
- `/src/app/api/generate-pptx/route.ts` (削除可能)

#### テスト項目
- [ ] PPTXファイルの生成が正常に動作すること
- [ ] ダウンロード機能が正常に動作すること
- [ ] エラーハンドリングが適切に行われること
- [ ] 認証チェックが正しく機能すること

---

### 2. 未実装のAPI Routes
**優先度**: 高
**推定工数**: 2-3時間
**作成日**: 2025-01-12

#### 概要
コンポーネント側から呼び出されているが、実装されていないAPIエンドポイントが存在する。

#### 対象
- `/api/error-report` - エラーレポート機能
- `/api/generation-status/{id}` - 生成ステータス確認

#### 対応方針
これらのAPIもServer Actionsとして実装し、呼び出し側を更新する。

---

## 技術的改善の機会

### パフォーマンス最適化
1. **バンドルサイズの削減**
   - 現在のビルドでフレームワークのサイズが656KiBと大きい
   - Dynamic Importの更なる活用検討

2. **Server Components活用の拡大**
   - 現在多くのページが`'use client'`を使用
   - 静的な部分をServer Componentとして分離可能

### セキュリティ強化
1. **レート制限の実装**
   - Server Actions全体に対するレート制限機能の追加
   
2. **入力検証の強化**
   - zodスキーマの更なる活用

---

## 管理方法

### タスク管理ツールへの登録
以下の内容でタスクを作成することを推奨：

**タイトル**: [Tech Debt] EditorScreen/PreviewScreenのServer Action移行
**タイプ**: Technical Task
**優先度**: Medium
**ラベル**: tech-debt, refactoring, server-actions
**説明**: 上記の詳細内容を記載

### レビュー頻度
- 月次の技術ミーティングで技術的負債の状況をレビュー
- 四半期ごとに技術的負債返済の計画を立案

### 判断基準
技術的負債に対応するタイミングの判断基準：
1. 該当箇所に新機能追加や修正が発生した時
2. パフォーマンスやセキュリティの問題が顕在化した時
3. 開発速度に影響が出始めた時
4. スプリントに余裕がある時

---

## 更新履歴
- 2025-01-12: 初版作成、Server Actions移行プロジェクトの完了時点での技術的負債を記録