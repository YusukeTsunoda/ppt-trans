'use client';

import dynamic from 'next/dynamic';
import React from 'react';

// Loading skeletons for better UX during dynamic loading
const LoadingSkeleton = ({ height = 'h-64', className = '' }: { height?: string; className?: string }) => (
  <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg ${height} ${className}`}>
    <div className="flex items-center justify-center h-full">
      <div className="flex items-center space-x-2 text-gray-500">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600"></div>
        <span className="text-sm">読み込み中...</span>
      </div>
    </div>
  </div>
);

// Admin Dashboard Components (Heavy - only for admin users)
export const DynamicAdminDashboard = dynamic(
  () => import('@/app/admin/AdminDashboardClient'),
  {
    loading: () => (
      <div className="min-h-screen bg-background animate-pulse">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    ssr: false, // Admin components don't need SSR
  }
);

export const DynamicAdminStats = dynamic(
  () => import('@/app/admin/stats/AdminStatsClient'),
  {
    loading: () => <LoadingSkeleton height="h-96" />,
    ssr: false,
  }
);

// Preview Components (Very Heavy - complex viewer logic)
export const DynamicPreviewView = dynamic(
  () => import('@/app/preview/[id]/PreviewView'),
  {
    loading: () => (
      <div className="min-h-screen bg-slate-50 animate-pulse">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="bg-white rounded-xl shadow-sm mb-6 p-5">
            <div className="h-8 bg-slate-200 rounded w-1/3 mb-4"></div>
            <div className="flex gap-4">
              <div className="h-10 bg-slate-200 rounded w-32"></div>
              <div className="h-10 bg-slate-200 rounded w-40"></div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="h-64 bg-slate-200 rounded"></div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 bg-slate-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    ),
    ssr: false, // Preview is interactive, no need for SSR
  }
);

// Upload Components (Heavy - file processing logic)
export const DynamicUploadForm = dynamic(
  () => import('@/components/upload/UploadForm').then(mod => ({ default: mod.UploadForm })),
  {
    loading: () => (
      <div className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
        <div className="space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-12">
            <div className="h-12 bg-gray-200 rounded w-1/3 mx-auto mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
          </div>
          <div className="h-10 bg-gray-200 rounded w-1/4"></div>
        </div>
      </div>
    ),
    ssr: false,
  }
);

export const DynamicUploadModal = dynamic(
  () => import('@/components/upload/UploadModal').then(mod => ({ default: mod.UploadModal })),
  {
    loading: () => null, // Modal loading doesn't need visual feedback
    ssr: false,
  }
);

// Landing Page Components (Heavy marketing content)
export const DynamicHero = dynamic(
  () => import('@/components/landing/Hero').then(mod => ({ default: mod.Hero })),
  {
    loading: () => (
      <section className="bg-gradient-to-b from-blue-50 to-white py-20 animate-pulse">
        <div className="container mx-auto px-4 text-center">
          <div className="h-12 bg-blue-200 rounded w-3/4 mx-auto mb-6"></div>
          <div className="h-6 bg-gray-200 rounded w-1/2 mx-auto mb-8"></div>
          <div className="h-12 bg-blue-200 rounded w-48 mx-auto"></div>
        </div>
      </section>
    ),
    ssr: true, // Keep SSR for landing page SEO
  }
);

export const DynamicFeatures = dynamic(
  () => import('@/components/landing/Features').then(mod => ({ default: mod.Features })),
  {
    loading: () => <LoadingSkeleton height="h-96" />,
    ssr: true,
  }
);

export const DynamicPricing = dynamic(
  () => import('@/components/landing/Pricing').then(mod => ({ default: mod.Pricing })),
  {
    loading: () => <LoadingSkeleton height="h-96" />,
    ssr: true,
  }
);

export const DynamicHowItWorks = dynamic(
  () => import('@/components/landing/HowItWorks').then(mod => ({ default: mod.HowItWorks })),
  {
    loading: () => <LoadingSkeleton height="h-96" />,
    ssr: true,
  }
);

// Chart Components (Heavy - data visualization libraries like recharts)
export const DynamicChart = dynamic(
  () => import('recharts').then((mod) => ({ default: mod.LineChart })),
  {
    loading: () => <LoadingSkeleton height="h-64" />,
    ssr: false,
  }
);

// Error/Modal Components (Medium - shown on demand)
export const DynamicErrorDetailModal = dynamic(
  () => import('@/components/ErrorDetailModal').then(mod => ({ default: mod.ErrorDetailModal })),
  {
    loading: () => null,
    ssr: false,
  }
);

// Dashboard Components (Medium - user-specific)
export const DynamicDashboardView = dynamic(
  () => import('@/components/dashboard/DashboardView'),
  {
    loading: () => (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white p-6 rounded-lg shadow">
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-8 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    ),
    ssr: false,
  }
);

// File Management Components
export const DynamicFilesView = dynamic(
  () => import('@/app/files/FilesView'),
  {
    loading: () => (
      <div className="bg-white rounded-lg shadow animate-pulse">
        <div className="p-6 border-b">
          <div className="h-6 bg-gray-200 rounded w-1/4"></div>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="h-12 w-12 bg-gray-200 rounded"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-1"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                </div>
                <div className="h-8 w-20 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    ssr: false,
  }
);

// Preview-specific components (split from main preview)
export const DynamicPreviewControls = dynamic(
  () => import('@/components/preview/PreviewControls').then(mod => ({ default: mod.PreviewControls })),
  {
    loading: () => (
      <div className="flex items-center gap-2 animate-pulse">
        <div className="h-8 w-16 bg-gray-200 rounded"></div>
        <div className="h-8 w-16 bg-gray-200 rounded"></div>
        <div className="h-8 w-24 bg-gray-200 rounded"></div>
      </div>
    ),
    ssr: false,
  }
);

export const DynamicPreviewSlide = dynamic(
  () => import('@/components/preview/PreviewSlide').then(mod => ({ default: mod.PreviewSlide })),
  {
    loading: () => <LoadingSkeleton height="h-96" />,
    ssr: false,
  }
);

// Profile/Settings Components
export const DynamicProfileClient = dynamic(
  () => import('@/app/profile/ProfileClient'),
  {
    loading: () => (
      <div className="max-w-2xl mx-auto animate-pulse">
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <div className="h-6 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-4">
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded w-1/3"></div>
          </div>
        </div>
      </div>
    ),
    ssr: false,
  }
);

// Lazy loading with intersection observer for below-the-fold components
export const LazySection = ({ 
  children, 
  fallback = <LoadingSkeleton />, 
  threshold = 0.1,
  rootMargin = '50px' 
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  threshold?: number;
  rootMargin?: string;
}) => {
  const [isVisible, setIsVisible] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold, rootMargin }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return (
    <div ref={ref}>
      {isVisible ? children : fallback}
    </div>
  );
};

// Hook for preloading components on user interaction
export const usePreload = () => {
  const preloadComponent = React.useCallback((importFn: () => Promise<any>) => {
    // Start loading on hover/focus for better UX
    importFn().catch(() => {
      // Silently handle preload failures
    });
  }, []);

  const getPreloadProps = React.useCallback((importFn: () => Promise<any>) => ({
    onMouseEnter: () => preloadComponent(importFn),
    onFocus: () => preloadComponent(importFn),
  }), [preloadComponent]);

  return { preloadComponent, getPreloadProps };
};