# Page snapshot

```yaml
- alert
- heading "PowerPoint Translator" [level=1]
- paragraph: アカウントにログイン
- text: ログインに失敗しました メールアドレス
- textbox "your@email.com"
- text: パスワード
- textbox "••••••••"
- button "ログイン"
- text: アカウントをお持ちでない場合は
- link "新規登録":
  - /url: /register
```