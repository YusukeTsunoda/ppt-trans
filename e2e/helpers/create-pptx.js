/**
 * 最小限の有効なPPTXファイル構造を作成するヘルパー
 * PPTXファイルは実質的にZIPファイルなので、基本的なZIP構造を作成
 */

function createMinimalPPTX() {
  // 基本的なZIP構造のヘッダー
  const parts = [];
  
  // PK signature for local file header
  parts.push(Buffer.from([0x50, 0x4B, 0x03, 0x04])); // "PK\x03\x04"
  
  // Version needed to extract (2.0)
  parts.push(Buffer.from([0x14, 0x00]));
  
  // General purpose bit flag
  parts.push(Buffer.from([0x00, 0x00]));
  
  // Compression method (no compression)
  parts.push(Buffer.from([0x00, 0x00]));
  
  // File last modification time and date
  parts.push(Buffer.from([0x00, 0x00, 0x00, 0x00]));
  
  // CRC-32 of uncompressed data
  parts.push(Buffer.from([0x00, 0x00, 0x00, 0x00]));
  
  // Compressed size
  parts.push(Buffer.from([0x00, 0x00, 0x00, 0x00]));
  
  // Uncompressed size
  parts.push(Buffer.from([0x00, 0x00, 0x00, 0x00]));
  
  // File name length
  parts.push(Buffer.from([0x09, 0x00]));
  
  // Extra field length
  parts.push(Buffer.from([0x00, 0x00]));
  
  // File name "[Content_Types].xml"の最初の部分
  parts.push(Buffer.from('[Content_'));
  
  // Central directory header
  parts.push(Buffer.from([0x50, 0x4B, 0x01, 0x02])); // "PK\x01\x02"
  
  // バージョン情報
  parts.push(Buffer.from([0x14, 0x00, 0x14, 0x00]));
  
  // 追加のヘッダー情報
  parts.push(Buffer.from([0x00, 0x00, 0x00, 0x00]));
  
  // End of central directory
  parts.push(Buffer.from([0x50, 0x4B, 0x05, 0x06])); // "PK\x05\x06"
  
  // ディスク番号
  parts.push(Buffer.from([0x00, 0x00, 0x00, 0x00]));
  
  // Central directoryのエントリ数
  parts.push(Buffer.from([0x01, 0x00, 0x01, 0x00]));
  
  // Central directoryのサイズとオフセット
  parts.push(Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]));
  
  // コメント長
  parts.push(Buffer.from([0x00, 0x00]));
  
  // 最低限のサイズを確保するためにパディングを追加
  const padding = Buffer.alloc(1024 - parts.reduce((acc, p) => acc + p.length, 0), 0);
  parts.push(padding);
  
  return Buffer.concat(parts);
}

module.exports = createMinimalPPTX;