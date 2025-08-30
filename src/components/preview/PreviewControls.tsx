'use client';

import { memo } from 'react';
import Button from '@/components/ui/Button';
import { ChevronLeft, ChevronRight, Globe, Download, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface PreviewControlsProps {
  currentSlideIndex: number;
  totalSlides: number;
  zoom: number;
  isTranslating: boolean;
  isDownloading: boolean;
  hasTexts: boolean;
  onPrevSlide: () => void;
  onNextSlide: () => void;
  onTranslate: (allSlides: boolean) => void;
  onDownload: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

export const PreviewControls = memo(function PreviewControls({
  currentSlideIndex,
  totalSlides,
  zoom,
  isTranslating,
  isDownloading,
  hasTexts,
  onPrevSlide,
  onNextSlide,
  onTranslate,
  onDownload,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}: PreviewControlsProps) {
  return (
    <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
      <div className="flex justify-between items-center">
        {/* スライドナビゲーション */}
        <div className="flex items-center gap-2">
          <Button
            onClick={onPrevSlide}
            disabled={currentSlideIndex === 0}
            variant="secondary"
            size="sm"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-600 dark:text-gray-300 px-2">
            {currentSlideIndex + 1} / {totalSlides}
          </span>
          <Button
            onClick={onNextSlide}
            disabled={currentSlideIndex === totalSlides - 1}
            variant="secondary"
            size="sm"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* ズームコントロール */}
        <div className="flex items-center gap-2">
          <Button
            onClick={onZoomOut}
            disabled={zoom <= 0.5}
            variant="secondary"
            size="sm"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-600 dark:text-gray-300 min-w-[60px] text-center">
            {`${Math.round(zoom * 100)}%`}
          </span>
          <Button
            onClick={onZoomIn}
            disabled={zoom >= 2}
            variant="secondary"
            size="sm"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            onClick={onZoomReset}
            variant="secondary"
            size="sm"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        {/* アクションボタン */}
        <div className="flex items-center gap-2">
          <Button
            onClick={() => onTranslate(false)}
            disabled={isTranslating || !hasTexts}
            variant="secondary"
            size="sm"
          >
            <Globe className="h-4 w-4 mr-2" />
            現在のスライドを翻訳
          </Button>
          <Button
            onClick={() => onTranslate(true)}
            disabled={isTranslating || !hasTexts}
            variant="primary"
            size="sm"
          >
            <Globe className="h-4 w-4 mr-2" />
            すべて翻訳
          </Button>
          <Button
            onClick={onDownload}
            disabled={isDownloading}
            variant="secondary"
            size="sm"
          >
            <Download className="h-4 w-4 mr-2" />
            ダウンロード
          </Button>
        </div>
      </div>
    </div>
  );
});