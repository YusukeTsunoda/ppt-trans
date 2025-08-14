PPTファイルからプレビュー画面を生成する完全な実装ガイドを提供します。

  📦 必要なパッケージのインストール

  1. システム要件のインストール

  # macOS
  brew install --cask libreoffice
  brew install poppler  # pdf2imageの依存関係

  # Ubuntu/Debian
  sudo apt-get update
  sudo apt-get install libreoffice
  sudo apt-get install poppler-utils

  # Windows
  # LibreOfficeを公式サイトからダウンロード
  # Popplerをダウンロードして環境変数PATHに追加

  2. Pythonパッケージ

  pip install python-pptx==0.6.23
  pip install pdf2image==1.17.0
  pip install Pillow==10.3.0
  pip install python-multipart==0.0.9  # ファイルアップロード用

  🔧 完全な実装コード

  1. PPTXプロセッサークラス

  # pptx_processor.py
  import os
  import sys
  import json
  import subprocess
  import tempfile
  import uuid
  from pathlib import Path
  from typing import List, Dict, Any, Tuple
  import logging

  from pptx import Presentation
  from pptx.enum.shapes import MSO_SHAPE_TYPE
  from pdf2image import convert_from_path
  from PIL import Image

  logging.basicConfig(level=logging.INFO)
  logger = logging.getLogger(__name__)

  class PPTXProcessor:
      """PPTXファイルを処理してプレビューとテキストを抽出"""

      def __init__(self):
          self.libreoffice_path = self._find_libreoffice()

      def _find_libreoffice(self) -> str:
          """LibreOfficeの実行パスを検出"""
          paths = [
              # macOS
              "/Applications/LibreOffice.app/Contents/MacOS/soffice",
              # Linux
              "/usr/bin/soffice",
              "/usr/bin/libreoffice",
              # Windows
              "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
          ]

          for path in paths:
              if os.path.exists(path):
                  logger.info(f"LibreOffice found at: {path}")
                  return path

          # コマンドラインから探す
          try:
              result = subprocess.run(["which", "soffice"],
                                    capture_output=True, text=True)
              if result.returncode == 0:
                  return result.stdout.strip()
          except:
              pass

          raise Exception("LibreOffice not found. Please install it first.")

      def process_pptx(self, file_path: str) -> Dict[str, Any]:
          """
          PPTXファイルを処理
          
          Returns:
              {
                  "slides": [
                      {
                          "pageNumber": 1,
                          "imageData": "base64_string or path",
                          "texts": [
                              {
                                  "id": "unique_id",
                                  "original": "text content",
                                  "position": {"x": 0, "y": 0, "width": 100, 
  "height": 50},
                                  "type": "text|table_cell",
                                  "style": {...}
                              }
                          ]
                      }
                  ],
                  "totalSlides": 10,
                  "metadata": {...}
              }
          """
          with tempfile.TemporaryDirectory() as temp_dir:
              try:
                  # Step 1: PPTXファイルを読み込み
                  presentation = Presentation(file_path)
                  total_slides = len(presentation.slides)
                  logger.info(f"Loaded {total_slides} slides from {file_path}")

                  # Step 2: PDFに変換
                  pdf_path = self._convert_to_pdf(file_path, temp_dir)

                  # Step 3: PDFを画像に変換
                  images = self._pdf_to_images(pdf_path)

                  # Step 4: 各スライドを処理
                  slides_data = []
                  for idx, (slide, image) in enumerate(zip(presentation.slides,
  images)):
                      slide_data = self._process_slide(slide, image, idx + 1)
                      slides_data.append(slide_data)

                  return {
                      "slides": slides_data,
                      "totalSlides": total_slides,
                      "metadata": {
                          "fileName": os.path.basename(file_path),
                          "fileSize": os.path.getsize(file_path)
                      }
                  }

              except Exception as e:
                  logger.error(f"Processing failed: {e}")
                  raise

      def _convert_to_pdf(self, pptx_path: str, output_dir: str) -> str:
          """PPTXをPDFに変換"""
          logger.info("Converting PPTX to PDF...")

          cmd = [
              self.libreoffice_path,
              "--headless",           # GUIなしで実行
              "--convert-to", "pdf",  # PDF形式に変換
              "--outdir", output_dir, # 出力ディレクトリ
              pptx_path
          ]

          try:
              result = subprocess.run(
                  cmd,
                  capture_output=True,
                  text=True,
                  timeout=120  # 2分のタイムアウト
              )

              if result.returncode != 0:
                  raise Exception(f"LibreOffice error: {result.stderr}")

              # 生成されたPDFファイルを探す
              base_name = Path(pptx_path).stem
              pdf_path = os.path.join(output_dir, f"{base_name}.pdf")

              if not os.path.exists(pdf_path):
                  # 別の名前で生成されている可能性
                  pdf_files = list(Path(output_dir).glob("*.pdf"))
                  if pdf_files:
                      pdf_path = str(pdf_files[0])
                  else:
                      raise Exception("PDF file not generated")

              logger.info(f"PDF created: {pdf_path}")
              return pdf_path

          except subprocess.TimeoutExpired:
              raise Exception("PDF conversion timeout")

      def _pdf_to_images(self, pdf_path: str) -> List[Image.Image]:
          """PDFを画像のリストに変換"""
          logger.info("Converting PDF to images...")

          images = convert_from_path(
              pdf_path,
              dpi=150,           # 画質とサイズのバランス
              fmt='JPEG',
              thread_count=2,    # 並列処理
              use_cropbox=True   # クロップボックスを使用
          )

          logger.info(f"Generated {len(images)} images")
          return images

      def _process_slide(self, slide, image: Image.Image, page_num: int) -> Dict:
          """単一スライドの処理"""
          # テキスト抽出
          texts = self._extract_texts_from_slide(slide, page_num)

          # 画像を保存またはBase64エンコード
          image_data = self._process_image(image, page_num)

          return {
              "pageNumber": page_num,
              "imageData": image_data,
              "texts": texts,
              "slideLayout": slide.slide_layout.name if slide.slide_layout else
  None
          }

      def _extract_texts_from_slide(self, slide, page_num: int) -> List[Dict]:
          """スライドからテキストを抽出"""
          texts = []

          for shape_idx, shape in enumerate(slide.shapes):
              try:
                  # テーブルの処理
                  if shape.has_table:
                      table_texts = self._extract_from_table(
                          shape, page_num, shape_idx
                      )
                      texts.extend(table_texts)

                  # テキストフレームの処理
                  elif shape.has_text_frame:
                      text_data = self._extract_from_text_frame(
                          shape, page_num, shape_idx
                      )
                      if text_data:
                          texts.extend(text_data)

                  # グループシェイプの処理
                  elif shape.shape_type == MSO_SHAPE_TYPE.GROUP:
                      group_texts = self._extract_from_group(
                          shape, page_num, shape_idx
                      )
                      texts.extend(group_texts)

              except Exception as e:
                  logger.warning(f"Error extracting from shape {shape_idx}: {e}")
                  continue

          # 位置でソート（上から下、左から右）
          texts.sort(key=lambda t: (
              round(t["position"]["y"] / 20) * 20,  # Y座標を20ptでグループ化
              t["position"]["x"]
          ))

          return texts

      def _extract_from_text_frame(self, shape, page_num: int, 
                                  shape_idx: int) -> List[Dict]:
          """テキストフレームからテキストを抽出"""
          texts = []

          for para_idx, paragraph in enumerate(shape.text_frame.paragraphs):
              text = paragraph.text.strip()
              if not text:
                  continue

              text_id =
  f"text-{page_num}-{shape_idx}-{para_idx}-{uuid.uuid4().hex[:8]}"

              # スタイル情報の抽出
              style_info = self._extract_text_style(paragraph)

              # 位置情報（EMUからポイントに変換）
              position = {
                  "x": self._emu_to_pt(shape.left) if shape.left else 0,
                  "y": self._emu_to_pt(shape.top) if shape.top else 0,
                  "width": self._emu_to_pt(shape.width) if shape.width else 0,
                  "height": self._emu_to_pt(shape.height) if shape.height else 0
              }

              texts.append({
                  "id": text_id,
                  "original": text,
                  "position": position,
                  "type": "text",
                  "style": style_info,
                  "shapeType": self._get_shape_type_name(shape)
              })

          return texts

      def _extract_from_table(self, shape, page_num: int, 
                             shape_idx: int) -> List[Dict]:
          """テーブルからテキストを抽出"""
          texts = []
          table = shape.table

          # テーブルの位置とサイズ
          table_left = self._emu_to_pt(shape.left) if shape.left else 0
          table_top = self._emu_to_pt(shape.top) if shape.top else 0
          table_width = self._emu_to_pt(shape.width) if shape.width else 0
          table_height = self._emu_to_pt(shape.height) if shape.height else 0

          # 各セルのサイズを計算
          cell_width = table_width / len(table.columns) if table.columns else 100
          cell_height = table_height / len(table.rows) if table.rows else 30

          for row_idx, row in enumerate(table.rows):
              for col_idx, cell in enumerate(row.cells):
                  text = cell.text.strip()
                  if not text:
                      continue

                  text_id = f"table-{page_num}-{shape_idx}-r{row_idx}-c{col_idx}"

                  # セルの位置を計算
                  position = {
                      "x": table_left + (col_idx * cell_width),
                      "y": table_top + (row_idx * cell_height),
                      "width": cell_width,
                      "height": cell_height
                  }

                  texts.append({
                      "id": text_id,
                      "original": text,
                      "position": position,
                      "type": "table_cell",
                      "tablePosition": {"row": row_idx, "col": col_idx}
                  })

          return texts

      def _extract_from_group(self, group_shape, page_num: int, 
                            shape_idx: int) -> List[Dict]:
          """グループシェイプからテキストを抽出"""
          texts = []

          try:
              for sub_idx, sub_shape in enumerate(group_shape.shapes):
                  if sub_shape.has_text_frame:
                      sub_texts = self._extract_from_text_frame(
                          sub_shape, page_num, f"{shape_idx}-{sub_idx}"
                      )
                      texts.extend(sub_texts)
          except:
              pass

          return texts

      def _extract_text_style(self, paragraph) -> Dict:
          """テキストのスタイル情報を抽出"""
          style = {}

          try:
              if paragraph.runs:
                  run = paragraph.runs[0]  # 最初のrunからスタイルを取得

                  # フォント情報
                  if run.font.name:
                      style["fontName"] = run.font.name
                  if run.font.size:
                      style["fontSize"] = self._emu_to_pt(run.font.size)

                  # スタイル属性
                  style["bold"] = run.font.bold if run.font.bold is not None else
  False
                  style["italic"] = run.font.italic if run.font.italic is not None
   else False
                  style["underline"] = bool(run.font.underline)

              # 段落の配置
              if paragraph.alignment:
                  style["alignment"] = str(paragraph.alignment)

          except Exception as e:
              logger.debug(f"Style extraction error: {e}")

          return style

      def _process_image(self, image: Image.Image, page_num: int) -> str:
          """画像を処理（保存またはBase64変換）"""
          # オプション1: ファイルとして保存
          output_path = f"slide_{page_num}.jpg"
          image.save(output_path, "JPEG", quality=85, optimize=True)
          return output_path

          # オプション2: Base64エンコード
          # import base64
          # from io import BytesIO
          # buffer = BytesIO()
          # image.save(buffer, format="JPEG", quality=85)
          # img_str = base64.b64encode(buffer.getvalue()).decode()
          # return f"data:image/jpeg;base64,{img_str}"

      def _emu_to_pt(self, emu_value) -> float:
          """EMU (English Metric Units) をポイントに変換"""
          if emu_value is None:
              return 0
          return float(emu_value) / 12700  # 1 pt = 12700 EMU

      def _get_shape_type_name(self, shape) -> str:
          """シェイプタイプの名前を取得"""
          try:
              return shape.shape_type.name if hasattr(shape, 'shape_type') else
  "UNKNOWN"
          except:
              return "UNKNOWN"

  2. 使用例とAPI実装

  # main.py - FastAPIでの実装例
  from fastapi import FastAPI, UploadFile, File, HTTPException
  from fastapi.responses import JSONResponse
  import tempfile
  import os

  app = FastAPI()
  processor = PPTXProcessor()

  @app.post("/api/process-pptx")
  async def process_pptx(file: UploadFile = File(...)):
      """PPTXファイルをアップロードして処理"""

      # ファイルの検証
      if not file.filename.endswith('.pptx'):
          raise HTTPException(400, "Only .pptx files are allowed")

      # 一時ファイルに保存
      with tempfile.NamedTemporaryFile(delete=False, suffix='.pptx') as tmp:
          content = await file.read()
          tmp.write(content)
          tmp_path = tmp.name

      try:
          # 処理実行
          result = processor.process_pptx(tmp_path)
          return JSONResponse(content=result)

      except Exception as e:
          raise HTTPException(500, f"Processing failed: {str(e)}")

      finally:
          # 一時ファイルをクリーンアップ
          os.unlink(tmp_path)

  @app.get("/health")
  async def health_check():
      """ヘルスチェック"""
      return {"status": "healthy"}

  3. Next.js/Reactでのプレビュー画面実装

  // components/SlidePreview.tsx
  import React, { useState, useEffect } from 'react';

  interface TextData {
    id: string;
    original: string;
    translated?: string;
    position: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    type: 'text' | 'table_cell';
    style?: any;
  }

  interface SlideData {
    pageNumber: number;
    imageData: string;
    texts: TextData[];
  }

  interface SlidePreviewProps {
    slides: SlideData[];
  }

  export function SlidePreview({ slides }: SlidePreviewProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedText, setSelectedText] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');

    const currentSlide = slides[currentIndex];

    // キーボードナビゲーション
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowLeft' && currentIndex > 0) {
          setCurrentIndex(prev => prev - 1);
        } else if (e.key === 'ArrowRight' && currentIndex < slides.length - 1) {
          setCurrentIndex(prev => prev + 1);
        } else if (e.key === 'Escape') {
          setSelectedText(null);
          setEditingId(null);
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentIndex, slides.length]);

    const handleTextClick = (textId: string) => {
      setSelectedText(textId);
    };

    const handleTextEdit = (text: TextData) => {
      setEditingId(text.id);
      setEditValue(text.translated || text.original);
    };

    const handleSaveEdit = () => {
      // ここで編集内容を保存
      console.log(`Saving text ${editingId}: ${editValue}`);
      setEditingId(null);
    };

    return (
      <div className="flex h-screen bg-gray-100">
        {/* サイドバー - スライド一覧 */}
        <div className="w-64 bg-white shadow-lg overflow-y-auto">
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4">スライド一覧</h2>
            <div className="space-y-2">
              {slides.map((slide, idx) => (
                <div
                  key={slide.pageNumber}
                  onClick={() => setCurrentIndex(idx)}
                  className={`cursor-pointer p-2 rounded ${
                    idx === currentIndex
                      ? 'bg-blue-100 border-2 border-blue-500'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  <div className="text-sm font-medium">
                    スライド {slide.pageNumber}
                  </div>
                  <div className="text-xs text-gray-500">
                    {slide.texts.length} テキスト
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* メインビュー */}
        <div className="flex-1 flex">
          {/* スライド画像 */}
          <div className="flex-1 p-8 flex items-center justify-center">
            <div className="relative bg-white shadow-2xl">
              <img 
                src={currentSlide.imageData}
                alt={`Slide ${currentSlide.pageNumber}`}
                style={{
                  transform: `scale(${zoom})`,
                  transition: 'transform 0.2s'
                }}
                className="max-w-full max-h-[70vh]"
              />

              {/* テキストオーバーレイ（ハイライト用） */}
              {selectedText && (
                <div 
                  className="absolute border-2 border-blue-500 bg-blue-100 
  bg-opacity-30"
                  style={{
                    left: `${currentSlide.texts.find(t => t.id ===
  selectedText)?.position.x}px`,
                    top: `${currentSlide.texts.find(t => t.id ===
  selectedText)?.position.y}px`,
                    width: `${currentSlide.texts.find(t => t.id ===
  selectedText)?.position.width}px`,
                    height: `${currentSlide.texts.find(t => t.id ===
  selectedText)?.position.height}px`,
                  }}
                />
              )}
            </div>

            {/* ズームコントロール */}
            <div className="absolute bottom-4 right-4 flex gap-2">
              <button
                onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                className="px-3 py-1 bg-white shadow rounded"
              >
                −
              </button>
              <span className="px-3 py-1 bg-white shadow rounded">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom(Math.min(2, zoom + 0.1))}
                className="px-3 py-1 bg-white shadow rounded"
              >
                +
              </button>
            </div>
          </div>

          {/* テキストパネル */}
          <div className="w-96 bg-white shadow-lg overflow-y-auto">
            <div className="p-4">
              <h3 className="text-lg font-semibold mb-4">
                テキスト内容 ({currentSlide.texts.length}件)
              </h3>
              <div className="space-y-3">
                {currentSlide.texts.map((text) => (
                  <div
                    key={text.id}
                    className={`p-3 border rounded cursor-pointer ${
                      selectedText === text.id 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => handleTextClick(text.id)}
                  >
                    <div className="text-xs text-gray-500 mb-1">
                      {text.type === 'table_cell' ? 'テーブル' : 'テキスト'}
                    </div>
                    <div className="text-sm font-medium mb-2">
                      {text.original}
                    </div>

                    {editingId === text.id ? (
                      <div className="mt-2">
                        <textarea
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-full p-2 border rounded text-sm"
                          rows={3}
                        />
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={handleSaveEdit}
                            className="px-3 py-1 bg-blue-500 text-white rounded 
  text-sm"
                          >
                            保存
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-3 py-1 bg-gray-300 rounded text-sm"
                          >
                            キャンセル
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2">
                        {text.translated && (
                          <div className="text-sm text-green-700 mb-2">
                            翻訳: {text.translated}
                          </div>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTextEdit(text);
                          }}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          編集
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ナビゲーションバー */}
        <div className="absolute bottom-0 left-64 right-0 bg-white shadow-lg p-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
              className="px-4 py-2 bg-blue-500 text-white rounded
  disabled:bg-gray-300"
            >
              前へ
            </button>

            <div className="text-center">
              <span className="font-medium">
                {currentIndex + 1} / {slides.length}
              </span>
            </div>

            <button
              onClick={() => setCurrentIndex(Math.min(slides.length - 1,
  currentIndex + 1))}
              disabled={currentIndex === slides.length - 1}
              className="px-4 py-2 bg-blue-500 text-white rounded
  disabled:bg-gray-300"
            >
              次へ
            </button>
          </div>
        </div>
      </div>
    );
  }

  ⚠️ 重要な注意点

  1. LibreOfficeの設定

  # 環境によってパスが異なる
  LIBREOFFICE_PATHS = {
      'darwin': '/Applications/LibreOffice.app/Contents/MacOS/soffice',
      'linux': '/usr/bin/libreoffice',
      'win32': 'C:\\Program Files\\LibreOffice\\program\\soffice.exe'
  }

  2. メモリ管理

  # 大きなファイルの処理時はメモリに注意
  def process_large_pptx(file_path):
      # ストリーミング処理を検討
      with tempfile.SpooledTemporaryFile(max_size=10*1024*1024) as tmp:
          # 10MB以下はメモリ、それ以上はディスク
          pass

  3. エラーハンドリング

  def safe_process(file_path):
      try:
          return processor.process_pptx(file_path)
      except subprocess.CalledProcessError as e:
          logger.error(f"LibreOffice failed: {e}")
          # フォールバック処理
      except Exception as e:
          logger.error(f"Unexpected error: {e}")
          # クリーンアップ
      finally:
          # 一時ファイルの削除
          cleanup_temp_files()

  4. 日本語フォントの対応

  JAPANESE_FONTS = [
      "Yu Gothic",
      "Hiragino Sans",
      "Meiryo",
      "MS Gothic"
  ]

  def apply_japanese_font(run):
      for font_name in JAPANESE_FONTS:
          try:
              run.font.name = font_name
              break
          except:
              continue

  5. Docker環境での実行

  FROM python:3.11-slim

  # LibreOfficeと日本語フォントをインストール
  RUN apt-get update && apt-get install -y \
      libreoffice \
      poppler-utils \
      fonts-noto-cjk \
      && rm -rf /var/lib/apt/lists/*

  WORKDIR /app
  COPY requirements.txt .
  RUN pip install -r requirements.txt

  COPY . .
  CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

  この実装により、PPTXファイルから高品質なプレビューとテキスト抽出が可能になります
  。必要に応じてカスタマイズしてください。