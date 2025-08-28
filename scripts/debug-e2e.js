#!/usr/bin/env node

/**
 * E2Eテストデバッグスクリプト
 * 認証フローの問題を診断
 */

const http = require('http');
const https = require('https');
const { spawn } = require('child_process');
const readline = require('readline');
const fs = require('fs').promises;
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

class E2EDebugger {
  constructor() {
    this.port = process.env.TEST_PORT || 3000;
    this.baseUrl = `http://localhost:${this.port}`;
    this.checks = [];
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  logSection(title) {
    console.log('\n' + '='.repeat(50));
    this.log(title, 'bright');
    console.log('='.repeat(50));
  }

  async checkServerRunning() {
    this.logSection('1. サーバー稼働確認');
    
    return new Promise((resolve) => {
      http.get(this.baseUrl, (res) => {
        if (res.statusCode === 200 || res.statusCode === 302) {
          this.log('✅ サーバーが稼働しています', 'green');
          this.checks.push({ name: 'Server Running', status: 'PASS' });
          resolve(true);
        } else {
          this.log(`⚠️ サーバーレスポンス: ${res.statusCode}`, 'yellow');
          this.checks.push({ name: 'Server Running', status: 'WARN' });
          resolve(false);
        }
      }).on('error', (err) => {
        this.log('❌ サーバーに接続できません', 'red');
        this.log(`   エラー: ${err.message}`, 'dim');
        this.checks.push({ name: 'Server Running', status: 'FAIL' });
        resolve(false);
      });
    });
  }

  async checkCSRFEndpoint() {
    this.logSection('2. CSRFエンドポイント確認');
    
    return new Promise((resolve) => {
      const options = {
        hostname: 'localhost',
        port: this.port,
        path: '/api/auth/csrf',
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.csrfToken || json.token) {
              this.log('✅ CSRFトークン取得成功', 'green');
              this.log(`   トークン: ${(json.csrfToken || json.token).substring(0, 20)}...`, 'dim');
              this.checks.push({ name: 'CSRF Endpoint', status: 'PASS' });
              resolve(true);
            } else {
              this.log('⚠️ CSRFトークンが見つかりません', 'yellow');
              this.log(`   レスポンス: ${JSON.stringify(json)}`, 'dim');
              this.checks.push({ name: 'CSRF Endpoint', status: 'WARN' });
              resolve(false);
            }
          } catch (error) {
            this.log('❌ CSRFレスポンスの解析に失敗', 'red');
            this.log(`   エラー: ${error.message}`, 'dim');
            this.log(`   レスポンス: ${data}`, 'dim');
            this.checks.push({ name: 'CSRF Endpoint', status: 'FAIL' });
            resolve(false);
          }
        });
      });

      req.on('error', (err) => {
        this.log('❌ CSRFエンドポイントに接続できません', 'red');
        this.log(`   エラー: ${err.message}`, 'dim');
        this.checks.push({ name: 'CSRF Endpoint', status: 'FAIL' });
        resolve(false);
      });

      req.end();
    });
  }

  async checkLoginPage() {
    this.logSection('3. ログインページ確認');
    
    return new Promise((resolve) => {
      http.get(`${this.baseUrl}/login`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const hasEmailField = data.includes('name="email"') || data.includes('type="email"');
          const hasPasswordField = data.includes('name="password"') || data.includes('type="password"');
          const hasSubmitButton = data.includes('type="submit"');
          
          if (hasEmailField && hasPasswordField && hasSubmitButton) {
            this.log('✅ ログインフォーム要素が存在します', 'green');
            this.checks.push({ name: 'Login Page', status: 'PASS' });
            resolve(true);
          } else {
            this.log('⚠️ ログインフォーム要素が不完全です', 'yellow');
            this.log(`   Email field: ${hasEmailField}`, 'dim');
            this.log(`   Password field: ${hasPasswordField}`, 'dim');
            this.log(`   Submit button: ${hasSubmitButton}`, 'dim');
            this.checks.push({ name: 'Login Page', status: 'WARN' });
            resolve(false);
          }
        });
      }).on('error', (err) => {
        this.log('❌ ログインページに接続できません', 'red');
        this.log(`   エラー: ${err.message}`, 'dim');
        this.checks.push({ name: 'Login Page', status: 'FAIL' });
        resolve(false);
      });
    });
  }

  async checkEnvironmentVariables() {
    this.logSection('4. 環境変数確認');
    
    const requiredVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
    ];
    
    const testVars = [
      'NEXT_PUBLIC_TEST_MODE',
      'DISABLE_RATE_LIMIT_IN_E2E',
      'DISABLE_ORIGIN_CHECK_IN_E2E',
      'CSRF_RELAXED_IN_E2E',
    ];
    
    let allGood = true;
    
    this.log('必須環境変数:', 'cyan');
    for (const varName of requiredVars) {
      if (process.env[varName]) {
        this.log(`  ✅ ${varName}`, 'green');
      } else {
        this.log(`  ❌ ${varName} - 未設定`, 'red');
        allGood = false;
      }
    }
    
    this.log('\nテスト用環境変数:', 'cyan');
    for (const varName of testVars) {
      if (process.env[varName]) {
        this.log(`  ✅ ${varName} = ${process.env[varName]}`, 'green');
      } else {
        this.log(`  ⚠️ ${varName} - 未設定（推奨）`, 'yellow');
      }
    }
    
    this.checks.push({ name: 'Environment Variables', status: allGood ? 'PASS' : 'FAIL' });
    return allGood;
  }

  async checkTestFiles() {
    this.logSection('5. テストファイル確認');
    
    const testFiles = [
      'e2e/core/auth.spec.ts',
      'e2e/helpers/api-routes-helper.ts',
      'playwright.config.ts',
      '.env.test',
    ];
    
    let allGood = true;
    
    for (const file of testFiles) {
      const filePath = path.join(process.cwd(), file);
      try {
        await fs.access(filePath);
        this.log(`  ✅ ${file}`, 'green');
      } catch {
        this.log(`  ❌ ${file} - ファイルが見つかりません`, 'red');
        allGood = false;
      }
    }
    
    this.checks.push({ name: 'Test Files', status: allGood ? 'PASS' : 'FAIL' });
    return allGood;
  }

  async runSimpleE2ETest() {
    this.logSection('6. 簡易E2Eテスト実行');
    
    return new Promise((resolve) => {
      const testProcess = spawn('npx', [
        'playwright', 'test',
        'e2e/core/auth.spec.ts',
        '--reporter=list',
        '--project=chromium'
      ], {
        env: {
          ...process.env,
          PWDEBUG: '0',
          DEBUG: 'pw:api',
        }
      });

      let output = '';
      let errorOutput = '';

      testProcess.stdout.on('data', (data) => {
        output += data.toString();
        process.stdout.write(data);
      });

      testProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
        process.stderr.write(data);
      });

      testProcess.on('close', (code) => {
        if (code === 0) {
          this.log('\n✅ E2Eテスト成功', 'green');
          this.checks.push({ name: 'E2E Test', status: 'PASS' });
          resolve(true);
        } else {
          this.log('\n❌ E2Eテスト失敗', 'red');
          
          // エラーの詳細解析
          if (errorOutput.includes('TimeoutError')) {
            this.log('  原因: タイムアウト - 要素が見つかりません', 'yellow');
          }
          if (errorOutput.includes('csrf') || errorOutput.includes('CSRF')) {
            this.log('  原因: CSRFトークンの問題', 'yellow');
          }
          if (errorOutput.includes('401') || errorOutput.includes('403')) {
            this.log('  原因: 認証/認可エラー', 'yellow');
          }
          
          this.checks.push({ name: 'E2E Test', status: 'FAIL' });
          resolve(false);
        }
      });
    });
  }

  printSummary() {
    this.logSection('診断結果サマリー');
    
    const passCount = this.checks.filter(c => c.status === 'PASS').length;
    const warnCount = this.checks.filter(c => c.status === 'WARN').length;
    const failCount = this.checks.filter(c => c.status === 'FAIL').length;
    
    console.log('\n診断項目:');
    for (const check of this.checks) {
      const icon = check.status === 'PASS' ? '✅' : 
                   check.status === 'WARN' ? '⚠️' : '❌';
      const color = check.status === 'PASS' ? 'green' : 
                    check.status === 'WARN' ? 'yellow' : 'red';
      this.log(`  ${icon} ${check.name}: ${check.status}`, color);
    }
    
    console.log('\n統計:');
    this.log(`  成功: ${passCount}`, 'green');
    this.log(`  警告: ${warnCount}`, 'yellow');
    this.log(`  失敗: ${failCount}`, 'red');
    
    if (failCount > 0) {
      console.log('\n推奨アクション:');
      this.log('1. npm run dev でサーバーを起動してください', 'cyan');
      this.log('2. .env.test ファイルを確認してください', 'cyan');
      this.log('3. npm run playwright:install でブラウザをインストールしてください', 'cyan');
    }
  }

  async run() {
    this.log('E2Eテストデバッグツール', 'bright');
    this.log('認証フローの問題を診断します...\n', 'dim');
    
    // 各チェックを順番に実行
    await this.checkEnvironmentVariables();
    await this.checkTestFiles();
    await this.checkServerRunning();
    await this.checkCSRFEndpoint();
    await this.checkLoginPage();
    
    // オプション: 実際のE2Eテストを実行
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise((resolve) => {
      rl.question('\n実際のE2Eテストを実行しますか？ (y/N): ', resolve);
    });
    rl.close();
    
    if (answer.toLowerCase() === 'y') {
      await this.runSimpleE2ETest();
    }
    
    // サマリーを表示
    this.printSummary();
  }
}

// メイン実行
(async () => {
  const debugger = new E2EDebugger();
  try {
    await debugger.run();
  } catch (error) {
    console.error('デバッグ中にエラーが発生しました:', error);
    process.exit(1);
  }
})();