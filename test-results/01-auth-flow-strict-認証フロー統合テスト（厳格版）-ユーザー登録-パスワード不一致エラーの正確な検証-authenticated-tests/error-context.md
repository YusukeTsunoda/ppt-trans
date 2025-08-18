# Page snapshot

```yaml
- alert
- heading "PowerPoint Translator" [level=1]
- paragraph: 新規アカウント作成
- paragraph:
  - text: 既にアカウントをお持ちの方は
  - link "ログイン":
    - /url: /login
- paragraph: パスワードが一致しません
- text: メールアドレス
- textbox "メールアドレス"
- text: パスワード
- textbox "パスワード"
- paragraph: 6文字以上で入力してください
- text: パスワード（確認）
- textbox "パスワード（確認）"
- button "新規登録"
- text: 既にアカウントをお持ちの方は
- link "こちらからログイン":
  - /url: /login
```