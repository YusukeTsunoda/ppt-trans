import { useMemo, useCallback } from 'react';

interface SlideData {
  pageNumber: number;
  imageUrl?: string;
  texts: Array<{
    id: string;
    original: string;
    translated?: string;
    position?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    type?: string;
    tableInfo?: {
      row: number;
      col: number;
      totalRows?: number;
      totalCols?: number;
    };
  }>;
}

export function useSlideManagement(slides: SlideData[], currentSlideIndex: number) {
  // Get current slide
  const currentSlide = useMemo(() => {
    return slides[currentSlideIndex] || null;
  }, [slides, currentSlideIndex]);

  // Sort texts for display
  const sortedTexts = useMemo(() => {
    if (!currentSlide) return [];
    
    return [...currentSlide.texts].sort((a, b) => {
      // Sort table cells by row then column
      if (a.type === 'TABLE_CELL' && b.type === 'TABLE_CELL') {
        if (a.tableInfo && b.tableInfo) {
          if (a.tableInfo.row !== b.tableInfo.row) {
            return a.tableInfo.row - b.tableInfo.row;
          }
          return a.tableInfo.col - b.tableInfo.col;
        }
      }
      
      // Sort by position if available
      if (a.position && b.position) {
        if (Math.abs(a.position.y - b.position.y) > 5) {
          return a.position.y - b.position.y;
        }
        return a.position.x - b.position.x;
      }
      
      // Keep original order as fallback
      return 0;
    });
  }, [currentSlide]);

  // Navigation helper
  const navigateToSlide = useCallback((index: number) => {
    if (index >= 0 && index < slides.length) {
      return index;
    }
    return currentSlideIndex;
  }, [slides.length, currentSlideIndex]);

  // Check if navigation is possible
  const canNavigatePrevious = currentSlideIndex > 0;
  const canNavigateNext = currentSlideIndex < slides.length - 1;

  // Get slide statistics
  const slideStats = useMemo(() => {
    if (!currentSlide) return null;
    
    const totalTexts = currentSlide.texts.length;
    const translatedTexts = currentSlide.texts.filter(t => t.translated).length;
    const tableTexts = currentSlide.texts.filter(t => t.type === 'TABLE_CELL').length;
    
    return {
      totalTexts,
      translatedTexts,
      tableTexts,
      translationProgress: totalTexts > 0 ? (translatedTexts / totalTexts) * 100 : 0
    };
  }, [currentSlide]);

  return {
    currentSlide,
    sortedTexts,
    navigateToSlide,
    canNavigatePrevious,
    canNavigateNext,
    slideStats
  };
}