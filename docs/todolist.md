<<<<<<< HEAD
 MVPとして必要な修正・機能追加の優先順位リスト

  現状のアプリケーションを分析した結果、以下の修正・機能追加が必要です：

  🔴 優先度1: 致命的な問題（MVPブロッカー）

  1. 実際のAI翻訳機能の実装

  - 現状: ハードコードされた簡易翻訳マップのみ（/src/app/api/translate-pptx/route.ts）
  - 必要な対応:
    - Anthropic Claude APIの統合実装
    - プロンプトエンジニアリング（ビジネス文書、技術文書、マーケティング資料に対応）
    - バッチ処理による大量テキストの効率的な翻訳
  - 修正箇所: /src/app/api/translate-pptx/route.tsの翻訳ロジック全体

  2. 実際のスライドプレビュー機能

  - 現状: プレースホルダー画像のみ表示
  - 必要な対応:
    - PPTXをPNGに変換する機能の実装
    - python-pptxまたはLibreOfficeを使用したサムネイル生成
    - Storageへの画像保存とキャッシュ機構
  - 修正箇所: /src/app/preview/[id]/PreviewView.tsx、新規Pythonスクリプトの作成

  🟠 優先度2: 重要な機能追加

  3. 翻訳言語の選択機能

  - 現状: 翻訳先言語が固定（英→日のみ）
  - 必要な対応:
    - 言語選択UI（ソース言語・ターゲット言語）
    - データベーススキーマに言語設定を追加
    - 翻訳APIリクエストに言語パラメータを含める
  - 修正箇所: /src/components/dashboard/DashboardView.tsxに言語選択モーダル追加

  4. 翻訳進捗の詳細表示

  - 現状: "processing"の単純なステータスのみ
  - 必要な対応:
    - WebSocketまたはServer-Sent Eventsによるリアルタイム進捗
    - スライドごとの翻訳状況表示（例: 10/30スライド完了）
    - 予想完了時間の表示
  - 修正箇所: 新規WebSocketハンドラー、DashboardViewの進捗UI

  5. エラーハンドリングの改善

  - 現状: E2Eテストで多数のエラー（Cookie検証、フォーム状態保持など）
  - 必要な対応:
    - SupabaseのhttpOnly Cookie設定
    - Server Actionsのエラー時のフォーム状態保持
    - ユーザーフレンドリーなエラーメッセージ
  - 修正箇所: /src/app/actions/auth.ts、Supabase設定

  🟡 優先度3: UX改善

  6. ファイルサイズ制限の適切な実装

  - 現状: 10MBの制限があるが、大きなファイルの処理に問題がある可能性
  - 必要な対応:
    - チャンク処理によるアップロード
    - プログレスバー付きアップロード
    - サーバーサイドでのファイルサイズ検証
  - 修正箇所: /src/components/upload/UploadForm.tsx、/src/app/actions/upload.ts

  7. 翻訳品質の設定オプション

  - 現状: 翻訳品質の調整不可
  - 必要な対応:
    - 高速/標準/高品質モードの選択
    - 専門用語辞書の登録機能
    - 翻訳スタイルの選択（フォーマル/カジュアル）
  - 修正箇所: ユーザー設定画面の新規作成

  8. バッチダウンロード機能

  - 現状: ファイルは個別にダウンロードのみ
  - 必要な対応:
    - 複数ファイルの選択
    - ZIPファイルとしての一括ダウンロード
  - 修正箇所: /src/components/dashboard/DashboardView.tsx

  🟢 優先度4: 追加機能（MVP後）

  9. 翻訳履歴とバージョン管理

  - 同一ファイルの複数バージョン管理
  - 翻訳履歴の比較機能
  - 以前の翻訳結果の再利用

  10. コラボレーション機能

  - チーム/組織アカウント
  - ファイル共有とコメント機能
  - 承認ワークフロー

  11. API提供

  - RESTful APIの公開
  - APIキー管理
  - レート制限とUsage追跡

  12. 高度な翻訳オプション

  - 用語集のインポート/エクスポート
  - 翻訳メモリ機能
  - カスタムプロンプトテンプレート

  🔧 技術的負債の解消

  1. テスト環境の安定化
    - Playwrightテストの修正（26個中24個失敗）
    - MSWによるAPIモック環境の構築
  2. パフォーマンス最適化
    - 大容量ファイルの処理最適化
    - データベースクエリの最適化
    - キャッシュ戦略の実装
  3. セキュリティ強化
    - ファイルアップロードのウイルススキャン
    - SQLインジェクション対策の確認
    - XSS対策の強化


      最も重要なのは、実際のClaude
  API統合とスライドプレビュー機能の実装です。現在はハードコードされた翻訳マップしかなく、これではMVPとして機能しません。

  また、テストの大半が失敗している状態（26/150失敗）も品質面での懸念事項です。特にCookie認証とフォーム状態管理の問題は、ユーザー体験に直接影響す
  るため早急な対応が必要です。



  🔧 実装提案（優先度順）

  Phase 1: アップロード進捗の実装（最優先）

  // 1. XMLHttpRequestベースのアップロード進捗追跡
  const uploadWithProgress = (file: File, onProgress: (percent: number) =>
  void) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percentComplete = (e.loaded / e.total) * 100;
        onProgress(Math.round(percentComplete));
      }
    };

    xhr.open('POST', '/api/upload');
    xhr.send(formData);
  };

  // 2. UIコンポーネントの改善
  <div className="upload-progress-container">
    <div className="flex justify-between mb-2">
      <span>アップロード中...</span>
      <span>{uploadProgress}%</span>
    </div>
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div
        className="bg-blue-600 h-2 rounded-full transition-all
  duration-300"
        style={{ width: `${uploadProgress}%` }}
      />
    </div>
    <div className="text-sm text-gray-500 mt-2">
      {uploadedSize}MB / {totalSize}MB
    </div>
  </div>

  Phase 2: 翻訳進捗の細分化

  // リアルタイム進捗更新の改善
  const translateWithDetailedProgress = async () => {
    const totalItems = getAllTextItems();
    let processed = 0;
    const startTime = Date.now();

    for (const item of totalItems) {
      await translateItem(item);
      processed++;

      // 毎アイテムごとに進捗更新
      const progress = (processed / totalItems.length) * 100;
      const elapsedTime = Date.now() - startTime;
      const estimatedTotal = (elapsedTime / processed) * totalItems.length;
      const remainingTime = estimatedTotal - elapsedTime;

      setTranslationState({
        progress: Math.round(progress),
        message: `テキスト ${processed}/${totalItems.length} を処理中`,
        estimatedTime: formatTime(remainingTime),
        currentSlide: getCurrentSlideNumber(item)
      });
    }
  };

  Phase 3: 統一プログレスコンポーネント

  // 再利用可能なProgressBarコンポーネント
  interface ProgressBarProps {
    progress: number;
    status: 'idle' | 'processing' | 'success' | 'error';
    message?: string;
    estimatedTime?: string;
    showCancel?: boolean;
    onCancel?: () => void;
  }

  const ProgressBar: React.FC<ProgressBarProps> = ({
    progress,
    status,
    message,
    estimatedTime,
    showCancel,
    onCancel
  }) => {
    const getStatusColor = () => {
      switch(status) {
        case 'success': return 'bg-green-600';
        case 'error': return 'bg-red-600';
        default: return 'bg-blue-600';
      }
    };

    return (
      <div className="progress-container p-4 bg-white rounded-lg shadow">
        <div className="flex justify-between items-center mb-2">
          <span className="font-medium">{message}</span>
          <div className="flex items-center gap-2">
            {estimatedTime && (
              <span className="text-sm text-gray-500">
                残り約 {estimatedTime}
              </span>
            )}
            <span className="font-bold">{progress}%</span>
            {showCancel && (
              <button
                onClick={onCancel}
                className="ml-2 text-red-500 hover:text-red-700"
              >
                キャンセル
              </button>
            )}
          </div>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`${getStatusColor()} h-3 rounded-full transition-all
   duration-500`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div> );
  };

  📊 実装優先順位とタイムライン

  | 優先度  | 機能          | 推定工数  | 影響度             |
  |------|-------------|-------|-----------------|
  | 🔴 高 | アップロード進捗表示  | 4-6時間 | 高（UX大幅改善）       |
  | 🔴 高 | 翻訳進捗の細分化    | 3-4時間 | 高（体感速度向上）       |
  | 🟡 中 | 残り時間表示      | 2-3時間 | 中（期待値管理）        |
  | 🟡 中 | エラーハンドリング改善 | 3-4時間 | 中（信頼性向上）        |
  | 🟢 低 | キャンセル機能     | 4-5時間 | 低（Nice to have） |
