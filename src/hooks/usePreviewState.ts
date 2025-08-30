import { useState, useCallback } from 'react';

export interface SlideData {
  id: string;
  imageUrl?: string;
  title?: string;
  content?: string;
  texts: Array<{
    id: string;
    original: string;
    translated?: string;
    position?: {
      x: number;
      y: number;
      width?: number;
      height?: number;
    };
  }>;
  notes?: string;
}

export interface ExtractedData {
  slides: SlideData[];
  metadata?: {
    totalSlides: number;
    presentationTitle?: string;
    author?: string;
    createdAt?: string;
    modifiedAt?: string;
  };
}

export interface PreviewState {
  // Extraction state
  isExtracting: boolean;
  extractedData: ExtractedData | null;
  slides: SlideData[];
  error: string | null;
  
  // Navigation state
  currentSlideIndex: number;
  
  // Translation state
  isTranslating: boolean;
  translationProgress: number;
  translationMessage: string;
  targetLanguage: string;
  
  // Editing state
  selectedTextId: string | null;
  editingTextId: string | null;
  editingText: string;
  
  // Download state
  isDownloading: boolean;
  
  // View state
  zoomLevel: number;
  position: { x: number; y: number };
  isDragging: boolean;
  dragStart: { x: number; y: number };
}

export function usePreviewState() {
  // Extraction state
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Navigation state
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  
  // Translation state
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationProgress, setTranslationProgress] = useState(0);
  const [translationMessage, setTranslationMessage] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('ja');
  
  // Editing state
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  
  // Download state
  const [isDownloading, setIsDownloading] = useState(false);
  
  // View state
  const [zoomLevel, setZoomLevel] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Navigation helpers
  const goToNextSlide = useCallback(() => {
    setCurrentSlideIndex(prev => 
      Math.min(prev + 1, slides.length - 1)
    );
  }, [slides.length]);
  
  const goToPrevSlide = useCallback(() => {
    setCurrentSlideIndex(prev => Math.max(prev - 1, 0));
  }, []);
  
  const goToSlide = useCallback((index: number) => {
    setCurrentSlideIndex(Math.max(0, Math.min(index, slides.length - 1)));
  }, [slides.length]);
  
  // Zoom helpers
  const zoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev + 0.25, 2));
  }, []);
  
  const zoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
  }, []);
  
  const resetZoom = useCallback(() => {
    setZoomLevel(1);
    setPosition({ x: 0, y: 0 });
  }, []);
  
  // Text editing helpers
  const startEditingText = useCallback((textId: string, currentText: string) => {
    setEditingTextId(textId);
    setEditingText(currentText);
    setSelectedTextId(textId);
  }, []);
  
  const cancelEditing = useCallback(() => {
    setEditingTextId(null);
    setEditingText('');
  }, []);
  
  const saveEditedText = useCallback((textId: string, newText: string) => {
    setSlides(prevSlides => 
      prevSlides.map((slide, index) => {
        if (index !== currentSlideIndex) return slide;
        
        return {
          ...slide,
          texts: slide.texts.map(text => 
            text.id === textId 
              ? { ...text, translated: newText }
              : text
          )
        };
      })
    );
    
    setEditingTextId(null);
    setEditingText('');
  }, [currentSlideIndex]);
  
  // Drag helpers
  const startDragging = useCallback((x: number, y: number) => {
    setIsDragging(true);
    setDragStart({ x: x - position.x, y: y - position.y });
  }, [position]);
  
  const updateDragPosition = useCallback((x: number, y: number) => {
    if (isDragging) {
      setPosition({
        x: x - dragStart.x,
        y: y - dragStart.y
      });
    }
  }, [isDragging, dragStart]);
  
  const stopDragging = useCallback(() => {
    setIsDragging(false);
  }, []);
  
  return {
    // State
    isExtracting,
    extractedData,
    slides,
    error,
    currentSlideIndex,
    isTranslating,
    translationProgress,
    translationMessage,
    targetLanguage,
    selectedTextId,
    editingTextId,
    editingText,
    isDownloading,
    zoomLevel,
    position,
    isDragging,
    dragStart,
    
    // Setters
    setIsExtracting,
    setExtractedData,
    setSlides,
    setError,
    setCurrentSlideIndex,
    setIsTranslating,
    setTranslationProgress,
    setTranslationMessage,
    setTargetLanguage,
    setSelectedTextId,
    setEditingTextId,
    setEditingText,
    setIsDownloading,
    setZoomLevel,
    setPosition,
    setIsDragging,
    setDragStart,
    
    // Helper functions
    goToNextSlide,
    goToPrevSlide,
    goToSlide,
    zoomIn,
    zoomOut,
    resetZoom,
    startEditingText,
    cancelEditing,
    saveEditedText,
    startDragging,
    updateDragPosition,
    stopDragging
  };
}