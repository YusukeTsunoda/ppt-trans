'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Preload strategy based on user navigation patterns
const PRELOAD_ROUTES = {
  // From landing page, users often go to these routes
  '/': [
    () => import('@/components/auth/LoginForm'),
    () => import('@/components/auth/SignupForm'),
  ],
  
  // From dashboard, users often go to these routes  
  '/dashboard': [
    () => import('@/components/upload/UploadForm'),
    () => import('@/app/files/FilesView'),
  ],
  
  // From upload, users often go to preview
  '/upload': [
    () => import('@/app/preview/[id]/PreviewView'),
    () => import('@/components/preview/PreviewControls'),
  ],
  
  // From files, users often go to preview
  '/files': [
    () => import('@/app/preview/[id]/PreviewView'),
  ],
  
  // Admin routes
  '/admin': [
    () => import('@/app/admin/stats/AdminStatsClient'),
  ],
} as const;

// Critical components that should be preloaded immediately
const CRITICAL_PRELOADS = [
  () => import('@/components/ErrorBoundary'),
  () => import('@/components/ui/Button'),
] as const;

// Heavy third-party libraries that benefit from preloading
const LIBRARY_PRELOADS = [
  () => import('recharts'), // Chart library for admin dashboard
  () => import('date-fns'), // Date utilities
] as const;

export function PreloadManager({ pathname }: { pathname: string }) {
  useEffect(() => {
    // Preload critical components immediately
    CRITICAL_PRELOADS.forEach(preload => {
      preload().catch(() => {
        // Silently handle preload failures
      });
    });

    // Preload route-specific components after a short delay
    const timeoutId = setTimeout(() => {
      const routePreloads = PRELOAD_ROUTES[pathname as keyof typeof PRELOAD_ROUTES];
      if (routePreloads) {
        routePreloads.forEach(preload => {
          preload().catch(() => {
            // Silently handle preload failures
          });
        });
      }
    }, 100);

    // Preload heavy libraries with low priority
    const libraryTimeoutId = setTimeout(() => {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => {
          LIBRARY_PRELOADS.forEach(preload => {
            preload().catch(() => {
              // Silently handle preload failures
            });
          });
        });
      } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(() => {
          LIBRARY_PRELOADS.forEach(preload => {
            preload().catch(() => {
              // Silently handle preload failures
            });
          });
        }, 2000);
      }
    }, 500);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(libraryTimeoutId);
    };
  }, [pathname]);

  return null;
}

// Hook for component-specific preloading
export function usePreloadOnInteraction() {
  const preloadComponent = (importFn: () => Promise<any>) => {
    // Only preload if not already loading/loaded
    if (typeof window !== 'undefined') {
      importFn().catch(() => {
        // Silently handle preload failures
      });
    }
  };

  const getPreloadProps = (importFn: () => Promise<any>) => ({
    onMouseEnter: () => preloadComponent(importFn),
    onFocus: () => preloadComponent(importFn),
    onTouchStart: () => preloadComponent(importFn), // For mobile
  });

  return { preloadComponent, getPreloadProps };
}

// Intelligent preloading based on viewport intersection
export function useViewportPreload() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const element = entry.target;
            const preloadData = element.getAttribute('data-preload');
            
            if (preloadData) {
              // Dynamically import the component when it enters viewport
              try {
                const importPath = preloadData;
                import(/* webpackMode: "lazy" */ importPath).catch(() => {
                  // Silently handle import failures
                });
              } catch (error) {
                // Handle invalid import paths
              }
            }
            
            observer.unobserve(element);
          }
        });
      },
      {
        rootMargin: '50px', // Start loading 50px before element is visible
        threshold: 0.1
      }
    );

    // Observe all elements with data-preload attribute
    const preloadElements = document.querySelectorAll('[data-preload]');
    preloadElements.forEach((element) => {
      observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);
}

// Performance monitoring for preload effectiveness
export function usePreloadMetrics() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'performance' in window) {
      // Monitor resource loading times
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType === 'resource') {
            const resourceEntry = entry as PerformanceResourceTiming;
            
            // Log slow-loading resources for optimization
            if (resourceEntry.duration > 1000) { // Resources taking longer than 1s
              console.warn('Slow resource load:', {
                name: resourceEntry.name,
                duration: resourceEntry.duration,
                transferSize: resourceEntry.transferSize,
              });
            }
          }
        });
      });

      observer.observe({ entryTypes: ['resource'] });

      return () => observer.disconnect();
    }
  }, []);
}

// Bundle splitting hints for webpack
export const BundleHints = {
  // Admin-only bundles
  admin: () => import(/* webpackChunkName: "admin" */ '@/app/admin/AdminDashboardClient'),
  adminStats: () => import(/* webpackChunkName: "admin-stats" */ '@/app/admin/stats/AdminStatsClient'),
  
  // Heavy preview components
  preview: () => import(/* webpackChunkName: "preview" */ '@/app/preview/[id]/PreviewView'),
  previewControls: () => import(/* webpackChunkName: "preview-controls" */ '@/components/preview/PreviewControls'),
  
  // Upload functionality
  upload: () => import(/* webpackChunkName: "upload" */ '@/components/upload/UploadForm'),
  
  // Landing page components
  landingHero: () => import(/* webpackChunkName: "landing-hero" */ '@/components/landing/Hero'),
  landingFeatures: () => import(/* webpackChunkName: "landing-features" */ '@/components/landing/Features'),
  landingPricing: () => import(/* webpackChunkName: "landing-pricing" */ '@/components/landing/Pricing'),
  
  // Chart libraries
  charts: () => import(/* webpackChunkName: "charts" */ 'recharts'),
} as const;

// Preload scheduler that respects user's connection and device capabilities
export function schedulePreload(
  importFn: () => Promise<any>, 
  priority: 'high' | 'medium' | 'low' = 'medium'
) {
  if (typeof window === 'undefined') return;

  const connection = (navigator as any).connection;
  const isSlowConnection = connection && 
    (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g');
  
  const hasLowMemory = (navigator as any).deviceMemory && 
    (navigator as any).deviceMemory < 4; // Less than 4GB RAM

  // Skip non-critical preloads on slow connections or low memory devices
  if ((isSlowConnection || hasLowMemory) && priority === 'low') {
    return;
  }

  const delay = {
    high: 0,
    medium: 100,
    low: 500,
  }[priority];

  setTimeout(() => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => {
        importFn().catch(() => {
          // Silently handle failures
        });
      }, { timeout: 5000 });
    } else {
      importFn().catch(() => {
        // Silently handle failures
      });
    }
  }, delay);
}