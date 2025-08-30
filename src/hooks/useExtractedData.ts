import { useState, useEffect, useCallback } from 'react';
import logger from '@/lib/logger';

interface ExtractedData {
  success: boolean;
  total_slides: number;
  slides: Array<{
    slide_number: number;
    texts: Array<{
      text?: string;
      table?: string[][];
      shape_type?: string;
      position?: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
      table_info?: {
        rows: number;
        cols: number;
        position: {
          x: number;
          y: number;
          width: number;
          height: number;
        };
      };
      cells?: Array<{
        text: string;
        row: number;
        col: number;
        position: {
          x: number;
          y: number;
          width: number;
          height: number;
        };
      }>;
    }>;
  }>;
}

interface SlideData {
  pageNumber: number;
  imageUrl?: string;
  texts: Array<{
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
    tableInfo?: {
      row: number;
      col: number;
      totalRows?: number;
      totalCols?: number;
    };
  }>;
}

interface FileRecord {
  id: string;
  filename: string;
  original_name: string;
  file_size: number;
  status: string;
  file_path?: string;
  extracted_data?: ExtractedData;
  created_at: string;
}

export function useExtractedData(file: FileRecord) {
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Process extracted data into slides
  const processExtractedData = useCallback((data: ExtractedData) => {
    const processedSlides: SlideData[] = data.slides.map((slide) => {
      const texts: SlideData['texts'] = [];
      
      slide.texts.forEach((item, index) => {
        if (item.cells && item.table_info) {
          // Process table cells
          item.cells.forEach((cell) => {
            texts.push({
              id: `slide-${slide.slide_number}-table-${index}-cell-${cell.row}-${cell.col}`,
              original: cell.text,
              position: cell.position,
              type: 'TABLE_CELL',
              tableInfo: {
                row: cell.row,
                col: cell.col,
                totalRows: item.table_info?.rows,
                totalCols: item.table_info?.cols
              }
            });
          });
        } else if (item.table) {
          // Legacy table format
          item.table.forEach((row, rowIndex) => {
            row.forEach((cellText, colIndex) => {
              if (cellText && cellText.trim()) {
                texts.push({
                  id: `slide-${slide.slide_number}-table-${index}-${rowIndex}-${colIndex}`,
                  original: cellText,
                  type: 'TABLE_CELL',
                  tableInfo: {
                    row: rowIndex,
                    col: colIndex,
                    totalRows: item.table?.length || 0,
                    totalCols: row.length
                  }
                });
              }
            });
          });
        } else if (item.text) {
          // Regular text
          texts.push({
            id: `slide-${slide.slide_number}-text-${index}`,
            original: item.text,
            position: item.position,
            type: item.shape_type || 'TEXT'
          });
        }
      });

      return {
        pageNumber: slide.slide_number,
        texts
      };
    });

    setSlides(processedSlides);
  }, []);

  // Load initial data
  useEffect(() => {
    if (file.extracted_data) {
      setExtractedData(file.extracted_data);
      processExtractedData(file.extracted_data);
    }
  }, [file, processExtractedData]);

  // Extract text from file
  const extractText = useCallback(async () => {
    setIsExtracting(true);
    setError(null);

    try {
      const response = await fetch(`/api/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: file.id })
      });

      if (!response.ok) {
        throw new Error('Failed to extract text');
      }

      const data = await response.json();
      
      if (data.success && data.data) {
        setExtractedData(data.data);
        processExtractedData(data.data);
      } else {
        throw new Error(data.error || 'Extraction failed');
      }
    } catch (error) {
      logger.error('Text extraction error:', error);
      setError(error instanceof Error ? error.message : 'テキスト抽出に失敗しました');
    } finally {
      setIsExtracting(false);
    }
  }, [file.id, processExtractedData]);

  return {
    extractedData,
    slides,
    isExtracting,
    error,
    extractText
  };
}