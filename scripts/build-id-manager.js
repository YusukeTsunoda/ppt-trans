#!/usr/bin/env node

/**
 * ビルドID管理スクリプト
 * デプロイメント時の一貫性を保証
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// ビルドID生成
function generateBuildId() {
  const timestamp = Date.now();
  const gitHash = getGitHash();
  const random = crypto.randomBytes(4).toString('hex');
  
  return `${timestamp}-${gitHash}-${random}`;
}

// Git commit hashの取得
function getGitHash() {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch (error) {
    console.warn('Git hash not available, using random value');
    return crypto.randomBytes(4).toString('hex');
  }
}

// ビルドメタデータの生成
function generateBuildMetadata() {
  const buildId = generateBuildId();
  const metadata = {
    buildId,
    timestamp: new Date().toISOString(),
    gitHash: getGitHash(),
    gitBranch: getGitBranch(),
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
    deploymentTarget: process.env.DEPLOYMENT_TARGET || 'local'
  };
  
  return metadata;
}

// Gitブランチの取得
function getGitBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  } catch (error) {
    return 'unknown';
  }
}

// ビルドメタデータの保存
function saveBuildMetadata(metadata) {
  const buildDir = path.join(process.cwd(), '.next');
  const metadataPath = path.join(buildDir, 'build-metadata.json');
  
  // .nextディレクトリが存在しない場合は作成
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }
  
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  console.log(`Build metadata saved to ${metadataPath}`);
  
  // 環境変数ファイルにも書き込み
  const envPath = path.join(process.cwd(), '.env.build');
  const envContent = `BUILD_ID=${metadata.buildId}\nBUILD_TIMESTAMP=${metadata.timestamp}\n`;
  fs.writeFileSync(envPath, envContent);
  console.log(`Build environment saved to ${envPath}`);
  
  return metadata;
}

// ビルドIDの検証
function validateBuildId(buildId) {
  const pattern = /^\d{13}-[a-f0-9]{7,8}-[a-f0-9]{8}$/;
  return pattern.test(buildId);
}

// 前回のビルドメタデータの読み込み
function loadPreviousBuildMetadata() {
  const metadataPath = path.join(process.cwd(), '.next', 'build-metadata.json');
  
  if (!fs.existsSync(metadataPath)) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(metadataPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to load previous build metadata:', error);
    return null;
  }
}

// ビルドIDの比較
function compareBuildIds(current, previous) {
  if (!previous) {
    return { isNew: true, message: 'No previous build found' };
  }
  
  const currentTimestamp = parseInt(current.buildId.split('-')[0]);
  const previousTimestamp = parseInt(previous.buildId.split('-')[0]);
  
  if (currentTimestamp > previousTimestamp) {
    return {
      isNew: true,
      message: `New build (${new Date(currentTimestamp).toISOString()}) is newer than previous (${new Date(previousTimestamp).toISOString()})`
    };
  }
  
  return {
    isNew: false,
    message: 'Current build is not newer than previous build'
  };
}

// メイン実行
function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'generate':
      const metadata = generateBuildMetadata();
      saveBuildMetadata(metadata);
      console.log('Build ID generated:', metadata.buildId);
      break;
      
    case 'validate':
      // .env.buildから環境変数を読み込む
      require('dotenv').config({ path: '.env.build' });
      const buildId = process.env.BUILD_ID || process.argv[3];
      if (!buildId) {
        console.warn('No build ID provided for validation');
        // ビルドを妨げないようにwarningのみ
        process.exit(0);
      }
      const isValid = validateBuildId(buildId);
      console.log(`Build ID ${buildId} is ${isValid ? 'valid' : 'invalid'}`);
      process.exit(isValid ? 0 : 1);
      break;
      
    case 'compare':
      const current = generateBuildMetadata();
      const previous = loadPreviousBuildMetadata();
      const comparison = compareBuildIds(current, previous);
      console.log(comparison.message);
      process.exit(comparison.isNew ? 0 : 1);
      break;
      
    case 'info':
      const prevMetadata = loadPreviousBuildMetadata();
      if (prevMetadata) {
        console.log('Previous build metadata:', JSON.stringify(prevMetadata, null, 2));
      } else {
        console.log('No previous build metadata found');
      }
      break;
      
    default:
      console.log(`
Usage: node build-id-manager.js <command>

Commands:
  generate  - Generate new build ID and metadata
  validate  - Validate a build ID
  compare   - Compare current build with previous
  info      - Show previous build metadata
      `);
      process.exit(1);
  }
}

// エクスポート（テスト用）
if (require.main === module) {
  main();
} else {
  module.exports = {
    generateBuildId,
    generateBuildMetadata,
    validateBuildId,
    saveBuildMetadata,
    loadPreviousBuildMetadata,
    compareBuildIds
  };
}