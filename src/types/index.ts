// 共通型定義ファイル

// テキストの位置情報
export interface TextPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

// テキストデータ
export interface TextData {
  id: string;
  original: string;
  translated: string;
  position: TextPosition;
  type?: 'text' | 'table_cell';  // Optional: テキストの種類（通常テキストまたは表のセル）
}

// スライドデータ
export interface SlideData {
  pageNumber: number;
  imageUrl: string;
  originalFileUrl: string;
  texts: TextData[];
}

// 処理結果
export interface ProcessingResult {
  slides: SlideData[];
  totalSlides: number;
  fileName?: string;
  processedAt?: string;
  fileId?: string;
}

// 翻訳用テキスト（APIリクエスト用）
export interface TextToTranslate {
  id: string;
  original: string;
}

// 翻訳結果（APIレスポンス用）
export interface TranslatedText {
  id: string;
  original: string;
  translated: string;
}

// エディター画面のプロパティ
export interface EditorScreenProps {
  data: ProcessingResult;
  onBack: () => void;
  historyId?: string | null;
}

// API レスポンス型
export interface GeneratePptxResponse {
  success: boolean;
  downloadUrl?: string;
  fileName?: string;
  error?: string;
}