=======
# PPTTranslator TODO List

更新日: 2025-08-12

## ✅ 完了済みタスク

### MVP基盤構築（完了）
- ✅ ユーザー認証システム（NextAuth.js統合）
- ✅ ファイル管理機能（アップロード、削除、一覧）
- ✅ 基本的な翻訳機能（Anthropic Claude API）
- ✅ 管理者ダッシュボード（基本機能）
- ✅ ダークモード対応
- ✅ レスポンシブデザイン（モバイル対応）

### エラーハンドリング強化（完了）
- ✅ AppErrorクラスとエラーコード体系
- ✅ 統一ロガーシステム（logger.ts）
- ✅ APIクライアントラッパー（リトライロジック）
- ✅ トースト通知システム
- ✅ ErrorBoundaryコンポーネント
- ✅ エラー詳細モーダル
- ✅ FileUploadManager（チャンク分割、自動リトライ）
- ✅ TranslationManager（部分的再試行）
- ✅ DownloadManager（レジューマブルダウンロード）

### パフォーマンス最適化（完了）
- ✅ Bull Queue（バックグラウンドジョブシステム）
- ✅ Redis キャッシング（CacheManager）
- ✅ データベースクエリ最適化（QueryOptimizer）
- ✅ 画像遅延読み込み（LazyImage）
- ✅ コンポーネント動的インポート（DynamicImports）
- ✅ Webpackバンドル最適化（コードスプリッティング）

