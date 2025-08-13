# PPT Translator App - 技術更新とUI仕様書

## 1. Python環境とパッケージ管理

### 1.1 Python 3.13 + UV仕様

#### 環境構成
```toml
# pyproject.toml
[project]
name = "ppt-translator-backend"
version = "1.0.0"
requires-python = ">=3.13"
dependencies = [
    "python-pptx>=1.0.0",
    "pillow>=10.0.0",
    "pdf2image>=1.16.0",
    "httpx>=0.27.0",
    "pydantic>=2.0.0",
]

[tool.uv]
python = "3.13"
index-url = "https://pypi.org/simple"
```

#### UV セットアップ
```bash
# UV インストール
curl -LsSf https://astral.sh/uv/install.sh | sh

# プロジェクト初期化
uv init

# Python 3.13 環境作成
uv python install 3.13
uv venv --python 3.13

# 依存関係インストール
uv pip install python-pptx pillow pdf2image httpx pydantic

# 依存関係のロック
uv pip compile pyproject.toml -o requirements.lock
```

### 1.2 python-pptx を使用したスライド処理

```python
# pptx_processor.py
from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE
from PIL import Image
import io
from typing import List, Dict, Any
import base64

class PPTXProcessor:
    """PowerPointファイルの処理クラス"""
    
    def __init__(self, file_path: str):
        self.presentation = Presentation(file_path)
        self.slides_data = []
    
    def extract_slide_content(self) -> List[Dict[str, Any]]:
        """各スライドからテキストと位置情報を抽出（表内テキスト含む）"""
        
        for slide_index, slide in enumerate(self.presentation.slides):
            slide_data = {
                "slide_number": slide_index + 1,
                "texts": [],
                "tables": [],
                "shapes": [],
                "layout": self._get_slide_layout(slide)
            }
            
            # スライドの全シェイプを処理
            for shape in slide.shapes:
                shape_data = self._process_shape(shape)
                if shape_data:
                    slide_data["shapes"].append(shape_data)
                    
                    # 表の場合の処理
                    if shape.has_table:
                        table_data = self._extract_table_text(shape.table, slide_index)
                        slide_data["tables"].append(table_data)
                        slide_data["texts"].extend(table_data["cells"])
                    
                    # 通常テキストがある場合は抽出
                    elif shape.has_text_frame:
                        for paragraph in shape.text_frame.paragraphs:
                            if paragraph.text.strip():
                                text_data = {
                                    "id": f"text_{slide_index}_{len(slide_data['texts'])}",
                                    "original": paragraph.text,
                                    "position": {
                                        "left": shape.left.pt if shape.left else 0,
                                        "top": shape.top.pt if shape.top else 0,
                                        "width": shape.width.pt if shape.width else 0,
                                        "height": shape.height.pt if shape.height else 0,
                                    },
                                    "formatting": self._get_text_formatting(paragraph),
                                    "shape_id": shape.shape_id,
                                    "is_table_cell": False
                                }
                                slide_data["texts"].append(text_data)
            
            self.slides_data.append(slide_data)
        
        return self.slides_data
    
    def generate_slide_preview(self, slide_index: int) -> str:
        """スライドのプレビュー画像を生成（Base64エンコード）"""
        slide = self.presentation.slides[slide_index]
        
        # スライドを画像として保存
        img_stream = io.BytesIO()
        slide_width = self.presentation.slide_width
        slide_height = self.presentation.slide_height
        
        # PIL Imageを使用してプレビュー生成
        img = Image.new('RGB', (int(slide_width.pt), int(slide_height.pt)), 'white')
        
        # ここで実際のスライドレンダリングロジックを実装
        # （python-pptxは直接画像出力をサポートしないため、
        #  別途LibreOfficeやwin32comを使用する必要がある）
        
        img.save(img_stream, format='PNG')
        img_stream.seek(0)
        
        # Base64エンコード
        return base64.b64encode(img_stream.getvalue()).decode('utf-8')
    
    def _process_shape(self, shape) -> Dict[str, Any]:
        """シェイプの詳細情報を取得"""
        return {
            "id": shape.shape_id,
            "type": shape.shape_type,
            "name": shape.name,
            "position": {
                "left": shape.left.pt if shape.left else 0,
                "top": shape.top.pt if shape.top else 0,
                "width": shape.width.pt if shape.width else 0,
                "height": shape.height.pt if shape.height else 0,
            }
        }
    
    def _get_text_formatting(self, paragraph) -> Dict[str, Any]:
        """テキストのフォーマット情報を取得"""
        font = paragraph.font if hasattr(paragraph, 'font') else None
        return {
            "bold": font.bold if font and font.bold else False,
            "italic": font.italic if font and font.italic else False,
            "size": font.size.pt if font and font.size else 12,
            "font_name": font.name if font and font.name else "Arial"
        }
    
    def _extract_table_text(self, table, slide_index: int) -> Dict[str, Any]:
        """表からテキストを抽出"""
        table_data = {
            "rows": len(table.rows),
            "columns": len(table.columns),
            "cells": []
        }
        
        for row_idx, row in enumerate(table.rows):
            for col_idx, cell in enumerate(row.cells):
                # セルが結合されている場合はスキップ
                if cell.is_merge_origin or not cell.is_spanned:
                    cell_text = cell.text_frame.text if cell.text_frame else ""
                    if cell_text.strip():
                        cell_data = {
                            "id": f"table_{slide_index}_{row_idx}_{col_idx}",
                            "original": cell_text,
                            "position": {
                                "row": row_idx,
                                "column": col_idx,
                                "rowspan": cell.row_span if hasattr(cell, 'row_span') else 1,
                                "colspan": cell.column_span if hasattr(cell, 'column_span') else 1,
                            },
                            "is_header": row_idx == 0,  # 最初の行をヘッダーとして扱う
                            "is_table_cell": True,
                            "formatting": {
                                "bold": cell.text_frame.paragraphs[0].font.bold if cell.text_frame and cell.text_frame.paragraphs else False,
                                "alignment": str(cell.text_frame.paragraphs[0].alignment) if cell.text_frame and cell.text_frame.paragraphs else "LEFT"
                            }
                        }
                        table_data["cells"].append(cell_data)
        
        return table_data
    
    def _get_slide_layout(self, slide) -> str:
        """スライドレイアウトタイプを取得"""
        if slide.slide_layout:
            return slide.slide_layout.name
        return "blank"
```

