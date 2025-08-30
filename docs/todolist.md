# PPTTranslator TODO List

更新日: 2025-08-27

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

### API Routes移行（2025-08-27完了）
- ✅ **Phase 1: セキュリティ基盤の実装**
  - CSRF Protection（Double Submit Cookie Pattern）
  - Origin/Referer Validation
  - Advanced Rate Limiter（Sliding Window）
  - JWT Session Manager（jose）
  - Zod Input Validators

- ✅ **Phase 2: API Routes実装**
  - `/api/auth/login` - ログインAPI
  - `/api/auth/signup` - 新規登録API
  - `/api/auth/logout` - ログアウトAPI
  - `/api/auth/forgot-password` - パスワードリセットAPI
  - `/api/auth/csrf` - CSRFトークン取得API
  - `/api/upload` - ファイルアップロードAPI

- ✅ **Phase 3: コンポーネント修正**
  - LoginForm.tsx - API Routes使用に変更
  - SignupForm.tsx - API Routes使用に変更
  - ForgotPasswordForm.tsx - API Routes使用に変更
  - UploadForm.tsx - API Routes使用に変更
  - useCSRF Hook - CSRFトークン管理
  - fetchWithCSRF Helper - 自動CSRF付きfetch

- ✅ **Phase 4: クリーンアップ**
  - Server Actionsファイル削除
  - 重複コンポーネント削除（Fixed, Client, Stable版）
  - TypeScriptエラー修正（セキュリティモジュール）

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

### 実際のAI翻訳機能の実装（2025-08-27完了） 🆕
- ✅ **Claude APIクライアント実装**
  - ClaudeTranslator クラス（`/src/lib/translation/claude-translator.ts`）
  - 自動言語検出機能
  - 用語集抽出と一貫性保持
  - バッチ翻訳とテーブル翻訳サポート

- ✅ **PPTXTranslationService実装**
  - 文書タイプ自動検出（business/technical/marketing/general）
  - プログレストラッキング機能
  - 翻訳最適化パス（二次処理）
  - Python連携フォーマット変換

- ✅ **リアルタイム進捗表示**
  - Server-Sent Events（SSE）によるプログレスストリーミング
  - TranslationProgressModal コンポーネント
  - useTranslationProgress カスタムフック
  - スライドごとの進捗ビジュアライゼーション

- ✅ **API Routes更新**
  - `/api/translate-pptx` - Claude API統合
  - `/api/translate-pptx-progress` - SSE進捗ストリーム
  - `/api/files/[id]` - ファイル削除エンドポイント

---

## 🔴 優先度: 最高（MVPに必須） - 1週間以内

### 2. 実際のスライドプレビュー機能
**現状**: プレースホルダー画像のみ表示
**必要な対応**:
- PPTXをPNGに変換する機能の実装
- python-pptxまたはLibreOfficeを使用したサムネイル生成
- Storageへの画像保存とキャッシュ機構
**修正箇所**: /src/app/preview/[id]/PreviewView.tsx、新規Pythonスクリプトの作成

### 3. E2Eテストの修正
**現状**: API Routes移行により既存のE2Eテストが失敗
**必要な対応**:
- Playwright/Cypressテストの更新
- API Routesエンドポイントのテスト追加
- 認証フローのテスト修正
**修正箇所**: /e2e/, /tests/配下のテストファイル

---

## 🟡 優先度: 高（早期実装推奨） - 2-3週間以内

### 4. 翻訳言語の選択機能
**現状**: 翻訳先言語が固定（英→日のみ）
**必要な対応**:
- 言語選択UI（ソース言語・ターゲット言語）
- データベーススキーマに言語設定を追加
- 翻訳APIリクエストに言語パラメータを含める
**修正箇所**: /src/components/dashboard/DashboardView.tsxに言語選択モーダル追加

### 5. 翻訳進捗の詳細表示
**現状**: "processing"の単純なステータスのみ
**必要な対応**:
- WebSocketまたはServer-Sent Eventsによるリアルタイム進捗
- スライドごとの翻訳状況表示（例: 10/30スライド完了）
- 予想完了時間の表示
**修正箇所**: 新規WebSocketハンドラー、DashboardViewの進捗UI

### 6. 支払いシステム（Stripe）統合
**現状**: 料金プラン設計のみ
**必要な対応**:
- Stripe SDK統合
- 料金プラン実装（Free/Pro/Enterprise）
- サブスクリプション管理
- 使用量ベース課金
- 請求書発行機能
- 無料トライアル実装

### 7. メール通知システム
**現状**: メール送信機能なし
**必要な対応**:
- SendGrid/Resend統合
- アカウント確認メール
- パスワードリセットメール
- 処理完了通知
- 月次使用量レポート