### セキュリティ強化（完了）
- ✅ レート制限（Redis-backed、トークンバケット）
- ✅ ファイル検証（マジックナンバー、サイズ制限）
- ✅ CSRF保護（Server Actions自動対応）
- ✅ XSS対策（DOMPurify、CSPヘッダー）
- ✅ SQLインジェクション対策（Prisma）
- ✅ 入力検証（Zodスキーマ）
- ✅ セキュリティヘッダー設定

### リファクタリング（2025-08-12完了）
- ✅ 重複コードの削除
  - テスト・デバッグ用ファイル削除
  - 重複ログインページ削除
  - Pythonスクリプト統合
  - 重複認証ファイル削除
  - 古いエラーシステム削除
- ✅ Python環境修正（uv環境でpython-pptx動作）
- ✅ Server Actionハッシュ不一致エラー解決
- ✅ CSS/Tailwind適用問題修正

### 翻訳済みPPTXファイル生成の完全修正（2025-08-12完了）
- ✅ Python側generate_pptx.pyの改良版実装
  - URL/ローカルファイル両対応
  - 包括的なエラーハンドリング
  - 詳細なログ出力機能
- ✅ 日本語フォント対応の完全実装
  - 10種類の日本語フォントサポート（游ゴシック、メイリオ等）
  - 自動日本語テキスト判定機能
  - フォント継承と適用ロジック
- ✅ スタイル・レイアウト保持機能の強化
  - TextStyle/ParagraphStyleクラスによる管理
  - フォントサイズ、色、配置の保持
  - 段落書式とテキストランの完全保持
- ✅ ダウンロード機能のエラー処理改善
  - 複数のダウンロード方法実装（Fetch API → 直接リンク）
  - 詳細なエラーログとユーザー通知
  - ファイルサイズチェック機能
- ✅ ファイル生成ステータス管理システム
  - GenerationProgressコンポーネント実装
  - リアルタイム進捗表示（6段階）
  - タイムアウトと再試行機能

---

## 🔴 緊急対応（今週中に完了必須）

### 1. Server Actionハッシュ不一致エラーの完全解決
**現状**: ログイン時に「Server Action "603026d574509234a7fe86e230882fb87fc7243d5c" was not found」エラー
**原因**: 重複エクスポートとパス不統一
**修正手順**:
```bash
# 1. 重複ファイルの完全削除
rm -rf src/app/actions
rm -rf src/app/actions.ts

# 2. 全コンポーネントでパス統一確認
# 現在: @/lib/server-actions/... で統一済み（良好）

# 3. ビルドキャッシュクリア
rm -rf .next
npm run dev
```

### 2. 認証システムの完全Server Action化
**現状**: ログインページはNextAuth直接使用、登録ページはServer Action使用（不統一）
**修正方針**: 全認証機能をServer Actionに統一
```typescript:src/app/login/page.tsx
// 現在: signIn('credentials', ...) 直接使用
// 修正: Server Action経由に変更
import { loginAction } from '@/lib/server-actions/auth/login';
```

### 3. 大容量ファイル処理の改善
**現状**: 50MB以上のファイルでタイムアウト発生
**修正方針**: 
- チャンク分割アップロードの実装
- プログレスバーの改善
- バックグラウンド処理の強化

