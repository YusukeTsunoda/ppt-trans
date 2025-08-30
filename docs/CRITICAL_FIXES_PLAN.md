# 緊急修正実装計画

## 発見された問題

### 1. アップロード機能の問題
**症状**: アップロードモーダルからファイルアップロードが失敗する
**原因**: 
- `/api/upload`エンドポイントが存在しない
- UploadModalが存在しないAPIを呼び出している
- 実際のアップロード処理は`uploadFileAction`を使用すべき

### 2. CSS/カラー問題
**症状**: 
- ライトモードで文字が白く表示され読めない
- 背景とボックスが同じ白色で区別できない
- ボタンの境界が不明瞭

**原因**:
- CSS変数がHSL形式だが、Tailwindクラスが正しく適用されていない
- `text-foreground`がライトモードで白色になっている
- カラーコントラストが不十分

## 詳細な修正実装計画

### Phase 1: アップロード機能修正（優先度: 最高）

#### 1.1 UploadModalの修正

**現在の問題コード**:
```typescript
// UploadModal.tsx
const response = await fetch('/api/upload', {
  method: 'POST',
  body: formData,
});
```

**修正案A: Server Action使用（推奨）**
```typescript
import { uploadFileAction } from '@/app/actions/upload';

const handleUpload = async () => {
  const formData = new FormData();
  formData.append('file', file);
  
  const result = await uploadFileAction(null, formData);
  if (result?.success) {
    onSuccess(result.file);
  } else {
    setError(result?.error || 'アップロードに失敗しました');
  }
};
```

**修正案B: APIエンドポイント作成**
新規ファイル: `src/app/api/upload/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File;
  
  // Supabaseストレージにアップロード
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from('uploads')
    .upload(`${Date.now()}_${file.name}`, file);
    
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  
  // DBに記録
  const { data: fileRecord } = await supabase
    .from('files')
    .insert({
      filename: data.path,
      original_name: file.name,
      file_size: file.size,
      status: 'uploaded'
    })
    .select()
    .single();
    
  return NextResponse.json({ success: true, file: fileRecord });
}
```

### Phase 2: CSS/カラー修正（優先度: 高）

#### 2.1 globals.cssの修正

**現在の問題**:
```css
:root {
  --foreground: 222.2 84% 4.9%; /* 暗い色 */
}
```

**修正版**:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* ライトモード */
    --background: 0 0% 100%; /* 白 */
    --foreground: 222.2 84% 4.9%; /* ほぼ黒 */
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
    
    /* カスタムカラー追加 */
    --card-border: 0 0% 90%;
    --button-hover: 0 0% 95%;
  }
  
  .dark {
    /* ダークモード */
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 8%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 48%;
    
    --card-border: 222.2 84% 15%;
    --button-hover: 222.2 84% 12%;
  }
}

/* ベーススタイル */
@layer base {
  * {
    @apply border-border;
  }
  
  body {
    @apply bg-background text-foreground;
    font-family: var(--font-geist-sans, 'Inter'), system-ui, sans-serif;
  }
  
  /* カード要素の改善 */
  .card {
    @apply bg-card text-card-foreground border border-border shadow-sm;
  }
  
  /* ボタンの改善 */
  .btn-primary {
    @apply bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm border border-primary;
  }
  
  .btn-secondary {
    @apply bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm border border-border;
  }
}
```

#### 2.2 コンポーネントのクラス修正

**Landing Page Components修正**:
```typescript
// Hero.tsx
<h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-6xl">
  PowerPointを
  <span className="text-primary"> 瞬時に翻訳</span>
</h1>

// Features.tsx
<section className="py-24 sm:py-32 bg-gray-50 dark:bg-gray-900">

// Pricing.tsx
<div className={`rounded-3xl p-8 xl:p-10 ${
  tier.featured
    ? 'bg-white ring-2 ring-primary shadow-lg'
    : 'bg-white ring-1 ring-gray-200 shadow'
}`}>
```

### Phase 3: 統合テスト（優先度: 中）

#### 3.1 アップロード機能テスト
1. モーダルからのアップロード
2. ファイルサイズ制限確認
3. ファイル形式バリデーション
4. エラーハンドリング

#### 3.2 UIテスト
1. ライト/ダークモード切り替え
2. カラーコントラスト確認
3. レスポンシブデザイン確認
4. アクセシビリティチェック

## 実装手順

### Step 1: アップロード修正（15分）
```bash
# 1. UploadModal修正
# 2. Server Action統合
# 3. エラーハンドリング改善
```

### Step 2: CSS修正（20分）
```bash
# 1. globals.css更新
# 2. Tailwind設定確認
# 3. コンポーネントクラス修正
```

### Step 3: テスト（10分）
```bash
# 1. 開発サーバー再起動
# 2. 各機能の動作確認
# 3. ビジュアル確認
```

## リスクと対策

### リスク1: Server Action非互換
**対策**: APIエンドポイント作成をフォールバック

### リスク2: CSS変更による既存UIの破壊
**対策**: 段階的な適用と即座のビジュアル確認

### リスク3: ダークモード切り替え不具合
**対策**: ThemeProviderの設定確認

## 成功基準

1. **機能面**
   - アップロードが正常に動作
   - ファイルがダッシュボードに表示
   - エラー時に適切なメッセージ表示

2. **UI/UX面**
   - ライトモードで全テキストが読める
   - カード、ボタンの境界が明確
   - ダークモード切り替えが正常動作

3. **パフォーマンス**
   - アップロード時のレスポンス3秒以内
   - UI更新の即座反映

## 緊急度別対応順序

1. **即座対応（5分）**
   - UploadModalのAPI呼び出し修正
   
2. **短期対応（15分）**
   - CSS変数とクラス修正
   - 基本的なコントラスト改善

3. **中期対応（30分）**
   - 完全なUIオーバーホール
   - アクセシビリティ改善