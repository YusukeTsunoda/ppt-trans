import React from 'react';
import Link from 'next/link';
import { ArrowRight, Upload } from 'lucide-react';

export function Hero() {
  return (
    <section className="relative overflow-hidden py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-6xl">
            PowerPointを
            <span className="bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text text-transparent"> 瞬時に翻訳</span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
            AI技術を活用して、PowerPointプレゼンテーションを
            高品質かつ迅速に多言語へ翻訳します。
            レイアウトはそのまま、内容だけを正確に翻訳。
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link href="/register">
              <button className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors flex items-center gap-2">
                無料で始める
                <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
            <Link href="/dashboard">
              <button className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-6 py-3 text-sm font-semibold text-gray-900 dark:text-white shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2">
                <Upload className="h-4 w-4" />
                今すぐアップロード
              </button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}