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