## 2. React 19 とサーバーアクション

### 2.1 React 19 設定

```json
// package.json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "next": "^15.0.0"
  }
}
```

### 2.2 サーバーアクション実装

```typescript
// app/actions/upload.ts
'use server';

import { revalidatePath } from 'next/cache';
import { PPTXProcessor } from '@/lib/pptx-processor';

export async function uploadFileAction(formData: FormData) {
  // CSRF対策: Next.jsのサーバーアクションは自動的にCSRF保護
  const file = formData.get('file') as File;
  
  if (!file || !file.name.endsWith('.pptx')) {
    return {
      success: false,
      error: 'Invalid file format'
    };
  }
  
  try {
    // ファイル処理
    const buffer = await file.arrayBuffer();
    const tempPath = await saveTemporaryFile(buffer);
    
    // Python処理の呼び出し
    const processor = new PPTXProcessor(tempPath);
    const slides = await processor.extractSlides();
    
    // データベースに保存
    const fileRecord = await prisma.file.create({
      data: {
        fileName: file.name,
        slides: slides,
        status: 'UPLOADED'
      }
    });
    
    revalidatePath('/files');
    
    return {
      success: true,
      fileId: fileRecord.id,
      slides: slides
    };
  } catch (error) {
    console.error('Upload error:', error);
    return {
      success: false,
      error: 'Upload failed'
    };
  }
}

// app/actions/translate.ts
'use server';

export async function translateTextAction(
  fileId: string,
  textId: string,
  targetLanguage: string
) {
  // CSRF保護は自動適用
  
  try {
    // Claude API呼び出し
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Translate to ${targetLanguage}: ${text}`
        }]
      })
    });
    
    const result = await response.json();
    
    // 翻訳結果を保存
    await prisma.translation.update({
      where: { id: textId },
      data: { 
        translatedText: result.content[0].text,
        status: 'COMPLETED'
      }
    });
    
    revalidatePath(`/files/${fileId}`);
    
    return {
      success: true,
      translatedText: result.content[0].text
    };
  } catch (error) {
    return {
      success: false,
      error: 'Translation failed'
    };
  }
}
```

### 2.3 クライアントコンポーネント

```tsx
// app/components/FileUpload.tsx
'use client';

import { useActionState } from 'react';
import { uploadFileAction } from '@/app/actions/upload';

export function FileUpload() {
  const [state, formAction, isPending] = useActionState(
    uploadFileAction,
    { success: false }
  );
  
  return (
    <form action={formAction}>
      <input
        type="file"
        name="file"
        accept=".pptx"
        required
        disabled={isPending}
      />
      <button 
        type="submit" 
        disabled={isPending}
        className="btn-primary"
      >
        {isPending ? 'アップロード中...' : 'アップロード'}
      </button>
      
      {state.success && (
        <div className="text-emerald-600">
          アップロード完了！
        </div>
      )}
    </form>
  );
}
```

## 3. ファイルプレビューと翻訳対比UI

### 3.1 メインレイアウト構成

```tsx
// app/components/TranslationEditor.tsx
'use client';

