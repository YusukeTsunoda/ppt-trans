#!/usr/bin/env node

/**
 * 実装検証スクリプト
 * Phase 1 & 2の実装が正しく機能しているか検証
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function checkFile(filePath, description) {
  const fullPath = path.join(process.cwd(), filePath);
  const exists = fs.existsSync(fullPath);
  
  if (exists) {
    log(`✅ ${description}: ${filePath}`, colors.green);
  } else {
    log(`❌ ${description}: ${filePath} (NOT FOUND)`, colors.red);
  }
  
  return exists;
}

function checkEnvVar(varName, description) {
  const value = process.env[varName];
  
  if (value) {
    log(`✅ ${description}: ${varName} = ${value}`, colors.green);
  } else {
    log(`⚠️  ${description}: ${varName} (NOT SET)`, colors.yellow);
  }
  
  return !!value;
}

function runCommand(command, description) {
  try {
    execSync(command, { stdio: 'pipe' });
    log(`✅ ${description}: SUCCESS`, colors.green);
    return true;
  } catch (error) {
    log(`❌ ${description}: FAILED`, colors.red);
    if (error.stderr) {
      console.error(error.stderr.toString());
    }
    return false;
  }
}

function main() {
  log('\n========================================', colors.blue);
  log('Phase 1 & 2 Implementation Verification', colors.blue);
  log('========================================\n', colors.blue);
  
  let passCount = 0;
  let failCount = 0;
  let warnCount = 0;
  
  // Phase 1: サーバーレス対応認証アーキテクチャ
  log('\n📋 Phase 1: Serverless Authentication Architecture', colors.blue);
  log('------------------------------------------------', colors.blue);
  
  // ファイルの存在確認
  const phase1Files = [
    ['src/lib/auth/request-scoped-auth.ts', 'Request-scoped auth module'],
    ['src/lib/auth/migration-wrapper.ts', 'Migration wrapper'],
    ['src/lib/auth/session-manager.ts', 'Session manager'],
    ['src/lib/auth/__tests__/request-scoped-auth.test.ts', 'Auth tests'],
    ['src/middleware.ts', 'Middleware (v2)'],
    ['src/types/database.ts', 'Database types'],
  ];
  
  phase1Files.forEach(([file, desc]) => {
    if (checkFile(file, desc)) {
      passCount++;
    } else {
      failCount++;
    }
  });
  
  // Phase 2: 堅牢なデプロイメント戦略
  log('\n📋 Phase 2: Robust Deployment Strategy', colors.blue);
  log('---------------------------------------', colors.blue);
  
  const phase2Files = [
    ['scripts/build-id-manager.js', 'Build ID manager'],
    ['deploy/canary-config.json', 'Canary deployment config'],
    ['src/app/api/health/route.ts', 'Health check endpoint'],
    ['src/app/api/health/db/route.ts', 'Database health check'],
    ['src/app/api/health/auth/route.ts', 'Auth health check'],
    ['.github/workflows/ci-cd.yml', 'CI/CD pipeline'],
    ['next.config.js', 'Next.js configuration'],
    ['jest.config.js', 'Jest configuration'],
    ['.env.example', 'Environment variables example'],
  ];
  
  phase2Files.forEach(([file, desc]) => {
    if (checkFile(file, desc)) {
      passCount++;
    } else {
      failCount++;
    }
  });
  
  // 環境変数の確認
  log('\n📋 Environment Variables', colors.blue);
  log('------------------------', colors.blue);
  
  const envVars = [
    ['USE_REQUEST_SCOPED_AUTH', 'Request-scoped auth flag'],
    ['BUILD_ID_VALIDATION', 'Build ID validation flag'],
    ['NEXT_PUBLIC_SUPABASE_URL', 'Supabase URL'],
    ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'Supabase anon key'],
  ];
  
  envVars.forEach(([varName, desc]) => {
    if (checkEnvVar(varName, desc)) {
      passCount++;
    } else {
      warnCount++;
    }
  });
  
  // コマンドの実行確認
  log('\n📋 Build & Test Commands', colors.blue);
  log('------------------------', colors.blue);
  
  const commands = [
    ['npm run type-check', 'TypeScript type checking'],
    ['node scripts/build-id-manager.js validate 1234567890123-abcdefg-12345678', 'Build ID validation'],
  ];
  
  commands.forEach(([cmd, desc]) => {
    if (runCommand(cmd, desc)) {
      passCount++;
    } else {
      failCount++;
    }
  });
  
  // パッケージの確認
  log('\n📋 Required Packages', colors.blue);
  log('--------------------', colors.blue);
  
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const requiredPackages = {
      '@supabase/ssr': 'Supabase SSR',
      'jest': 'Jest testing framework',
      '@types/jest': 'Jest TypeScript types',
      'ts-jest': 'TypeScript Jest transformer',
      '@testing-library/react': 'React Testing Library',
    };
    
    Object.entries(requiredPackages).forEach(([pkg, desc]) => {
      const hasPkg = packageJson.dependencies?.[pkg] || packageJson.devDependencies?.[pkg];
      if (hasPkg) {
        log(`✅ ${desc}: ${pkg}`, colors.green);
        passCount++;
      } else {
        log(`❌ ${desc}: ${pkg} (NOT INSTALLED)`, colors.red);
        failCount++;
      }
    });
  } catch (error) {
    log('❌ Failed to read package.json', colors.red);
    failCount++;
  }
  
  // ビルドメタデータの確認
  log('\n📋 Build Metadata', colors.blue);
  log('-----------------', colors.blue);
  
  if (fs.existsSync('.next/build-metadata.json')) {
    try {
      const metadata = JSON.parse(fs.readFileSync('.next/build-metadata.json', 'utf8'));
      log(`✅ Build ID: ${metadata.buildId}`, colors.green);
      log(`✅ Timestamp: ${metadata.timestamp}`, colors.green);
      log(`✅ Git Hash: ${metadata.gitHash}`, colors.green);
      passCount += 3;
    } catch (error) {
      log('⚠️  Build metadata exists but is invalid', colors.yellow);
      warnCount++;
    }
  } else {
    log('ℹ️  Build metadata not yet generated (run build first)', colors.yellow);
    warnCount++;
  }
  
  // 結果サマリー
  log('\n========================================', colors.blue);
  log('Verification Summary', colors.blue);
  log('========================================', colors.blue);
  
  const total = passCount + failCount + warnCount;
  const successRate = ((passCount / (passCount + failCount)) * 100).toFixed(1);
  
  log(`\n✅ Passed: ${passCount}`, colors.green);
  log(`❌ Failed: ${failCount}`, colors.red);
  log(`⚠️  Warnings: ${warnCount}`, colors.yellow);
  log(`📊 Success Rate: ${successRate}%\n`, colors.blue);
  
  if (failCount === 0) {
    log('🎉 All critical checks passed! Implementation is complete.', colors.green);
    process.exit(0);
  } else if (failCount <= 3) {
    log('⚠️  Most checks passed, but some issues need attention.', colors.yellow);
    process.exit(1);
  } else {
    log('❌ Multiple critical issues found. Please fix them before proceeding.', colors.red);
    process.exit(1);
  }
}

// 実行
if (require.main === module) {
  // 環境変数を.env.localから読み込み（存在する場合）
  if (fs.existsSync('.env.local')) {
    require('dotenv').config({ path: '.env.local' });
  }
  
  main();
}