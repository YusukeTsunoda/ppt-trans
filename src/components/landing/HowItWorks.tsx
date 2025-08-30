import React from 'react';
import { Upload, Cpu, Download } from 'lucide-react';

const steps = [
  {
    name: '1. アップロード',
    description: 'PowerPointファイル（.pptx）をドラッグ&ドロップまたは選択してアップロード',
    icon: Upload,
  },
  {
    name: '2. AI翻訳',
    description: '最新のAI技術により、文脈を理解して高品質な翻訳を実行',
    icon: Cpu,
  },
  {
    name: '3. ダウンロード',
    description: '翻訳完了後、オリジナルのレイアウトを保持したファイルをダウンロード',
    icon: Download,
  },
];

export function HowItWorks() {
  return (
    <section className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            簡単3ステップ
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
            アップロードから翻訳完了まで、わずか数分
          </p>
        </div>
        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
          <div className="grid grid-cols-1 gap-y-12 gap-x-8 lg:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step.name} className="relative">
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 ring-1 ring-blue-200 dark:ring-blue-800">
                    <step.icon className="h-8 w-8 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                  </div>
                  <h3 className="mt-6 text-lg font-semibold leading-8 text-gray-900 dark:text-white">
                    {step.name}
                  </h3>
                  <p className="mt-2 text-base leading-7 text-gray-600 dark:text-gray-300">
                    {step.description}
                  </p>
                </div>
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-[60%] w-[calc(100%-60%+40%)] h-[1px] bg-gray-200 dark:bg-gray-700" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}