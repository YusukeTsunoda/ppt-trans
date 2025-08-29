# Page snapshot

```yaml
- alert
- heading "PowerPoint Translator" [level=1]
- paragraph: アカウントにログイン
- text: メールアドレス
- textbox "your@email.com"
- text: パスワード
- textbox "••••••••"
- text: メールアドレスまたはパスワードが正しくありません
- button "ログイン"
- text: アカウントをお持ちでない場合は
- link "新規登録":
  - /url: /register
```