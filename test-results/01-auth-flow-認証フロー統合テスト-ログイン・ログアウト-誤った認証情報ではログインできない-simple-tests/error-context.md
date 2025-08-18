# Page snapshot

```yaml
- alert
- heading "PowerPoint Translator" [level=1]
- paragraph: アカウントにログイン
- text: メールアドレス
- textbox "your@email.com": test@example.com
- text: パスワード
- textbox "••••••••": wrongpassword
- button "ログイン中..." [disabled]:
  - img
  - text: ログイン中...
- text: アカウントをお持ちでない場合は
- link "新規登録":
  - /url: /register
```