---

## 🟡 高優先度（2週間以内）

### 4. ページ構成の統一と最適化
**現状の問題**:
- メインページ（`/`）が複雑すぎる（472行）
- アップロード→プレビュー→編集→設定の流れが1ページに集約
- レスポンシブ対応が不完全

**修正方針**:
```
src/app/
├── page.tsx (シンプルなランディングページ)
├── upload/ (ファイルアップロード専用)
├── preview/ (翻訳前プレビュー)
├── editor/ (翻訳編集)
├── settings/ (設定)
└── dashboard/ (ユーザーダッシュボード)
```

### 5. データフローの最適化
**現状の問題**:
- アップロード→翻訳→編集のデータ受け渡しが複雑
- 状態管理がuseStateベースで散在
- 履歴管理が不完全

**修正方針**:
```typescript:src/lib/state/AppState.ts
// 統一された状態管理
export interface AppState {
  currentStep: 'upload' | 'preview' | 'editor' | 'settings';
  uploadResult: UploadResult | null;
  translationResult: TranslationResult | null;
  editedData: ProcessingResult | null;
  settings: Settings;
}
```

### 6. エラーハンドリングの統一
**現状**: 各コンポーネントで個別にエラー処理
**修正方針**: 統一されたエラーバウンダリーとトースト通知

---

## 🟢 中優先度（1ヶ月以内）

### 7. テスト実装
**現状**: テストカバレッジ0%
**修正方針**:
- ユニットテスト基盤構築（Jest）
- Server Actionsのテスト
- APIエンドポイントテスト
- E2Eテスト（Cypress/Playwright）
- CI/CD パイプライン構築

### 8. 支払いシステム（Stripe）統合
**現状**: 料金プラン設計のみ
**修正方針**:
- Stripe SDK統合
- 料金プラン実装（Free/Pro/Enterprise）
- サブスクリプション管理
- 使用量ベース課金
- 請求書発行機能
- 無料トライアル実装

### 9. メール通知システム
**現状**: メール送信機能なし
**修正方針**:
- SendGrid/Resend統合
- アカウント確認メール
- パスワードリセットメール
- 処理完了通知
- 月次使用量レポート

---

## 🔵 低優先度（3ヶ月以降）

### 10. 多言語UI対応
**修正方針**:
- next-i18next導入
- 英語UI翻訳
- 中国語UI翻訳
- 韓国語UI翻訳
- 言語自動検出

### 11. 他形式ファイル対応
**修正方針**:
- Word文書（.docx）
- Excel（.xlsx）
- PDF
- Google Slides連携
- Keynote対応

### 12. AI機能の拡張
**修正方針**:
- 翻訳スタイルカスタマイズ
- 自動要約機能
- スライド自動生成
- 画像生成AI連携
- OCR機能（画像内テキスト）

---

## 🔴 優先度: 最高（MVPに必須） - 1週間以内

### 2. Server Actionネイティブ方式への完全移行 **COMPLETED**
**戦略A: 完全Server Actionネイティブ方式の実装**

#### Phase 1: Server Action基盤の強化 ✅ 完了 (2025-08-12)
- [x] Server Action用ヘルパーライブラリ構築完了
- [x] エラー処理の統一化完了
- [x] 全Server Actionを`/src/lib/server-actions/`に統一

#### Phase 2: 基本機能のServer Actionネイティブ化 ✅ 完了 (2025-08-12)
- [x] 認証システムの完全移行
- [x] 翻訳機能のスタブ実装
- [x] ファイル管理機能のスタブ実装  
- [x] PPTX生成機能のスタブ実装
- [x] 管理者機能のスタブ実装
- [x] 古いAPIルートの削除完了

**現在のステータス:**
- ✅ Server Action基盤構築完了
- ✅ 全機能のServer Action化完了（一部スタブ実装）
- ✅ APIルート削除完了
- 🎯 **目標達成**: Server Actionネイティブアプリケーション

---

## 🟡 優先度: 高（早期実装推奨） - 2-3週間以内

### 4. 認証システムの完全実装
**現状**: 基本認証は動作するがセッション管理に課題
- [ ] パスワードリセット機能の完成
- [ ] メール認証の実装
- [ ] Remember Me機能
- [ ] ソーシャルログイン（Google/GitHub）
- [ ] 2要素認証（2FA）

