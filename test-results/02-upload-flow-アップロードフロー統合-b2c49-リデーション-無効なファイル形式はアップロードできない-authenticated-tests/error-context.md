# Page snapshot

```yaml
- alert
- heading "PowerPointファイルのアップロード" [level=1]
- text: ファイルを選択
- button "PowerPointファイルを選択"
- paragraph: "対応形式: .pptx, .ppt（最大100MB）"
- button "ファイルをアップロード" [disabled]: アップロード
- link "ダッシュボードに戻る":
  - /url: /dashboard
```