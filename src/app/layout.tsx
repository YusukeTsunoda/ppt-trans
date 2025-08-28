import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import AuthProvider from "@/components/AuthProvider";
import { ToastProvider } from "@/components/Toast";
import { PreloadProvider } from "@/components/PreloadProvider";
import { PreloadManager } from "@/lib/optimization/preload-strategy";
import { BundleAnalyzer } from "@/lib/optimization/bundle-monitor";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap", // Optimize font loading
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap", // Optimize font loading
});

export const metadata: Metadata = {
  title: "PowerPoint 翻訳ツール",
  description: "PowerPointファイルをAIで高品質に翻訳",
  keywords: "PowerPoint, 翻訳, AI, プレゼンテーション, 多言語",
  authors: [{ name: "PowerPoint Translation Tool" }],
  viewport: "width=device-width, initial-scale=1",
  robots: "index, follow",
  openGraph: {
    type: "website",
    locale: "ja_JP",
    title: "PowerPoint 翻訳ツール",
    description: "PowerPointファイルをAIで高品質に翻訳",
    siteName: "PowerPoint Translation Tool",
  },
  twitter: {
    card: "summary_large_image",
    title: "PowerPoint 翻訳ツール",
    description: "PowerPointファイルをAIで高品質に翻訳",
  },
};

// Client-side layout component with optimizations
function ClientLayout({ children, pathname }: { children: React.ReactNode; pathname?: string }) {
  return (
    <>
      {/* Preload manager for intelligent component preloading */}
      {pathname && <PreloadManager pathname={pathname} />}
      
      {/* Bundle performance monitoring in development */}
      {process.env.NODE_ENV === 'development' && <BundleAnalyzer />}
      
      <ErrorBoundary>
        <AuthProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
            disableTransitionOnChange
            storageKey="pptx-translator-theme"
            enableColorScheme={false}
          >
            <ToastProvider>
              <PreloadProvider>
                {children}
              </PreloadProvider>
            </ToastProvider>
          </ThemeProvider>
        </AuthProvider>
      </ErrorBoundary>
    </>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        {/* DNS prefetch for external resources */}
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//api.anthropic.com" />
        
        {/* Preconnect for critical resources */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        {/* Performance optimizations */}
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        
        {/* Preload critical resources */}
        <link
          rel="preload"
          href="/_next/static/css/app/layout.css"
          as="style"
        />
        
        {/* Resource hints for better performance */}
        <link rel="prefetch" href="/dashboard" />
        <link rel="prefetch" href="/upload" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ClientLayout>
          {children}
        </ClientLayout>
        
        {/* Performance monitoring script */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Early performance measurement
              if ('performance' in window) {
                window.__PERFORMANCE_START__ = performance.now();
              }
              
              // Report Web Vitals to console in development
              if (${process.env.NODE_ENV === 'development'}) {
                function reportWebVitals(metric) {
                  console.log('Web Vital:', metric.name, metric.value, metric.rating);
                }
                
                // Basic Web Vitals reporting
                if ('PerformanceObserver' in window) {
                  try {
                    const observer = new PerformanceObserver((list) => {
                      list.getEntries().forEach((entry) => {
                        if (entry.entryType === 'largest-contentful-paint') {
                          reportWebVitals({
                            name: 'LCP',
                            value: entry.startTime,
                            rating: entry.startTime <= 2500 ? 'good' : entry.startTime <= 4000 ? 'needs-improvement' : 'poor'
                          });
                        }
                      });
                    });
                    observer.observe({ entryTypes: ['largest-contentful-paint'] });
                  } catch (e) {
                    // Silently handle observer errors
                  }
                }
              }
            `
          }}
        />
      </body>
    </html>
  );
}