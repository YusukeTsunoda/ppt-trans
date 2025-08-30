import React from 'react';
import { 
  Globe, 
  Zap, 
  Shield, 
  FileText,
  Clock,
  CheckCircle 
} from 'lucide-react';

const features = [
  {
    name: '高速処理',
    description: '最新のAI技術により、大容量のプレゼンテーションも数分で翻訳完了。',
    icon: Zap,
  },
  {
    name: '多言語対応',
    description: '日本語、英語、中国語、韓国語など、主要な言語に対応。',
    icon: Globe,
  },
  {
    name: 'レイアウト保持',
    description: 'オリジナルのデザインやレイアウトを完璧に保持したまま翻訳。',
    icon: FileText,
  },
  {
    name: 'セキュア',
    description: 'エンタープライズレベルのセキュリティでデータを保護。',
    icon: Shield,
  },
  {
    name: '24時間対応',
    description: 'いつでもどこでも、必要な時にすぐに利用可能。',
    icon: Clock,
  },
  {
    name: '品質保証',
    description: '専門用語も正確に翻訳し、文脈に応じた自然な表現を実現。',
    icon: CheckCircle,
  },
];

export function Features() {
  return (
    <section className="py-24 sm:py-32 bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            パワフルな機能
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
            プレゼンテーション翻訳に必要なすべての機能を提供
          </p>
        </div>
        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.name} className="flex flex-col">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900 dark:text-white">
                  <feature.icon className="h-5 w-5 flex-none text-blue-600 dark:text-blue-400" aria-hidden="true" />
                  {feature.name}
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600 dark:text-gray-300">
                  <p className="flex-auto">{feature.description}</p>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}