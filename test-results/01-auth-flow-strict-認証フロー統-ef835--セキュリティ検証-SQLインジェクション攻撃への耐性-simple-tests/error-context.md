# Page snapshot

```yaml
- alert
- heading "PowerPoint Translator" [level=1]
- paragraph: アカウントにログイン
- text: メールアドレス
- textbox "your@email.com": admin' OR '1'='1
- text: パスワード
- textbox "••••••••": "' OR '1'='1"
- button "ログイン"
- text: アカウントをお持ちでない場合は
- link "新規登録":
  - /url: /register
```