'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';

interface LazyImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  placeholder?: string;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  priority?: boolean;
  quality?: number;
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
}

export function LazyImage({
  src,
  alt,
  width,
  height,
  className = '',
  placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2Y3ZjdmNyIvPjx0ZXh0IHg9IjIwMCIgeT0iMTUwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkxvYWRpbmcuLi48L3RleHQ+PC9zdmc+',
  onLoad,
  onError,
  priority = false,
  quality = 75,
  objectFit = 'contain',
}: LazyImageProps) {
  const [imageSrc, setImageSrc] = useState(placeholder);
  const [isLoading, setIsLoading] = useState(true);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  // Intersection Observerを使用して画像の遅延読み込みを実装
  useEffect(() => {
    if (!imgRef.current || priority) {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: '50px', // 50px手前から読み込み開始
        threshold: 0.01,
      }
    );

    const element = imgRef.current;
    if (element) {
      observer.observe(element);
    }

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [priority]);

  // 画像の読み込み
  useEffect(() => {
    if (!isInView) return;

    const img = new window.Image();
    
    img.onload = () => {
      setImageSrc(src);
      setIsLoading(false);
      setHasError(false);
      onLoad?.();
    };

    img.onerror = () => {
      setHasError(true);
      setIsLoading(false);
      onError?.(new Error(`Failed to load image: ${src}`));
    };

    img.src = src;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src, isInView, onLoad, onError]);

  // Next.js Imageコンポーネントを使用する場合
  if (width && height) {
    return (
      <div ref={imgRef} className={`relative ${className}`}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-slate-800 animate-pulse">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        
        {hasError ? (
          <div className="flex items-center justify-center bg-slate-100 dark:bg-slate-800" style={{ width, height }}>
            <div className="text-center p-4">
              <svg className="w-12 h-12 mx-auto mb-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-slate-500">画像を読み込めませんでした</p>
            </div>
          </div>
        ) : (
          isInView && (
            <Image
              src={imageSrc}
              alt={alt}
              width={width}
              height={height}
              quality={quality}
              priority={priority}
              className={`${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
              style={{ objectFit }}
              onLoadingComplete={() => {
                setIsLoading(false);
              }}
            />
          )
        )}
      </div>
    );
  }

  // 通常のimgタグを使用する場合
  return (
    <div ref={imgRef} className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-slate-800 animate-pulse">
          <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      )}
      
      {hasError ? (
        <div className="flex items-center justify-center bg-slate-100 dark:bg-slate-800 p-8">
          <div className="text-center">
            <svg className="w-12 h-12 mx-auto mb-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-slate-500">画像を読み込めませんでした</p>
          </div>
        </div>
      ) : (
        <img
          src={imageSrc}
          alt={alt}
          className={`${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300 ${className}`}
          style={{ objectFit }}
        />
      )}
    </div>
  );
}export default LazyImage;
