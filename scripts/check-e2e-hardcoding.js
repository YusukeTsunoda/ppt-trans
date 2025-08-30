#!/usr/bin/env node

/**
 * E2Eテストのハードコーディングチェックスクリプト
 * 
 * テストファイル内でハードコードされた値を検出し、
 * 修正が必要な箇所を報告します。
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// ハードコーディングのパターン
const HARDCODED_PATTERNS = [
  {
    pattern: /test@example\.com/g,
    message: 'ハードコードされたテストメールアドレス',
    suggestion: 'UNIFIED_TEST_CONFIG.users.standard.email を使用してください'
  },
  {
    pattern: /admin@example\.com/g,
    message: 'ハードコードされた管理者メールアドレス',
    suggestion: 'UNIFIED_TEST_CONFIG.users.admin.email を使用してください'
  },
  {
    pattern: /Test123!/g,
    message: 'ハードコードされたテストパスワード',
    suggestion: 'UNIFIED_TEST_CONFIG.users.standard.password を使用してください'
  },
  {
    pattern: /Admin123!/g,
    message: 'ハードコードされた管理者パスワード',
    suggestion: 'UNIFIED_TEST_CONFIG.users.admin.password を使用してください'
  },
  {
    pattern: /testpassword123/g,
    message: 'ハードコードされたパスワード',
    suggestion: 'UNIFIED_TEST_CONFIG.users.standard.password を使用してください'
  },
  {
    pattern: /http:\/\/localhost:\d+/g,
    message: 'ハードコードされたURL',
    suggestion: 'UNIFIED_TEST_CONFIG.baseUrl を使用してください'
  },
  {
    pattern: /\.only\(/g,
    message: '.only() の使用',
    suggestion: '.only() を削除してください（コミット前に必須）'
  },
  {
    pattern: /test\.skip\(/g,
    message: '無条件スキップ',
    suggestion: '条件付きスキップを使用してください（フィーチャーフラグなど）',
    severity: 'warning'
  }
];

// 除外するファイル/ディレクトリ
const EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/fixtures/**',
  '**/test-config*.ts',
  '**/unified-test-config.ts',
  '**/GUIDELINES.md',
  '**/*.json'
];

// チェック結果
let totalIssues = 0;
let totalWarnings = 0;
const fileIssues = {};

/**
 * ファイルをチェックする
 */
function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const issues = [];
  
  HARDCODED_PATTERNS.forEach(({ pattern, message, suggestion, severity = 'error' }) => {
    lines.forEach((line, index) => {
      const matches = line.match(pattern);
      if (matches) {
        // コメント行をスキップ
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('//') || trimmedLine.startsWith('*')) {
          return;
        }
        
        issues.push({
          line: index + 1,
          column: line.indexOf(matches[0]) + 1,
          message,
          suggestion,
          severity,
          code: line.trim()
        });
        
        if (severity === 'error') {
          totalIssues++;
        } else {
          totalWarnings++;
        }
      }
    });
  });
  
  if (issues.length > 0) {
    fileIssues[filePath] = issues;
  }
}

/**
 * 結果を表示する
 */
function displayResults() {
  console.log('\n========================================');
  console.log('E2Eテスト ハードコーディングチェック結果');
  console.log('========================================\n');
  
  if (Object.keys(fileIssues).length === 0) {
    console.log('✅ ハードコーディングは検出されませんでした！\n');
    return 0;
  }
  
  // ファイルごとに問題を表示
  Object.entries(fileIssues).forEach(([filePath, issues]) => {
    const relativePath = path.relative(process.cwd(), filePath);
    console.log(`\n📁 ${relativePath}`);
    console.log('─'.repeat(50));
    
    issues.forEach(issue => {
      const icon = issue.severity === 'error' ? '❌' : '⚠️';
      console.log(`${icon} ${issue.line}:${issue.column} - ${issue.message}`);
      console.log(`   コード: ${issue.code}`);
      console.log(`   💡 ${issue.suggestion}`);
    });
  });
  
  // サマリー
  console.log('\n========================================');
  console.log('サマリー');
  console.log('========================================');
  console.log(`❌ エラー: ${totalIssues}件`);
  console.log(`⚠️  警告: ${totalWarnings}件`);
  console.log(`📁 影響を受けるファイル: ${Object.keys(fileIssues).length}件`);
  
  if (totalIssues > 0) {
    console.log('\n❌ ハードコーディングが検出されました。');
    console.log('上記の問題を修正してください。');
    console.log('\n修正方法の詳細は e2e/GUIDELINES.md を参照してください。');
    return 1;
  } else if (totalWarnings > 0) {
    console.log('\n⚠️  警告が検出されました。');
    console.log('可能であれば修正を検討してください。');
    return 0;
  }
  
  return 0;
}

/**
 * メイン処理
 */
function main() {
  const e2eDir = path.join(process.cwd(), 'e2e');
  
  if (!fs.existsSync(e2eDir)) {
    console.error('❌ e2eディレクトリが見つかりません');
    process.exit(1);
  }
  
  // テストファイルを検索
  const testFiles = glob.sync('**/*.spec.ts', {
    cwd: e2eDir,
    absolute: true,
    ignore: EXCLUDE_PATTERNS
  });
  
  console.log(`\n🔍 ${testFiles.length}個のテストファイルをチェック中...\n`);
  
  // 各ファイルをチェック
  testFiles.forEach(checkFile);
  
  // 結果を表示
  const exitCode = displayResults();
  
  // 修正のヒント
  if (exitCode !== 0) {
    console.log('\n💡 ヒント:');
    console.log('1. e2e/config/unified-test-config.ts をインポートする');
    console.log('2. ハードコードされた値を設定値に置き換える');
    console.log('3. npm run test:e2e で動作確認する');
  }
  
  process.exit(exitCode);
}

// 実行
main();