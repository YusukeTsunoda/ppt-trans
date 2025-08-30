# ESLint警告修正計画書
*作成日: 2025-08-30*

## 概要
現在56件のESLint警告が存在します。以下、ファイルごとに詳細な修正計画を記載します。

## 警告の分類

### 1. 未使用変数・インポート (40件)
### 2. 無名デフォルトエクスポート (4件)
### 3. React Hook依存関係 (1件)
### 4. その他 (11件)

---

## 詳細修正計画

### 📁 **src/app/preview/[id]/PreviewView.tsx**
#### 警告1: Line 3:31
```typescript
現状: import { useState, useCallback } from 'react';
問題: 'useCallback' is defined but never used
修正: import { useState } from 'react';
```

#### 警告2: Line 89:9
```typescript
現状: const router = useRouter();
問題: 'router' is assigned a value but never used
修正: const _router = useRouter(); // または削除
```

#### 警告3: Line 91:10
```typescript
現状: const [extractedData, setExtractedData] = useState();
問題: 'extractedData' is assigned a value but never used
修正: const [_extractedData, setExtractedData] = useState();
```

#### 警告4: Line 296:6
```typescript
現状: useEffect(() => { ... }, [fileId, mode]);
問題: Missing dependency: 'extractText'
修正: useEffect(() => { ... }, [fileId, mode, extractText]);
```

#### 警告5: Line 458:9
```typescript
現状: const displayTexts = extractedData?.texts || [];
問題: 'displayTexts' is assigned a value but never used
修正: 削除またはコメントアウト
```

#### 警告6: Line 582:15
```typescript
現状: const tempMessage = '一時的なメッセージ';
問題: 'tempMessage' is assigned a value but never used
修正: 削除またはコメントアウト
```

#### 警告7: Line 930:43
```typescript
現状: texts.map((text, index) => ...)
問題: 'index' is defined but never used
修正: texts.map((text, _index) => ...)
```

---

### 📁 **src/app/profile/page.tsx**
#### 警告1: Line 32:9
```typescript
現状: const profile = await getProfile();
問題: 'profile' is assigned a value but never used
修正: const _profile = await getProfile(); // または実際に使用する
```

---

### 📁 **src/app/files/FilesView.tsx**
#### 警告1: Line 3:33
```typescript
現状: import { useState, useCallback, memo } from 'react';
問題: 'memo' is defined but never used
修正: import { useState, useCallback } from 'react';
```

---

### 📁 **src/components/dashboard/DashboardView.tsx**
#### 警告1: Line 3:27
```typescript
現状: import { useState, useEffect, useMemo } from 'react';
問題: 'useEffect' is defined but never used
修正: import { useState, useMemo } from 'react';
```

#### 警告2: Line 3:51
```typescript
現状: import { useState, useEffect, useMemo } from 'react';
問題: 'useMemo' is defined but never used
修正: import { useState } from 'react';
```

#### 警告3: Line 8:10
```typescript
現状: import { Plus, FileText } from 'lucide-react';
問題: 'Plus' is defined but never used
修正: import { FileText } from 'lucide-react';
```

#### 警告4: Line 35:25
```typescript
現状: const [isTranslating, setIsTranslating] = useState(false);
問題: 'setIsTranslating' is assigned a value but never used
修正: const [_isTranslating, _setIsTranslating] = useState(false);
```

#### 警告5: Line 36:26
```typescript
現状: const [translateError, setTranslateError] = useState(null);
問題: 'setTranslateError' is assigned a value but never used
修正: const [_translateError, _setTranslateError] = useState(null);
```

#### 警告6: Line 215:9
```typescript
現状: const supabase = createClient();
問題: 'supabase' is assigned a value but never used
修正: 削除またはコメントアウト
```

---

### 📁 **src/components/DynamicAdminLoader.tsx**
#### 警告1: Line 48:38
```typescript
現状: onError={(error, errorInfo, type) => {
問題: 'type' is defined but never used
修正: onError={(error, errorInfo, _type) => {
```

---

### 📁 **src/components/GlobalErrorBoundary.tsx**
#### 警告1: Line 4:10
```typescript
現状: import { AppError } from '@/lib/errors/AppError';
問題: 'AppError' is defined but never used
修正: 削除またはコメントアウト
```

---

### 📁 **src/components/PreviewScreen.tsx**
#### 警告1: Line 3:38
```typescript
現状: import { useCallback, useMemo } from 'react';
問題: 'useCallback' is defined but never used
修正: import { useMemo } from 'react';
```

#### 警告2: Line 3:51
```typescript
現状: import { useCallback, useMemo } from 'react';
問題: 'useMemo' is defined but never used
修正: 削除
```

---

### 📁 **src/components/auth/ForgotPasswordForm.tsx**
#### 警告1: Line 24:13
```typescript
現状: const { data, error } = await response.json();
問題: 'data' is assigned a value but never used
修正: const { data: _data, error } = await response.json();
```

#### 警告2: Line 29:14
```typescript
現状: } catch (err) {
問題: 'err' is defined but never used
修正: } catch (_err) {
```

---

### 📁 **src/components/auth/SignupForm.tsx**
#### 警告1: Line 49:14
```typescript
現状: } catch (err) {
問題: 'err' is defined but never used
修正: } catch (_err) {
```

---

### 📁 **src/components/layout/AccessibleLayout.tsx**
#### 警告1: Line 4:8
```typescript
現状: import Link from 'next/link';
問題: 'Link' is defined but never used
修正: 削除
```

