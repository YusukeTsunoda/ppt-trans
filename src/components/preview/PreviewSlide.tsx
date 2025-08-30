'use client';

import { useState, useRef, useEffect, memo, useCallback, useMemo } from 'react';
import type { SlideData } from '@/types';
import { cn } from '@/lib/utils';

interface PreviewSlideProps {
  slide: SlideData;
  zoom: number;
  position: { x: number; y: number };
  highlightedTextId: string | null;
  editingTextId: string | null;
  editingText: string;
  onTextClick: (textId: string) => void;
  onTextEdit: (textId: string, text: string) => void;
  onTextSave: (textId: string, text: string) => void;
  onTextCancel: () => void;
  onDragStart: (x: number, y: number) => void;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: () => void;
}

export const PreviewSlide = memo(function PreviewSlide({
  slide,
  zoom,
  position,
  highlightedTextId,
  editingTextId,
  editingText,
  onTextClick,
  onTextEdit,
  onTextSave,
  onTextCancel,
  onDragStart,
  onDragMove,
  onDragEnd,
}: PreviewSlideProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) { // 左クリックのみ
      setIsDragging(true);
      onDragStart(e.clientX - position.x, e.clientY - position.y);
    }
  }, [onDragStart, position.x, position.y]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      onDragMove(e.clientX, e.clientY);
    }
  }, [isDragging, onDragMove]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      onDragEnd();
    }
  }, [isDragging, onDragEnd]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-hidden bg-gray-100 dark:bg-gray-900"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          transform: useMemo(() => `translate(${position.x}px, ${position.y}px) scale(${zoom})`, [position.x, position.y, zoom]),
          transformOrigin: 'center',
          transition: isDragging ? 'none' : 'transform 0.3s ease',
        }}
      >
        <div className="relative bg-white dark:bg-gray-800 shadow-xl rounded-lg overflow-hidden">
          {/* スライド画像 */}
          {slide.imageUrl && (
            <img
              src={slide.imageUrl}
              alt={`Slide`}
              className="max-w-full h-auto"
              draggable={false}
              style={{ maxHeight: '70vh' }}
            />
          )}

          {/* テキストオーバーレイ */}
          <div className="absolute inset-0 pointer-events-none">
            {slide.texts.map((text) => {
              const isHighlighted = highlightedTextId === text.id;
              const isEditing = editingTextId === text.id;

              return (
                <div
                  key={text.id}
                  className={cn(
                    "absolute pointer-events-auto",
                    isHighlighted && "ring-2 ring-blue-500 ring-opacity-50 bg-blue-50 bg-opacity-20",
                    isEditing && "z-10"
                  )}
                  style={{
                    left: `${text.position?.x || 0}%`,
                    top: `${text.position?.y || 0}%`,
                    width: `${text.position?.width || 'auto'}%`,
                    height: `${text.position?.height || 'auto'}%`,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTextClick(text.id);
                  }}
                >
                  {isEditing ? (
                    <div className="p-2 bg-white dark:bg-gray-700 rounded shadow-lg">
                      <textarea
                        className="w-full p-2 border rounded text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={editingText}
                        onChange={(e) => onTextEdit(text.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.ctrlKey) {
                            onTextSave(text.id, editingText);
                          } else if (e.key === 'Escape') {
                            onTextCancel();
                          }
                        }}
                        autoFocus
                        rows={3}
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <button
                          className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            onTextCancel();
                          }}
                        >
                          キャンセル
                        </button>
                        <button
                          className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            onTextSave(text.id, editingText);
                          }}
                        >
                          保存
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "cursor-pointer hover:bg-yellow-50 hover:bg-opacity-30 rounded p-1",
                        text.translated && "border-l-4 border-green-500"
                      )}
                      title={text.translated ? `翻訳済み: ${text.translated}` : text.original}
                    >
                      <span className="text-xs opacity-75">
                        {text.translated || text.original}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
});