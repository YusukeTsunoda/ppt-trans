export interface SlideData {
  pageNumber: number;
  imageUrl?: string;
  texts: TextData[];
  originalFileUrl?: string;
}

export interface TextData {
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
  is_title?: boolean;
}

export interface ProcessingResult {
  slides: SlideData[];
  totalSlides: number;
}

export interface ExtractedData {
  success: boolean;
  total_slides: number;
  slides: Array<{
    slide_number: number;
    texts: Array<{
      text?: string;
      shape_type?: string;
      is_title?: boolean;
      table?: string[][];
      position?: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
    }>;
  }>;
}

export interface TranslationRequest {
  texts: Array<{
    id: string;
    text: string;
  }>;
  targetLanguage: string;
}

export interface TranslationResponse {
  success: boolean;
  translations?: Array<{
    id: string;
    original: string;
    translated: string;
  }>;
  error?: string;
}