import { useState } from 'react';
import { SlidePreview } from './SlidePreview';
import { TextPairEditor } from './TextPairEditor';

interface TranslationEditorProps {
  fileId: string;
  slides: Slide[];
}

export function TranslationEditor({ fileId, slides }: TranslationEditorProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [highlightedTextId, setHighlightedTextId] = useState<string | null>(null);
  const [selectedTextPair, setSelectedTextPair] = useState<TextPair | null>(null);
  
  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900">
      {/* ヘッダー */}
      <div className="border-b border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
            翻訳エディター
          </h1>
          <div className="flex items-center gap-4">
            <SlideSelector
              slides={slides}
              currentSlide={currentSlide}
              onSlideChange={setCurrentSlide}
            />
          </div>
        </div>
      </div>
      
      {/* メインコンテンツ */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左側: スライドプレビュー */}
        <div className="w-1/2 p-4 overflow-auto">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm">
            <SlidePreview
              slide={slides[currentSlide]}
              highlightedTextId={highlightedTextId}
              onTextClick={(textId) => {
                const textPair = slides[currentSlide].texts.find(t => t.id === textId);
                setSelectedTextPair(textPair);
                setHighlightedTextId(textId);
              }}
            />
          </div>
        </div>
        
        {/* 右側: テキストペアエディター */}
        <div className="w-1/2 p-4 overflow-auto">
          <div className="space-y-4">
            {slides[currentSlide].texts.map((textPair) => (
              <TextPairEditor
                key={textPair.id}
                textPair={textPair}
                isHighlighted={highlightedTextId === textPair.id}
                onHover={() => setHighlightedTextId(textPair.id)}
                onLeave={() => setHighlightedTextId(null)}
                onClick={() => {
                  setSelectedTextPair(textPair);
                  setHighlightedTextId(textPair.id);
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 3.2 スライドプレビューコンポーネント

```tsx
// app/components/SlidePreview.tsx
'use client';

interface SlidePreviewProps {
  slide: Slide;
  highlightedTextId: string | null;
  onTextClick: (textId: string) => void;
}

export function SlidePreview({ 
  slide, 
  highlightedTextId, 
  onTextClick 
}: SlidePreviewProps) {
  return (
    <div className="relative bg-white aspect-[16/9] rounded-lg overflow-hidden">
      {/* スライド背景画像 */}
      <img
        src={slide.imageUrl}
        alt={`Slide ${slide.slideNumber}`}
        className="w-full h-full object-contain"
      />
      
      {/* テキストオーバーレイ */}
      {slide.texts.map((text) => (
        <div
          key={text.id}
          className={`
            absolute border-2 rounded cursor-pointer
            transition-all duration-200
            ${highlightedTextId === text.id
              ? 'border-blue-500 bg-blue-500/20 shadow-lg z-10'
              : 'border-transparent hover:border-blue-300 hover:bg-blue-300/10'
            }
          `}
          style={{
            left: `${(text.position.left / slide.width) * 100}%`,
            top: `${(text.position.top / slide.height) * 100}%`,
            width: `${(text.position.width / slide.width) * 100}%`,
            height: `${(text.position.height / slide.height) * 100}%`,
          }}
          onClick={() => onTextClick(text.id)}
        >
          {/* ハイライト時のみテキストを表示 */}
          {highlightedTextId === text.id && (
            <div className="absolute -top-8 left-0 bg-blue-600 text-white px-2 py-1 rounded text-xs whitespace-nowrap">
              {text.original.substring(0, 30)}...
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

### 3.3 テキストペアエディター

```tsx
// app/components/TextPairEditor.tsx
'use client';

import { useState } from 'react';
import { translateTextAction } from '@/app/actions/translate';

interface TextPairEditorProps {
  textPair: TextPair;
  isHighlighted: boolean;
  onHover: () => void;
  onLeave: () => void;
  onClick: () => void;
}

export function TextPairEditor({
  textPair,
  isHighlighted,
  onHover,
  onLeave,
  onClick
}: TextPairEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [translatedText, setTranslatedText] = useState(textPair.translated || '');
  const [isTranslating, setIsTranslating] = useState(false);
  
  const handleTranslate = async () => {
    setIsTranslating(true);
    const result = await translateTextAction(
      textPair.fileId,
      textPair.id,
      'ja' // ターゲット言語
    );
    
    if (result.success) {
      setTranslatedText(result.translatedText);
    }
    setIsTranslating(false);
  };
  
  return (
    <div
      className={`
        bg-white dark:bg-slate-800 rounded-lg p-4 
        border-2 transition-all duration-200
        ${isHighlighted 
          ? 'border-blue-500 shadow-lg' 
          : 'border-slate-200 dark:border-slate-700 hover:border-blue-300'
        }
      `}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={onClick}
    >
      <div className="grid grid-cols-2 gap-4">
        {/* 原文 */}
        <div className="space-y-2">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            原文
          </div>
          <div className="text-sm text-slate-900 dark:text-white">
            {textPair.original}
          </div>
        </div>
        
        {/* 翻訳文 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              翻訳
            </span>
            <button
              onClick={handleTranslate}
              disabled={isTranslating}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              {isTranslating ? '翻訳中...' : '再翻訳'}
            </button>
          </div>
          
          {isEditing ? (
            <textarea
              value={translatedText}
              onChange={(e) => setTranslatedText(e.target.value)}
              onBlur={() => setIsEditing(false)}
              className="w-full text-sm bg-slate-50 dark:bg-slate-700 
                         rounded p-2 resize-none"
              autoFocus
            />
          ) : (
            <div
              onClick={() => setIsEditing(true)}
              className="text-sm text-slate-900 dark:text-white 
                         cursor-text hover:bg-slate-50 dark:hover:bg-slate-700 
                         rounded p-1 -m-1"
            >
              {translatedText || (
                <span className="text-slate-400">
                  クリックして編集
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

## 4. デザインシステム実装

### 4.1 Tailwind設定

```javascript
// tailwind.config.js
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb', // メインカラー
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        secondary: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b', // セカンダリカラー
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        accent: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981', // アクセントカラー
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
      },
      animation: {
        'fadeIn': 'fadeIn 0.5s ease-in-out',
        'slideUp': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
```

### 4.2 テーマプロバイダー

```tsx
// app/providers/ThemeProvider.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
}>({
  theme: 'system',
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('system');
  
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);
  
  useEffect(() => {
    const root = window.document.documentElement;
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
    
    const appliedTheme = theme === 'system' ? systemTheme : theme;
    
    root.classList.remove('light', 'dark');
    root.classList.add(appliedTheme);
    localStorage.setItem('theme', theme);
  }, [theme]);
  
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
```

## 5. Claude APIモデル選択機能

### 5.1 プロフィール設定画面

```tsx
// app/profile/page.tsx
'use client';

import { useState } from 'react';
import { useUser } from '@/hooks/useUser';

export default function ProfilePage() {
  const { user, updateUser } = useUser();
  const [selectedModel, setSelectedModel] = useState(user?.translationModel || 'haiku');
  
  const models = [
    {
      id: 'haiku',
      name: 'Claude 3 Haiku',
      description: '高速・低コスト',
      available: true,
      badge: null,
    },
    {
      id: 'sonnet',
      name: 'Claude 3.5 Sonnet',
      description: '高品質・バランス型',
      available: false,
      badge: 'Coming Soon',
    },
    {
      id: 'opus',
      name: 'Claude 3 Opus',
      description: '最高品質',
      available: false,
      badge: 'Enterprise',
    },
  ];
  
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-8">
        プロフィール設定
      </h1>
      
      {/* 翻訳モデル選択 */}
      <div className="bg-white dark:bg-slate-800 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          翻訳モデル設定
        </h2>
        
        <div className="space-y-3">
          {models.map((model) => (
            <label
              key={model.id}
              className={`
                flex items-center justify-between p-4 rounded-lg border-2
                transition-all cursor-pointer
                ${model.available ? 'hover:border-blue-300' : 'opacity-50 cursor-not-allowed'}
                ${selectedModel === model.id 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                  : 'border-slate-200 dark:border-slate-700'
                }
              `}
            >
              <div className="flex items-center">
                <input
                  type="radio"
                  name="model"
                  value={model.id}
                  checked={selectedModel === model.id}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  disabled={!model.available}
                  className="mr-3"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900 dark:text-white">
                      {model.name}
                    </span>
                    {model.badge && (
                      <span className="px-2 py-1 text-xs rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                        {model.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {model.description}
                  </span>
                </div>
              </div>
            </label>
          ))}
        </div>
        
        <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            💡 現在はHaikuモデルのみ利用可能です。他のモデルは今後のアップデートで追加予定です。
          </p>
        </div>
      </div>
      
      {/* その他の設定 */}
      <div className="bg-white dark:bg-slate-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          アカウント情報
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm text-slate-600 dark:text-slate-400">
              メールアドレス
            </label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-700 rounded-lg"
            />
          </div>
          
          <div>
            <label className="text-sm text-slate-600 dark:text-slate-400">
              プラン
            </label>
            <div className="mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-700 rounded-lg">
              {user?.plan || 'Free'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---
*ドキュメントバージョン: 1.0*  
*最終更新日: 2025年1月*