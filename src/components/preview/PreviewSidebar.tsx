'use client';

import type { SlideData, TextData } from '@/types';
import { cn } from '@/lib/utils';
import { FileText, Globe, Edit2 } from 'lucide-react';

interface PreviewSidebarProps {
  slide: SlideData;
  highlightedTextId: string | null;
  onTextSelect: (textId: string) => void;
  onTextEdit: (textId: string) => void;
}

export function PreviewSidebar({
  slide,
  highlightedTextId,
  onTextSelect,
  onTextEdit,
}: PreviewSidebarProps) {
  if (slide.texts.length === 0) {
    return (
      <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          テキスト要素
        </h3>
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>このスライドにはテキストがありません</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
      <div className="p-4">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          テキスト要素 ({slide.texts.length})
        </h3>
        
        <div className="space-y-3">
          {slide.texts.map((text) => (
            <TextItem
              key={text.id}
              text={text}
              isHighlighted={highlightedTextId === text.id}
              onSelect={() => onTextSelect(text.id)}
              onEdit={() => onTextEdit(text.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface TextItemProps {
  text: TextData;
  isHighlighted: boolean;
  onSelect: () => void;
  onEdit: () => void;
}

function TextItem({ text, isHighlighted, onSelect, onEdit }: TextItemProps) {
  return (
    <div
      className={cn(
        "p-3 rounded-lg border transition-all cursor-pointer",
        isHighlighted
          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {text.translated && (
            <div title="翻訳済み">
              <Globe className="w-4 h-4 text-green-500" />
            </div>
          )}
          <span className="text-xs text-gray-500 dark:text-gray-400">
            ID: {text.id.slice(0, 8)}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          title="編集"
        >
          <Edit2 className="w-4 h-4" />
        </button>
      </div>
      
      <div className="space-y-2">
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">原文:</div>
          <div className="text-sm text-gray-900 dark:text-white break-words">
            {text.original || '(空のテキスト)'}
          </div>
        </div>
        
        {text.translated && (
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">翻訳:</div>
            <div className="text-sm text-gray-900 dark:text-white break-words">
              {text.translated}
            </div>
          </div>
        )}
      </div>
      
      {text.position && (
        <div className="mt-2 text-xs text-gray-400">
          位置: ({Math.round(text.position.x)}%, {Math.round(text.position.y)}%)
        </div>
      )}
    </div>
  );
}