#!/usr/bin/env node

/**
 * E2Eテスト用のファイルを生成
 */

const fs = require('fs');
const path = require('path');

// PPTXファイルの最小構造（バイナリ）
const PPTX_MAGIC_BYTES = Buffer.from([
  0x50, 0x4B, 0x03, 0x04, // ZIP header
  0x14, 0x00, 0x00, 0x00, 0x08, 0x00
]);

// テストファイルを生成
function createTestFiles() {
  const fixturesDir = __dirname;
  
  // 1. 有効なPPTXファイル（最小限）
  const validPptxPath = path.join(fixturesDir, 'test-presentation.pptx');
  if (!fs.existsSync(validPptxPath)) {
    fs.writeFileSync(validPptxPath, PPTX_MAGIC_BYTES);
    console.log('✅ Created: test-presentation.pptx');
  }
  
  // 2. 大きなPPTXファイル（10MB以上）
  const largePptxPath = path.join(fixturesDir, 'large-presentation.pptx');
  if (!fs.existsSync(largePptxPath)) {
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
    PPTX_MAGIC_BYTES.copy(largeBuffer, 0);
    fs.writeFileSync(largePptxPath, largeBuffer);
    console.log('✅ Created: large-presentation.pptx (11MB)');
  }
  
  // 3. 破損したPPTXファイル
  const corruptedPath = path.join(fixturesDir, 'corrupted.pptx');
  if (!fs.existsSync(corruptedPath)) {
    fs.writeFileSync(corruptedPath, Buffer.from('corrupted data'));
    console.log('✅ Created: corrupted.pptx');
  }
  
  // 4. 無効なヘッダーのファイル
  const invalidHeaderPath = path.join(fixturesDir, 'invalid-header.pptx');
  if (!fs.existsSync(invalidHeaderPath)) {
    fs.writeFileSync(invalidHeaderPath, Buffer.from('INVALID'));
    console.log('✅ Created: invalid-header.pptx');
  }
  
  console.log('\n✨ すべてのテストファイルが準備完了！');
}

createTestFiles();