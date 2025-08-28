import { Suspense } from 'react';
import { Header } from '@/components/landing/Header';
import { Footer } from '@/components/landing/Footer';
import {
  DynamicHero,
  DynamicFeatures,
  DynamicHowItWorks,
  DynamicPricing,
  LazySection
} from '@/lib/optimization/dynamic-components';

// Loading skeletons for individual sections
const HeroSkeleton = () => (
  <section className="bg-gradient-to-b from-blue-50 to-white py-20 animate-pulse">
    <div className="container mx-auto px-4 text-center">
      <div className="h-12 bg-blue-200 rounded w-3/4 mx-auto mb-6"></div>
      <div className="h-6 bg-gray-200 rounded w-1/2 mx-auto mb-8"></div>
      <div className="h-12 bg-blue-200 rounded w-48 mx-auto"></div>
    </div>
  </section>
);

const FeaturesSkeleton = () => (
  <section className="py-20 bg-gray-50 animate-pulse">
    <div className="container mx-auto px-4">
      <div className="h-8 bg-gray-200 rounded w-1/3 mx-auto mb-4"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto mb-12"></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white p-8 rounded-lg shadow">
            <div className="h-12 w-12 bg-gray-200 rounded-lg mb-4"></div>
            <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-full"></div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const SectionSkeleton = () => (
  <section className="py-20 animate-pulse">
    <div className="container mx-auto px-4">
      <div className="h-8 bg-gray-200 rounded w-1/3 mx-auto mb-4"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto mb-12"></div>
      <div className="h-64 bg-gray-200 rounded"></div>
    </div>
  </section>
);

export default function Home() {
  return (
    <>
      <Header />
      
      <main>
        {/* Hero section - critical, load immediately */}
        <Suspense fallback={<HeroSkeleton />}>
          <DynamicHero />
        </Suspense>
        
        {/* Features section - above the fold on desktop, lazy load */}
        <LazySection fallback={<FeaturesSkeleton />}>
          <DynamicFeatures />
        </LazySection>
        
        {/* How it works section - below the fold, lazy load */}
        <LazySection fallback={<SectionSkeleton />}>
          <DynamicHowItWorks />
        </LazySection>
        
        {/* Pricing section - bottom, lazy load */}
        <LazySection fallback={<SectionSkeleton />}>
          <DynamicPricing />
        </LazySection>
      </main>
      
      <Footer />
    </>
  );
}

export const metadata = {
  title: 'PowerPoint翻訳ツール - AIで高品質な翻訳を実現',
  description: 'PowerPointファイルをAIで高品質に翻訳。テーブルやレイアウトを保持しながら、日本語、英語、中国語、韓国語に対応。',
  keywords: 'PowerPoint, 翻訳, AI, プレゼンテーション, 多言語',
  openGraph: {
    title: 'PowerPoint翻訳ツール',
    description: 'AIで高品質なPowerPoint翻訳を実現',
    type: 'website',
  },
};