### 8. TypeScript厳格化
**現状**: 約200件のTypeScriptエラー（既存コード）
**必要な対応**:
- Supabase非同期クライアントの型修正
- 動的インポートコンポーネントの型修正
- any型の排除
- strictモードの有効化

---

## 🟢 優先度: 中（機能拡張） - 1-2ヶ月以内

### 9. 翻訳品質の向上
- カスタム辞書機能
- 用語集管理UI
- 翻訳メモリ機能
- 文脈保持アルゴリズム
- 専門分野別翻訳モデル選択
- スライドノートの翻訳対応

### 10. チーム・組織機能
- 組織モデルの実装
- チームメンバー管理
- ファイル共有機能
- 権限管理（RBAC）
- コメント・レビュー機能
- 活動ログ

### 11. 管理者機能の拡張
- リアルタイム統計ダッシュボード
- ユーザー管理機能の完成
- システムヘルスモニタリング
- APIキー管理
- カスタムレポート生成
- 監査ログ

### 12. API公開
- RESTful API設計・実装
- APIキー管理システム
- 使用量制限・課金
- APIドキュメント（Swagger/OpenAPI）
- SDK開発（JavaScript/Python）
- Webhook通知

---

## 🔵 優先度: 低（Nice to Have） - 3ヶ月以降

### 13. 多言語UI対応
- next-i18next導入
- 英語UI翻訳
- 中国語UI翻訳
- 韓国語UI翻訳
- 言語自動検出

### 14. 他形式ファイル対応
- Word文書（.docx）
- Excel（.xlsx）
- PDF
- Google Slides連携
- Keynote対応

### 15. AI機能の拡張
- 翻訳スタイルカスタマイズ
- 自動要約機能
- スライド自動生成
- 画像生成AI連携
- OCR機能（画像内テキスト）

### 16. モバイルアプリ
- React Native開発
- プッシュ通知
- オフライン対応
- App Store/Google Play公開

### 17. 分析・インサイト
- 使用傾向分析
- 翻訳品質スコアリング
- ユーザー行動分析
- A/Bテスト基盤
- 機械学習による最適化

---

## 🐛 既知のバグ・問題

### 高優先度
- [ ] 大容量ファイル（>50MB）でのタイムアウト
- [ ] 翻訳済みPPTXのフォント崩れ（一部環境）
- [ ] Safari でのファイルアップロード不具合

### 中優先度
- [ ] ダークモード切り替え時のちらつき
- [ ] セッション有効期限の更新タイミング
- [ ] TypeScriptエラー（既存コード約200件）

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

## 📅 今週の優先タスク（2025-08-27週）

### 完了 ✅
1. ✅ API Routes移行（Server ActionsからAPI Routesへ）
2. ✅ セキュリティ基盤実装（CSRF, Rate Limiting, JWT）
3. ✅ 認証コンポーネントのAPI Routes対応
4. ✅ 実際のClaude API統合実装
5. ✅ リアルタイム翻訳進捗表示

### 進行中
1. スライドプレビュー機能の実装
2. E2Eテストの修正・更新

### 次に着手
1. TypeScriptエラーの修正（既存コード）
2. 大容量ファイル処理の改善
3. 言語選択機能の追加

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
   - E2Eテストの修正開始
   - TypeScriptエラーの段階的修正

2. **明日から実行**:
   - Claude APIの統合設計
   - プレビュー機能の技術調査

3. **今週中に完了**:
   - 基本的な翻訳機能の実装
   - E2Eテストの動作確認

4. **来週までに計画**:
   - Stripe統合の技術調査
   - メール送信サービスの選定
   - WebSocket/SSEの実装計画

---

## 🚨 重要な変更点（2025-08-27）

### Claude API翻訳機能実装による変更
1. **翻訳エンジン**: ハードコードマップからClaude APIへ完全移行
2. **リアルタイム進捗**: Server-Sent Eventsによる翻訳進捗表示
3. **翻訳品質**: 文書タイプ自動検出と専門用語一貫性保持
4. **新規ファイル構造**:
   - 翻訳サービス: `/src/lib/translation/`
   - 進捗コンポーネント: `/src/components/translation/`
   - SSE API: `/src/app/api/translate-pptx-progress/`

### API Routes移行による変更
1. **認証フロー**: Server ActionsからAPI Routesへ完全移行
2. **セキュリティ**: CSRF Protection、Rate Limiting、JWT Session実装
3. **クライアント**: fetchWithCSRF helperによる統一的なAPI呼び出し
4. **ファイル構造**: 
   - セキュリティモジュール: `/src/lib/security/`
   - API Routes: `/src/app/api/auth/`
   - クライアントフック: `/src/hooks/useCSRF.ts`

### 削除されたファイル
- `/src/app/actions/` ディレクトリ全体
- 重複認証コンポーネント（LoginFormFixed, SignupFormFixed等）
- Server Actions関連ファイル

---

*最終更新: 2025-08-27 22:45 JST*