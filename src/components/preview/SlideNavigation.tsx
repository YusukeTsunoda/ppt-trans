'use client';

import React from 'react';

interface SlideNavigationProps {
  currentIndex: number;
  totalSlides: number;
  onNavigate: (index: number) => void;
}

export function SlideNavigation({ 
  currentIndex, 
  totalSlides, 
  onNavigate 
}: SlideNavigationProps) {
  const handlePrevious = () => {
    if (currentIndex > 0) {
      onNavigate(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < totalSlides - 1) {
      onNavigate(currentIndex + 1);
    }
  };

  const handleSlideSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onNavigate(parseInt(e.target.value));
  };

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={handlePrevious}
        disabled={currentIndex === 0}
        className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        aria-label="前のスライド"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">スライド</span>
        <select
          value={currentIndex}
          onChange={handleSlideSelect}
          className="px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {Array.from({ length: totalSlides }, (_, i) => (
            <option key={i} value={i}>
              {i + 1} / {totalSlides}
            </option>
          ))}
        </select>
      </div>
      
      <button
        onClick={handleNext}
        disabled={currentIndex === totalSlides - 1}
        className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        aria-label="次のスライド"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}