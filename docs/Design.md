# デザインシステム仕様書

## 1. プロフェッショナル・ブルー系

**カラーパレット:**

- プライマリ: `#2563eb` (鮮やかなブルー)
- セカンダリ: `#64748b` (スレートグレー)
- アクセント: `#10b981` (エメラルドグリーン)
- 背景: `#f8fafc` (ライトグレー)
- テキスト: `#1e293b` (ダークグレー)


## 視覚デザインの推奨要素

### レイアウト構成

1. **ツインパネル設計**: 左側に原文、右側に翻訳文
2. **言語切り替えボタン**: 中央に配置された矢印アイコン
3. **ツールバー**: 上部に翻訳履歴、設定、言語選択
4. **フローティングアクション**: 音声入力、カメラ翻訳ボタン


### タイポグラフィ

- **見出し**: Inter、Poppins（モダン・読みやすい）
- **本文**: Source Sans Pro、Noto Sans（多言語対応）
- **コード**: JetBrains Mono（技術的な内容用）


### アイコンとイラスト

- **Lucide React**: 一貫性のあるアイコンセット
- **言語アイコン**: 国旗よりも文字（A→あ）で表現
- **ステータス表示**: 翻訳中、完了、エラーの視覚的フィードバック


### インタラクション要素

- **ホバー効果**: 微細なアニメーション（0.2s transition）
- **ローディング**: スケルトンスクリーンやプログレスバー
- **フィードバック**: 成功時のチェックマーク、エラー時の警告色


## Tailwind CSS実装ガイド

### カラークラス

```css
/* プライマリカラー */
bg-blue-600 → #2563eb
text-blue-600 → #2563eb
border-blue-600 → #2563eb

/* セカンダリカラー */
bg-slate-500 → #64748b
text-slate-500 → #64748b
border-slate-500 → #64748b

/* アクセントカラー */
bg-emerald-500 → #10b981
text-emerald-500 → #10b981
border-emerald-500 → #10b981

/* 背景色 */
bg-slate-50 → #f8fafc

/* テキスト色 */
text-slate-900 → #1e293b
```

### コンポーネントスタイル

```css
/* ボタン - プライマリ */
.btn-primary {
  @apply bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-lg transition-all duration-200;
}

/* ボタン - セカンダリ */
.btn-secondary {
  @apply bg-slate-100 text-slate-700 hover:bg-slate-200 px-4 py-2 rounded-lg transition-all duration-200;
}

/* カード */
.card {
  @apply bg-white rounded-xl shadow-sm border border-slate-200 p-6;
}

/* 入力フィールド */
.input {
  @apply border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200;
}
```

### アニメーション

```css
/* ホバートランジション */
transition-all duration-200

/* フェードイン */
animate-fadeIn

/* パルス */
animate-pulse

/* スピン（ローディング） */
animate-spin
```

## 実装チェックリスト

- [ ] すべてのページで統一されたカラーパレットを使用
- [ ] ボタンのホバー効果を0.2秒のトランジションで実装
- [ ] ローディング時のスケルトンスクリーンまたはプログレスバー
- [ ] 成功・エラー時の視覚的フィードバック
- [ ] レスポンシブデザインの確保
- [ ] アクセシビリティ（コントラスト比、フォーカス表示）