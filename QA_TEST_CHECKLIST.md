# ダウンロード機能QAチェックリスト

## テスト実行手順

### 1. サーバーログの確認
```bash
# 現在のログを確認
tail -f dev.log
```

### 2. ブラウザコンソールを開く
- Chrome DevTools: F12 → Console タブ
- ログレベルを「All」に設定

### 3. ダウンロードボタンクリック後の確認項目

#### サーバー側ログ（期待される順序）
- [ ] `Starting Python script:` - Python実行開始
- [ ] `Python script output:` - Python出力（成功メッセージ）
- [ ] `Python script completed successfully:` - Python完了
- [ ] `Checking output file:` - ファイル存在確認
- [ ] `Read translated file:` - ファイル読み込み（サイズ確認）
- [ ] `Database update result:` - DB更新結果（hasError: false）
- [ ] `Translation application completed successfully:` - 処理完了

#### クライアント側ログ（ブラウザコンソール）
- [ ] `Server action result:` - サーバーからの応答確認
  - success: true
  - hasTranslatedPath: true
- [ ] `Translation download completed:` - ダウンロード完了

#### 実際のダウンロード
- [ ] ブラウザのダウンロードが開始される
- [ ] ファイル名: `translated_[元のファイル名].pptx`
- [ ] ファイルサイズ: 約360KB（元のファイルサイズによる）

## エラーケースのテスト

### 1. ネットワークエラー
- DevToolsのNetworkタブで「Offline」を選択してテスト

### 2. 大きなファイル
- 10MB以上のPPTXファイルでテスト

### 3. 権限エラー
- 別のユーザーのファイルIDでアクセスを試みる

## 問題が発生した場合の確認

### サーバー側
1. Pythonスクリプトのパス確認
```bash
ls -la src/lib/pptx/apply_translations.py
```

2. Python環境確認
```bash
which python3
python3 -c "import pptx; print('OK')"
```

3. /tmpディレクトリの権限
```bash
ls -la /tmp | grep translated
```

### クライアント側
1. Network タブで応答を確認
2. Application → Storage → IndexedDBでキャッシュクリア
3. Hard Reload（Ctrl+Shift+R）

## 成功判定基準

✅ 以下のすべてが満たされること：
1. エラーメッセージが表示されない
2. ファイルがダウンロードされる
3. ダウンロードされたファイルが開ける
4. 翻訳が適用されている

## バグ報告時に必要な情報

1. ブラウザコンソールのスクリーンショット
2. サーバーログの最後の50行
3. ネットワークタブの応答内容
4. 使用したPPTXファイルのサイズ
5. エラーメッセージの全文