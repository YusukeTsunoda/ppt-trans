'use client';

import { useEffect } from 'react';

interface BundleMetrics {
  chunkName: string;
  loadTime: number;
  size: number;
  cacheHit: boolean;
  timestamp: number;
}

interface PerformanceMetrics {
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  fcp: number; // First Contentful Paint
  ttfb: number; // Time to First Byte
}

class BundleMonitor {
  private metrics: BundleMetrics[] = [];
  private performanceMetrics: Partial<PerformanceMetrics> = {};
  private observer: PerformanceObserver | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeMonitoring();
    }
  }

  private initializeMonitoring() {
    // Monitor resource loading
    if ('PerformanceObserver' in window) {
      this.observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          this.processEntry(entry);
        });
      });

      this.observer.observe({ entryTypes: ['resource', 'navigation', 'paint', 'largest-contentful-paint'] });
    }

    // Monitor Web Vitals
    this.observeWebVitals();
  }

  private processEntry(entry: PerformanceEntry) {
    if (entry.entryType === 'resource') {
      const resourceEntry = entry as PerformanceResourceTiming;
      
      // Check if this is a JavaScript chunk
      if (resourceEntry.name.includes('chunks/') || resourceEntry.name.includes('.js')) {
        const chunkName = this.extractChunkName(resourceEntry.name);
        const cacheHit = resourceEntry.transferSize === 0 && resourceEntry.decodedBodySize > 0;
        
        this.metrics.push({
          chunkName,
          loadTime: resourceEntry.duration,
          size: resourceEntry.transferSize || resourceEntry.decodedBodySize,
          cacheHit,
          timestamp: Date.now(),
        });

        // Log slow-loading chunks
        if (resourceEntry.duration > 1000) {
          console.warn(`Slow chunk load: ${chunkName} took ${resourceEntry.duration.toFixed(2)}ms`);
        }
      }
    }

    // Process other performance entries
    switch (entry.entryType) {
      case 'paint':
        if (entry.name === 'first-contentful-paint') {
          this.performanceMetrics.fcp = entry.startTime;
        }
        break;
      case 'largest-contentful-paint':
        this.performanceMetrics.lcp = entry.startTime;
        break;
      case 'navigation':
        const navEntry = entry as PerformanceNavigationTiming;
        this.performanceMetrics.ttfb = navEntry.responseStart - navEntry.requestStart;
        break;
    }
  }

  private extractChunkName(url: string): string {
    const parts = url.split('/');
    const filename = parts[parts.length - 1];
    return filename.replace(/\.[a-f0-9]+\.js$/, ''); // Remove hash
  }

  private observeWebVitals() {
    // First Input Delay
    if ('PerformanceEventTiming' in window) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType === 'first-input') {
            this.performanceMetrics.fid = (entry as any).processingStart - entry.startTime;
          }
        });
      });
      observer.observe({ entryTypes: ['first-input'] });
    }

    // Cumulative Layout Shift
    if ('LayoutShift' in window) {
      let clsScore = 0;
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (!(entry as any).hadRecentInput) {
            clsScore += (entry as any).value;
            this.performanceMetrics.cls = clsScore;
          }
        });
      });
      observer.observe({ entryTypes: ['layout-shift'] });
    }
  }

  public getMetrics(): BundleMetrics[] {
    return [...this.metrics];
  }

  public getPerformanceMetrics(): Partial<PerformanceMetrics> {
    return { ...this.performanceMetrics };
  }

  public getBundleAnalytics() {
    const totalSize = this.metrics.reduce((sum, metric) => sum + metric.size, 0);
    const averageLoadTime = this.metrics.reduce((sum, metric) => sum + metric.loadTime, 0) / this.metrics.length;
    const cacheHitRate = this.metrics.filter(metric => metric.cacheHit).length / this.metrics.length;
    
    const slowestChunks = this.metrics
      .sort((a, b) => b.loadTime - a.loadTime)
      .slice(0, 5);

    const largestChunks = this.metrics
      .sort((a, b) => b.size - a.size)
      .slice(0, 5);

    return {
      totalSize: Math.round(totalSize / 1024), // KB
      averageLoadTime: Math.round(averageLoadTime),
      cacheHitRate: Math.round(cacheHitRate * 100),
      slowestChunks: slowestChunks.map(chunk => ({
        name: chunk.chunkName,
        loadTime: Math.round(chunk.loadTime),
        size: Math.round(chunk.size / 1024)
      })),
      largestChunks: largestChunks.map(chunk => ({
        name: chunk.chunkName,
        size: Math.round(chunk.size / 1024),
        loadTime: Math.round(chunk.loadTime)
      }))
    };
  }

  public reportToAnalytics() {
    const analytics = this.getBundleAnalytics();
    const performance = this.getPerformanceMetrics();
    
    // In a real application, you would send this data to your analytics service
    if (process.env.NODE_ENV === 'development') {
      console.group('Bundle Performance Report');
      console.table(analytics);
      console.table(performance);
      console.groupEnd();
    }
    
    // Example: Send to analytics service
    // gtag('event', 'bundle_performance', analytics);
    // gtag('event', 'web_vitals', performance);
    
    return { analytics, performance };
  }

  public destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

