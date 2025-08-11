// エラーハンドリングのテストスクリプト
const tests = [
  {
    name: "空のテキスト配列",
    url: "http://localhost:3000/api/translate",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts: [], targetLanguage: "ja" }),
    expectedStatus: 400,
    expectedCode: "TRANSLATION_EMPTY_TEXT"
  },
  {
    name: "必須フィールドなし",
    url: "http://localhost:3000/api/translate",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
    expectedStatus: 400,
    expectedCode: "VALIDATION_INVALID_FORMAT"
  },
  {
    name: "無効なターゲット言語",
    url: "http://localhost:3000/api/translate",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      texts: [{ id: "1", original: "Hello" }], 
      targetLanguage: "invalid_lang" 
    }),
    expectedStatus: 200, // バリデーションで言語は通る
    expectedCode: null
  }
];

async function runTests() {
  console.log("🧪 エラーハンドリングのテストを開始...\n");
  
  for (const test of tests) {
    console.log(`📝 テスト: ${test.name}`);
    
    try {
      const response = await fetch(test.url, {
        method: test.method,
        headers: test.headers,
        body: test.body
      });
      
      const data = await response.json();
      
      console.log(`  ステータス: ${response.status} (期待値: ${test.expectedStatus})`);
      console.log(`  レスポンス:`, data);
      
      // ステータスコードの検証
      if (response.status === test.expectedStatus) {
        console.log(`  ✅ ステータスコードが一致`);
      } else {
        console.log(`  ❌ ステータスコードが不一致`);
      }
      
      // エラーコードの検証
      if (test.expectedCode) {
        if (data.code === test.expectedCode) {
          console.log(`  ✅ エラーコードが一致: ${data.code}`);
        } else {
          console.log(`  ❌ エラーコードが不一致: ${data.code} (期待値: ${test.expectedCode})`);
        }
      }
      
      // ユーザーメッセージの確認
      if (data.error) {
        console.log(`  📢 ユーザーメッセージ: ${data.error}`);
      }
      
      // タイムスタンプの確認
      if (data.timestamp) {
        console.log(`  ⏰ タイムスタンプ: ${data.timestamp}`);
      }
      
    } catch (error) {
      console.log(`  ❌ テスト失敗:`, error.message);
    }
    
    console.log("");
  }
  
  console.log("🏁 テスト完了\n");
}

// テスト実行
runTests().catch(console.error);