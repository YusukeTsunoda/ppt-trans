'use client'; // ブラウザで動くコンポーネントであることを示す

import { useState } from 'react';

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
        setError('PowerPoint (.pptx) ファイルを選択してください。');
        setFile(null);
      } else {
        setFile(selectedFile);
        setError(null);
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setError(null);
    // ここに後でAPIを呼び出す処理を書く
    alert(`「${file.name}」をアップロードします。（まだ処理は実装していません）`);
    setIsUploading(false);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-50">
      <div className="w-full max-w-lg p-8 space-y-6 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800">PowerPoint 翻訳ツール</h1>
          <p className="mt-2 text-gray-600">.pptxファイルをアップロードして翻訳を開始します。</p>
        </div>
        <div className="flex flex-col items-center space-y-4">
          <input
            type="file"
            onChange={handleFileChange}
            accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-violet-50 file:text-violet-700
              hover:file:bg-violet-100"
          />
          {file && <p className="text-sm text-gray-500">選択中のファイル: {file.name}</p>}
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <button
          onClick={handleUpload}
          disabled={!file || isUploading}
          className="w-full px-4 py-2 text-white bg-violet-600 rounded-md
            hover:bg-violet-700 focus:outline-none focus:ring-2
            focus:ring-offset-2 focus:ring-violet-500
            disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isUploading ? '処理中...' : '解析を開始'}
        </button>
      </div>
    </main>
  );
}