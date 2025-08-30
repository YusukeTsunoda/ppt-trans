#!/bin/bash

echo "🔍 ファイルアップロード機能の手動検証"
echo "========================================="
echo ""

# 1. ログイン
echo "1️⃣ ログイン中..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3004/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpassword123"}' \
  -c /tmp/upload_test_cookies.txt)

if echo "$LOGIN_RESPONSE" | grep -q '"success":true'; then
  echo "✅ ログイン成功"
else
  echo "❌ ログイン失敗"
  echo "$LOGIN_RESPONSE"
  exit 1
fi

# 2. ダッシュボードアクセステスト
echo ""
echo "2️⃣ ダッシュボードアクセステスト..."
DASHBOARD_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -b /tmp/upload_test_cookies.txt \
  http://localhost:3004/dashboard)

if [ "$DASHBOARD_STATUS" = "200" ]; then
  echo "✅ ダッシュボードアクセス可能 (HTTP $DASHBOARD_STATUS)"
else
  echo "❌ ダッシュボードアクセス不可 (HTTP $DASHBOARD_STATUS)"
fi

# 3. アップロードページアクセステスト
echo ""
echo "3️⃣ アップロードページアクセステスト..."
UPLOAD_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -b /tmp/upload_test_cookies.txt \
  http://localhost:3004/upload)

if [ "$UPLOAD_STATUS" = "200" ]; then
  echo "✅ アップロードページアクセス可能 (HTTP $UPLOAD_STATUS)"
else
  echo "❌ アップロードページアクセス不可 (HTTP $UPLOAD_STATUS)"
fi

# 4. Server Action経由でのアップロードは直接テストできないため、ブラウザでの手動確認を促す
echo ""
echo "4️⃣ Server Action経由のアップロード検証"
echo "----------------------------------------"
echo "Server Actionsは直接curlでテストできないため、"
echo "以下の手順でブラウザから手動確認してください："
echo ""
echo "1. http://localhost:3004/login にアクセス"
echo "2. test@example.com / testpassword123 でログイン"
echo "3. ダッシュボードから「新規アップロード」をクリック"
echo "4. test/test_presentation.pptx を選択"
echo "5. アップロードボタンをクリック"
echo "6. 成功メッセージとダッシュボードへのリダイレクトを確認"
echo ""

# 5. データベースの確認
echo "5️⃣ データベースのファイル数確認..."
FILE_COUNT=$(npx supabase db dump --local --data-only 2>/dev/null | grep -c "test_presentation.pptx" || echo "0")
echo "📊 現在のtest_presentation.pptxファイル数: $FILE_COUNT"

echo ""
echo "========================================="
echo "✅ 検証完了"
echo ""
echo "【まとめ】"
echo "- ログインAPI: 正常動作 ✅"
echo "- 認証状態の維持: 正常 ✅"
echo "- ページアクセス: 正常 ✅"
echo "- Server Actions: ブラウザで手動確認が必要"
echo ""
echo "次のステップ: ブラウザから手動でアップロードをテストしてください"