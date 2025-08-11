'use client';

import React from 'react';

// プレースホルダーコンポーネント
export default function AdminDashboard() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">管理者ダッシュボード</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-2">ユーザー数</h2>
          <p className="text-3xl font-bold">0</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-2">ファイル数</h2>
          <p className="text-3xl font-bold">0</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-2">翻訳数</h2>
          <p className="text-3xl font-bold">0</p>
        </div>
      </div>
    </div>
  );
}