---

### 📁 **src/components/preview/PreviewSlide.tsx**
#### 警告1: Line 3:28
```typescript
現状: import { useEffect } from 'react';
問題: 'useEffect' is defined but never used
修正: 削除
```

---

### 📁 **src/components/preview/SlideViewer.tsx**
#### 警告1: Line 52:9
```typescript
現状: const scale = Math.min(...);
問題: 'scale' is assigned a value but never used
修正: const _scale = Math.min(...); // または実際に使用
```

#### 警告2: Line 60:9
```typescript
現状: const slideHeight = 540;
問題: 'slideHeight' is assigned a value but never used
修正: 削除またはコメントアウト
```

---

### 📁 **src/components/upload/UploadForm.tsx**
#### 警告1: Line 6:10
```typescript
現状: import { FILE_EXTENSIONS } from '@/constants/mime-types';
問題: 'FILE_EXTENSIONS' is defined but never used
修正: 削除
```

---

### 📁 **src/hooks/useCSRF.ts**
#### 警告1: Line 97:12
```typescript
現状: } catch (error) {
問題: 'error' is defined but never used
修正: } catch (_error) {
```

---

### 📁 **src/lib/auth/utils.ts**
#### 警告1: Line 8:46
```typescript
現状: export function validateAuth(session: any, email: string) {
問題: 'email' is defined but never used
修正: export function validateAuth(session: any, _email: string) {
```

---

### 📁 **src/lib/optimization/bundle-monitor.tsx**
#### 警告1: Line 247:13
```typescript
現状: const monitor = new BundleMonitor();
問題: 'monitor' is assigned a value but never used
修正: 削除またはコメントアウト
```

#### 警告2: Line 253:13
```typescript
現状: const monitor = new BundleMonitor();
問題: 'monitor' is assigned a value but never used
修正: 削除またはコメントアウト
```

---

### 📁 **src/lib/optimization/dynamic-import-strategy.tsx**
#### 警告1: Line 6:38
```typescript
現状: import { Suspense } from 'react';
問題: 'Suspense' is defined but never used
修正: 削除
```

#### 警告2: Line 188:5
```typescript
現状: loading: LoadingComponent,
問題: 'loading' is assigned a value but never used
修正: _loading: LoadingComponent,
```

---

### 📁 **src/lib/optimization/preload-strategy.tsx**
#### 警告1: Line 4:10
```typescript
現状: import { useRouter } from 'next/navigation';
問題: 'useRouter' is defined but never used
修正: 削除
```

#### 警告2: Line 138:24
```typescript
現状: } catch (error) {
問題: 'error' is defined but never used
修正: } catch (_error) {
```

---

### 📁 **src/lib/security/session-manager.ts**
#### 警告1: Line 131:15
```typescript
現状: const payload = jwt.verify(...);
問題: 'payload' is assigned a value but never used
修正: const _payload = jwt.verify(...); // または実際に使用
```

---

### 📁 **src/lib/security/token-rotation.ts**
#### 警告1: Line 2:10
```typescript
現状: import { CSRFProtection } from './csrf';
問題: 'CSRFProtection' is defined but never used
修正: 削除
```

---

### 📁 **src/lib/security/xssProtection.ts**
#### 警告1: Line 11:1
```typescript
現状: export default { sanitize };
問題: Assign object to a variable before exporting
修正: const xssProtection = { sanitize }; export default xssProtection;
```

---

### 📁 **src/lib/supabase/__mocks__/server.js**
#### 警告1: Line 57:1
```typescript
現状: export default { createClient };
問題: Assign object to a variable before exporting
修正: const mockServer = { createClient }; export default mockServer;
```

---

### 📁 **src/lib/translation/claude-translator.ts**
#### 警告1: Line 246:20
```typescript
現状: } catch (cell) {
問題: 'cell' is assigned a value but never used
修正: } catch (_cell) {
```

---

### 📁 **src/lib/translation/pptx-translation-service.ts**
#### 警告1: Line 248:5
```typescript
現状: async function translate(text, config) {
問題: 'config' is defined but never used
修正: async function translate(text, _config) {
```

---

### 📁 **src/lib/translation/translator.ts**
#### 警告1: Line 37:1
```typescript
現状: export default { translate };
問題: Assign object to a variable before exporting
修正: const translator = { translate }; export default translator;
```

---

### 📁 **src/types/api.ts**
#### 警告1: Line 5:15
```typescript
現状: import { JsonObject } from 'type-fest';
問題: 'JsonObject' is defined but never used
修正: 削除
```

---

## 修正優先順位

### 🔴 高優先度（機能に影響する可能性）
1. React Hook依存関係の警告（PreviewView.tsx Line 296）
2. 無名デフォルトエクスポート（4件）

### 🟡 中優先度（コード品質）
1. 未使用の状態変数（setIsTranslating, setTranslateError等）
2. 未使用のルーター変数

### 🟢 低優先度（クリーンアップ）
1. 未使用のインポート
2. 未使用のローカル変数
3. catchブロックの未使用エラー変数

## 実装手順

1. **Phase 1**: 高優先度の修正（5分）
2. **Phase 2**: 中優先度の修正（10分）
3. **Phase 3**: 低優先度の修正（15分）
4. **Phase 4**: 最終検証とビルド（5分）

合計所要時間: 約35分