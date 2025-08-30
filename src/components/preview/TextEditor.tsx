'use client';

import React, { useState } from 'react';

interface TextItem {
  id: string;
  original: string;
  translated?: string;
  type?: string;
  tableInfo?: {
    row: number;
    col: number;
    totalRows?: number;
    totalCols?: number;
  };
}

interface TextEditorProps {
  texts: TextItem[];
  selectedTextId: string | null;
  onTextSelect: (textId: string | null) => void;
  onTranslationEdit: (textId: string, newTranslation: string) => void;
}

export function TextEditor({
  texts,
  selectedTextId,
  onTextSelect,
  onTranslationEdit
}: TextEditorProps) {
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const startEditingTranslation = (textId: string, currentTranslation: string) => {
    setEditingTextId(textId);
    setEditingText(currentTranslation);
  };

  const saveEditedTranslation = (textId: string) => {
    onTranslationEdit(textId, editingText);
    setEditingTextId(null);
    setEditingText('');
  };

  const cancelEditing = () => {
    setEditingTextId(null);
    setEditingText('');
  };

  return (
    <div className="bg-white rounded-lg shadow-sm" data-testid="preview-container">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold">
          テキスト内容 ({texts.length} 項目)
        </h3>
      </div>
      
      {texts.length > 0 ? (
        <div 
          className="p-6 space-y-4 overflow-y-auto custom-scrollbar"
          style={{ 
            maxHeight: '500px',
            scrollbarWidth: 'thin',
            scrollbarColor: '#CBD5E0 #F7FAFC'
          }}
        >
          {texts.map((text) => (
            <div 
              key={text.id} 
              className={`border rounded-lg p-4 transition-all hover:shadow-md ${
                selectedTextId === text.id ? 'border-yellow-400 bg-yellow-50' : 'hover:border-gray-300'
              }`}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Original Text */}
                <div 
                  className="cursor-pointer"
                  onClick={() => onTextSelect(selectedTextId === text.id ? null : text.id)}
                >
                  <div className="text-sm font-medium text-gray-600 mb-1 flex items-center gap-2">
                    原文 
                    {text.type === 'TABLE_CELL' && text.tableInfo && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        表[{text.tableInfo.row + 1},{text.tableInfo.col + 1}]
                      </span>
                    )}
                    {selectedTextId === text.id && (
                      <span className="text-xs bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full">
                        ハイライト中
                      </span>
                    )}
                  </div>
                  <div className="text-gray-900 whitespace-pre-wrap" data-testid="slide-text">
                    {text.original}
                  </div>
                </div>
                
                {/* Translation */}
                <div>
                  <div className="text-sm font-medium text-gray-600 mb-1 flex items-center justify-between">
                    <span>翻訳</span>
                    {editingTextId !== text.id && text.translated && (
                      <button
                        onClick={() => startEditingTranslation(text.id, text.translated || '')}
                        className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                      >
                        編集
                      </button>
                    )}
                  </div>
                  
                  {editingTextId === text.id ? (
                    <div>
                      <textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        className="w-full p-2 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={3}
                        autoFocus
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => saveEditedTranslation(text.id)}
                          className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                        >
                          保存
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="px-3 py-1 bg-gray-400 text-white text-sm rounded hover:bg-gray-500 transition-colors"
                        >
                          キャンセル
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      className={`whitespace-pre-wrap ${
                        text.translated ? 'text-gray-900' : 'text-gray-400 italic'
                      }`} 
                      data-testid={text.translated ? "translated-text" : "untranslated-text"}
                      onDoubleClick={() => text.translated && startEditingTranslation(text.id, text.translated)}
                      title={text.translated ? "ダブルクリックで編集" : ""}
                      style={{ cursor: text.translated ? 'text' : 'default' }}
                    >
                      {text.translated || '未翻訳'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6">
          <p className="text-gray-500 text-center py-8">
            このスライドにはテキストが含まれていません
          </p>
        </div>
      )}
    </div>
  );
}