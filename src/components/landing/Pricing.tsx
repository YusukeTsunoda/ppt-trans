import React from 'react';
import { Check } from 'lucide-react';
import Link from 'next/link';

const tiers = [
  {
    name: 'Free',
    id: 'tier-free',
    href: '/register',
    price: '¥0',
    description: '個人利用や試用に最適',
    features: [
      '月5ファイルまで',
      '最大10スライド/ファイル',
      '基本的な言語対応',
      'メールサポート',
    ],
    cta: '無料で始める',
    featured: false,
  },
  {
    name: 'Pro',
    id: 'tier-pro',
    href: '/register',
    price: '¥2,980',
    description: 'ビジネス利用に最適',
    features: [
      '月50ファイルまで',
      '最大100スライド/ファイル',
      '全言語対応',
      '優先サポート',
      '高速処理',
      'API アクセス',
    ],
    cta: 'Pro版を始める',
    featured: true,
  },
  {
    name: 'Enterprise',
    id: 'tier-enterprise',
    href: '/contact',
    price: 'お問い合わせ',
    description: '大規模な組織向け',
    features: [
      '無制限のファイル数',
      '無制限のスライド数',
      '全言語対応',
      '専任サポート',
      '最優先処理',
      'カスタムAPI',
      'SLA保証',
    ],
    cta: 'お問い合わせ',
    featured: false,
  },
];

export function Pricing() {
  return (
    <section className="py-24 sm:py-32 bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            シンプルな料金プラン
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
            ニーズに合わせて最適なプランをお選びください
          </p>
        </div>
        <div className="isolate mx-auto mt-16 grid max-w-md grid-cols-1 gap-y-8 sm:mt-20 lg:mx-0 lg:max-w-none lg:grid-cols-3 lg:gap-x-8 xl:gap-x-12">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className={`rounded-3xl p-8 xl:p-10 ${
                tier.featured
                  ? 'bg-white dark:bg-gray-800 ring-2 ring-blue-600 shadow-xl'
                  : 'bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 shadow-lg'
              }`}
            >
              <div className="flex items-center justify-between gap-x-4">
                <h3 className="text-lg font-semibold leading-8 text-gray-900 dark:text-white">
                  {tier.name}
                </h3>
                {tier.featured && (
                  <p className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-semibold leading-5 text-white">
                    おすすめ
                  </p>
                )}
              </div>
              <p className="mt-4 text-sm leading-6 text-gray-600 dark:text-gray-300">
                {tier.description}
              </p>
              <p className="mt-6 flex items-baseline gap-x-1">
                <span className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
                  {tier.price}
                </span>
                {tier.price !== 'お問い合わせ' && (
                  <span className="text-sm font-semibold leading-6 text-gray-500 dark:text-gray-400">
                    /月
                  </span>
                )}
              </p>
              <ul role="list" className="mt-8 space-y-3 text-sm leading-6 text-gray-600 dark:text-gray-300">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex gap-x-3">
                    <Check className="h-6 w-5 flex-none text-blue-600 dark:text-blue-400" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link href={tier.href}>
                <button
                  className={`mt-8 block w-full rounded-md px-3 py-2 text-center text-sm font-semibold leading-6 transition-colors ${
                    tier.featured
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {tier.cta}
                </button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}