### 5. 支払いシステム（Stripe）統合
**現状**: 料金プラン設計のみ
- [ ] Stripe SDK統合
- [ ] 料金プラン実装（Free/Pro/Enterprise）
- [ ] サブスクリプション管理
- [ ] 使用量ベース課金
- [ ] 請求書発行機能
- [ ] 無料トライアル実装

### 6. メール通知システム
**現状**: メール送信機能なし
- [ ] SendGrid/Resend統合
- [ ] アカウント確認メール
- [ ] パスワードリセットメール
- [ ] 処理完了通知
- [ ] 月次使用量レポート

### 7. テスト実装
**現状**: テストカバレッジ0%
- [ ] ユニットテスト基盤構築（Jest）
- [ ] Server Actionsのテスト
- [ ] APIエンドポイントテスト
- [ ] E2Eテスト（Cypress/Playwright）
- [ ] CI/CD パイプライン構築

---

## 🟢 優先度: 中（機能拡張） - 1-2ヶ月以内

### 8. 翻訳品質の向上
- [ ] カスタム辞書機能
- [ ] 用語集管理UI
- [ ] 翻訳メモリ機能
- [ ] 文脈保持アルゴリズム
- [ ] 専門分野別翻訳モデル選択
- [ ] スライドノートの翻訳対応

### 9. チーム・組織機能
- [ ] 組織モデルの実装
- [ ] チームメンバー管理
- [ ] ファイル共有機能
- [ ] 権限管理（RBAC）
- [ ] コメント・レビュー機能
- [ ] 活動ログ

### 10. 管理者機能の拡張
- [ ] リアルタイム統計ダッシュボード
- [ ] ユーザー管理機能の完成
- [ ] システムヘルスモニタリング
- [ ] APIキー管理
- [ ] カスタムレポート生成
- [ ] 監査ログ

### 11. API公開
- [ ] RESTful API設計・実装
- [ ] APIキー管理システム
- [ ] 使用量制限・課金
- [ ] APIドキュメント（Swagger/OpenAPI）
- [ ] SDK開発（JavaScript/Python）
- [ ] Webhook通知

---

## 🔵 優先度: 低（Nice to Have） - 3ヶ月以降

### 12. 多言語UI対応
- [ ] next-i18next導入
- [ ] 英語UI翻訳
- [ ] 中国語UI翻訳
- [ ] 韓国語UI翻訳
- [ ] 言語自動検出

### 13. 他形式ファイル対応
- [ ] Word文書（.docx）
- [ ] Excel（.xlsx）
- [ ] PDF
- [ ] Google Slides連携
- [ ] Keynote対応

### 14. AI機能の拡張
- [ ] 翻訳スタイルカスタマイズ
- [ ] 自動要約機能
- [ ] スライド自動生成
- [ ] 画像生成AI連携
- [ ] OCR機能（画像内テキスト）

### 15. モバイルアプリ
- [ ] React Native開発
- [ ] プッシュ通知
- [ ] オフライン対応
- [ ] App Store/Google Play公開

### 16. 分析・インサイト
- [ ] 使用傾向分析
- [ ] 翻訳品質スコアリング
- [ ] ユーザー行動分析
- [ ] A/Bテスト基盤
- [ ] 機械学習による最適化

---

**修正方針**:
1. src/app/actions.tsを削除
2. src/app/actions/ディレクトリを完全に削除
3. src/app/page.tsxのインポートを直接`@/lib/server-actions/...`に変更
4. 全て`@/lib/server-actions/...`パスに統一することでハッシュ不一致を防ぐ

## 🐛 既知のバグ・問題

### 高優先度
- [ ] 大容量ファイル（>50MB）でのタイムアウト
- [ ] Server Action「604e...」ハッシュ不一致（キャッシュ問題）
- [ ] 翻訳済みPPTXのフォント崩れ
- [ ] **NEW**: generatePptxアクションのfileId/translationId不整合
- [ ] **NEW**: サーバーアクションの重複エクスポート

### 中優先度
- [ ] Safari でのファイルアップロード不具合
- [ ] ダークモード切り替え時のちらつき
- [ ] セッション有効期限の更新タイミング

### 低優先度
- [ ] 長いファイル名の表示崩れ
- [ ] 翻訳進捗バーの精度
- [ ] 履歴の重複登録

---

## 📊 技術的負債

### コード品質
- [ ] TypeScript厳格モード有効化
- [ ] ESLintルール強化
- [ ] 未使用依存関係の削除
- [ ] コンポーネント分割・整理
- [ ] 命名規則の統一