// Singleton instance
let bundleMonitorInstance: BundleMonitor | null = null;

export function getBundleMonitor(): BundleMonitor {
  if (!bundleMonitorInstance && typeof window !== 'undefined') {
    bundleMonitorInstance = new BundleMonitor();
  }
  return bundleMonitorInstance!;
}

// React hook for bundle monitoring
export function useBundleMonitor() {
  useEffect(() => {
    const monitor = getBundleMonitor();
    
    // Report metrics periodically
    const interval = setInterval(() => {
      monitor.reportToAnalytics();
    }, 30000); // Every 30 seconds

    // Report on page unload
    const handleUnload = () => {
      monitor.reportToAnalytics();
    };
    
    window.addEventListener('beforeunload', handleUnload);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, []);
  
  return getBundleMonitor();
}

// Development tools for bundle analysis
export function BundleAnalyzer() {
  const monitor = useBundleMonitor();

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // Add bundle analyzer to window for debugging
      (window as any).__bundleMonitor = monitor;
      
      // Log initial load performance
      setTimeout(() => {
        const report = monitor.reportToAnalytics();
        console.log('Initial Bundle Report:', report);
      }, 5000);
    }
  }, [monitor]);

  return null;
}

// Component to track dynamic import success/failure
export function trackDynamicImport(chunkName: string) {
  return {
    onSuccess: (loadTime: number) => {
      const monitor = getBundleMonitor();
      if (process.env.NODE_ENV === 'development') {
        console.log(`Dynamic import success: ${chunkName} loaded in ${loadTime}ms`);
      }
    },
    onError: (error: Error) => {
      const monitor = getBundleMonitor();
      if (process.env.NODE_ENV === 'development') {
        console.error(`Dynamic import failed: ${chunkName}`, error);
      }
      
      // In production, you might want to report this to an error tracking service
      // Sentry.captureException(error, { tags: { chunkName, importType: 'dynamic' } });
    }
  };
}

// Performance budget checker
export interface PerformanceBudget {
  lcp: number; // ms
  fid: number; // ms
  cls: number; // score
  totalBundleSize: number; // KB
  chunkLoadTime: number; // ms
}

const DEFAULT_BUDGET: PerformanceBudget = {
  lcp: 2500, // 2.5s
  fid: 100, // 100ms
  cls: 0.1, // 0.1
  totalBundleSize: 500, // 500KB
  chunkLoadTime: 1000, // 1s
};

export function checkPerformanceBudget(customBudget?: Partial<PerformanceBudget>): {
  passed: boolean;
  violations: string[];
  metrics: any;
} {
  const budget = { ...DEFAULT_BUDGET, ...customBudget };
  const monitor = getBundleMonitor();
  const analytics = monitor.getBundleAnalytics();
  const performance = monitor.getPerformanceMetrics();
  
  const violations: string[] = [];
  
  // Check Web Vitals
  if (performance.lcp && performance.lcp > budget.lcp) {
    violations.push(`LCP: ${performance.lcp}ms exceeds budget of ${budget.lcp}ms`);
  }
  
  if (performance.fid && performance.fid > budget.fid) {
    violations.push(`FID: ${performance.fid}ms exceeds budget of ${budget.fid}ms`);
  }
  
  if (performance.cls && performance.cls > budget.cls) {
    violations.push(`CLS: ${performance.cls} exceeds budget of ${budget.cls}`);
  }
  
  // Check bundle metrics
  if (analytics.totalSize > budget.totalBundleSize) {
    violations.push(`Total bundle size: ${analytics.totalSize}KB exceeds budget of ${budget.totalBundleSize}KB`);
  }
  
  if (analytics.averageLoadTime > budget.chunkLoadTime) {
    violations.push(`Average chunk load time: ${analytics.averageLoadTime}ms exceeds budget of ${budget.chunkLoadTime}ms`);
  }
  
  return {
    passed: violations.length === 0,
    violations,
    metrics: { analytics, performance }
  };
}