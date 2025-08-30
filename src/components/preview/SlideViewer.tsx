'use client';

import React, { useRef, useEffect } from 'react';

interface TextPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SlideText {
  id: string;
  position?: TextPosition;
  type?: string;
}

interface SlideViewerProps {
  slideNumber: number;
  imageUrl?: string;
  texts: SlideText[];
  selectedTextId: string | null;
  onTextSelect: (textId: string | null) => void;
}

export function SlideViewer({
  slideNumber,
  imageUrl,
  texts,
  selectedTextId,
  onTextSelect
}: SlideViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const aspectRatio = 16 / 9;
  const containerAspectRatio = containerSize.width / containerSize.height;
  
  const _scale = containerAspectRatio > aspectRatio
    ? containerSize.height / 100
    : containerSize.width / 100;
  
  const slideWidth = aspectRatio > containerAspectRatio
    ? containerSize.width
    : containerSize.height * aspectRatio;
  
  const _slideHeight = slideWidth / aspectRatio;
  const scaleX = 100 / 100;
  const scaleY = 100 / 100;

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold">
          スライド {slideNumber}
        </h3>
      </div>
      
      <div className="p-6">
        <div 
          ref={containerRef}
          className="relative bg-gray-100 rounded-lg overflow-hidden"
          style={{ 
            paddingBottom: `${(1 / aspectRatio) * 100}%`,
            maxHeight: '500px'
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            {imageUrl ? (
              <>
                <img
                  src={imageUrl}
                  alt={`スライド ${slideNumber}`}
                  className="max-w-full max-h-full object-contain"
                />
                {/* Text overlays for selection */}
                {texts.map((text) => {
                  if (!text.position) return null;
                  
                  const isSelected = selectedTextId === text.id;
                  const isTable = text.type === 'TABLE_CELL';
                  
                  return (
                    <div
                      key={text.id}
                      onClick={() => onTextSelect(isSelected ? null : text.id)}
                      className={`absolute cursor-pointer transition-all duration-200 ${
                        isSelected 
                          ? 'bg-yellow-300 bg-opacity-40 border-2 border-yellow-500' 
                          : isTable
                            ? 'bg-blue-200 bg-opacity-20 hover:bg-opacity-30 border border-blue-300 border-dashed'
                            : 'bg-blue-200 bg-opacity-0 hover:bg-opacity-20 border border-transparent hover:border-blue-300'
                      }`}
                      style={{
                        left: `${text.position.x * scaleX}%`,
                        top: `${text.position.y * scaleY}%`,
                        width: `${text.position.width * scaleX}%`,
                        height: `${text.position.height * scaleY}%`,
                      }}
                      title={isTable ? 'テーブルセル' : 'テキスト要素'}
                    />
                  );
                })}
              </>
            ) : (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="mt-2 text-sm text-gray-500">
                  スライド画像を生成中...
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}