### ドキュメント
- [ ] APIドキュメント完成
- [ ] デプロイメントガイド
- [ ] コントリビューションガイド
- [ ] アーキテクチャ図
- [ ] データフロー図

### インフラ・運用
- [ ] ログ集約システム
- [ ] 監視・アラート設定
- [ ] 自動バックアップ
- [ ] ディザスタリカバリ計画
- [ ] ロードバランシング

---

## 📅 今週の優先タスク（2025-08-12週）

### 月曜日〜火曜日 ✅ 完了
1. ✅ 翻訳済みPPTXファイル生成の修正
2. ✅ 日本語フォント対応
3. ✅ Server ActionエラーのAPI Route方式による解決

### 水曜日〜木曜日（更新）
1. **Server Actionネイティブ移行 Phase 1**
   - CSRF Protection実装
   - ヘルパー関数作成
2. 大容量ファイル処理の改善
3. タイムアウト問題の解決

### 金曜日
1. **Server Actionネイティブ移行 Phase 2**
   - ユーザー登録機能の移行テスト
   - 軽量翻訳機能の移行テスト
2. 本番環境準備
3. デプロイメントテスト

---

## 🎯 成功指標（KPI）

### パフォーマンス
- ページロード時間: < 2秒
- API レスポンス: < 500ms
- ファイル処理: < 30秒/10MB
- 同時接続: 100ユーザー

### 品質
- バグ率: < 1%
- テストカバレッジ: > 80%
- Lighthouse スコア: > 90
- アップタイム: > 99.9%

### ビジネス
- ユーザー登録率: > 30%
- 有料転換率: > 5%
- 月次解約率: < 5%
- NPS スコア: > 40

---

## 📝 次のアクション

1. **即座に実行**:
   - ✅ Python側のPPTX生成デバッグ完了
   - ✅ 日本語フォント対応完了
   - ✅ Server ActionエラーのAPI Route方式による解決完了

2. **明日から実行（Phase 1）**:
   - CSRF Protection middleware実装
   - Server Action用ヘルパー関数作成
   - 段階的移行の準備作業

3. **今週中に完了**:
   - ユーザー登録機能のServer Actionネイティブ化
   - 軽量翻訳機能のServer Actionネイティブ化
   - 大容量ファイル処理の改善

4. **来週までに計画**:
   - Server Actionハイブリッド方式のドキュメント化
   - Stripe統合の技術調査
   - メール送信サービスの選定

**重要な指針:**
- 🎯 **戦略A（完全Server Actionネイティブ方式）を採用**
- 🚀 **全機能をServer Actionで統一実装**
- 🛡️ **段階的移行でリスク最小化**
- ⚠️ **3回エラー発生時は該当機能のみロールバック**
- 🔥 **最終目標: API Routeゼロの純粋Server Actionアプリ**

---

## 🚨 今週の具体的なアクション（2025-08-12週）

### 月曜日
1. Server Actionハッシュ不一致エラーの修正
2. 重複ファイルの削除
3. ビルドキャッシュのクリア

### 火曜日
1. メインページの簡素化
2. アップロードページの分離
3. 基本的なルーティングの確認

### 水曜日
1. プレビューページの作成
2. エディターページの分離
3. データフローの最適化

### 木曜日
1. ダッシュボードページの作成
2. ファイル一覧ページの改善
3. 認証フローの統一

### 金曜日
1. 全体の動作確認
2. エラーハンドリングの統一
3. レスポンシブ対応の確認

---

## 📋 ページ構成の具体的な修正案

### Phase 1: 基本構造の整理（今週）
```
src/app/
├── page.tsx (ランディングページ)
├── upload/
│   ├── page.tsx (アップロード専用)
│   └── loading.tsx
├── preview/
│   ├── page.tsx (翻訳前確認)
│   └── [id]/page.tsx (個別プレビュー)
├── editor/
│   ├── page.tsx (翻訳編集)
│   └── [id]/page.tsx (個別編集)
└── dashboard/
    ├── page.tsx (ユーザーダッシュボード)
    └── files/page.tsx (ファイル一覧)
```

### Phase 2: 機能の分離（来週）
- 各ページの責務を明確化
- データフローの最適化
- 状態管理の統一

### Phase 3: UX改善（2週間後）
- プログレス表示の改善
- エラー処理の統一
- レスポンシブ対応の強化

---

*最終更新: 2025-08-12 20:30 JST*
>>>>>>> origin/fix-upload-progress-transition
