import { ClaudeTranslator, TranslationConfig } from './claude-translator';
import logger from '@/lib/logger';

export interface SlideContent {
  slide_number: number;
  texts: Array<{
    text?: string;
    table?: string[][];
    shape_id?: string;
    placeholder_type?: string;
  }>;
}

export interface TranslatedSlideContent {
  slide_number: number;
  translations: Array<{
    original_text?: string;
    translated_text?: string;
    original_table?: string[][];
    translated_table?: string[][];
    shape_id?: string;
    placeholder_type?: string;
  }>;
}

export interface TranslationProgress {
  total_slides: number;
  completed_slides: number;
  current_slide?: number;
  percentage: number;
  status: 'preparing' | 'translating' | 'finalizing' | 'completed' | 'failed';
  message?: string;
}

export class PPTXTranslationService {
  private translator: ClaudeTranslator;
  private progressCallback?: (progress: TranslationProgress) => void;

  constructor(translator?: ClaudeTranslator) {
    this.translator = translator || new ClaudeTranslator();
  }

  /**
   * Set progress callback for real-time updates
   */
  setProgressCallback(callback: (progress: TranslationProgress) => void) {
    this.progressCallback = callback;
  }

  /**
   * Emit progress update
   */
  private emitProgress(progress: TranslationProgress) {
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
    
    // Log progress for debugging
    logger.info('Translation progress:', {
      slide: `${progress.completed_slides}/${progress.total_slides}`,
      percentage: `${progress.percentage}%`,
      status: progress.status
    });
  }

  /**
   * Determine document type from slide content
   */
  private async detectDocumentType(slides: SlideContent[]): Promise<'business' | 'technical' | 'marketing' | 'general'> {
    // Collect sample text from first few slides
    const sampleTexts: string[] = [];
    for (const slide of slides.slice(0, 3)) {
      for (const text of slide.texts) {
        if (text.text) {
          sampleTexts.push(text.text);
        }
      }
    }
    
    const combinedText = sampleTexts.join(' ').toLowerCase();
    
    // Simple keyword-based classification
    const technicalKeywords = ['api', 'database', 'algorithm', 'code', 'function', 'server', 'debug', 'deploy'];
    const businessKeywords = ['revenue', 'profit', 'strategy', 'market', 'growth', 'roi', 'kpi', 'quarterly'];
    const marketingKeywords = ['brand', 'campaign', 'engagement', 'audience', 'conversion', 'funnel', 'reach'];
    
    const technicalCount = technicalKeywords.filter(kw => combinedText.includes(kw)).length;
    const businessCount = businessKeywords.filter(kw => combinedText.includes(kw)).length;
    const marketingCount = marketingKeywords.filter(kw => combinedText.includes(kw)).length;
    
    if (technicalCount > businessCount && technicalCount > marketingCount) {
      return 'technical';
    } else if (businessCount > marketingCount) {
      return 'business';
    } else if (marketingCount > 0) {
      return 'marketing';
    }
    
    return 'general';
  }

  /**
   * Translate all slides in a presentation
   */
  async translatePresentation(
    slides: SlideContent[],
    config: Omit<TranslationConfig, 'documentType'>
  ): Promise<TranslatedSlideContent[]> {
    try {
      this.emitProgress({
        total_slides: slides.length,
        completed_slides: 0,
        percentage: 0,
        status: 'preparing',
        message: 'Analyzing presentation content...'
      });

      // Detect document type
      const documentType = await this.detectDocumentType(slides);
      logger.info(`Detected document type: ${documentType}`);
      
      // Extract glossary for consistent translation
      const allTexts: string[] = [];
      for (const slide of slides) {
        for (const text of slide.texts) {
          if (text.text) {
            allTexts.push(text.text);
          }
        }
      }
      
      const glossary = await this.translator.extractGlossary(allTexts);
      logger.info(`Extracted glossary with ${Object.keys(glossary).length} terms`);

      // Complete translation config
      const fullConfig: TranslationConfig = {
        ...config,
        documentType,
        glossary,
        preserveFormatting: true
      };

      // Translate slides
      const translatedSlides: TranslatedSlideContent[] = [];
      
      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        
        this.emitProgress({
          total_slides: slides.length,
          completed_slides: i,
          current_slide: slide.slide_number,
          percentage: Math.round((i / slides.length) * 100),
          status: 'translating',
          message: `Translating slide ${slide.slide_number}...`
        });

        // Collect all texts from the slide for batch translation
        const textsToTranslate: string[] = [];
        const textIndices: number[] = [];
        const tables: string[][][] = [];
        const tableIndices: number[] = [];
        
        slide.texts.forEach((item, index) => {
          if (item.text) {
            textsToTranslate.push(item.text);
            textIndices.push(index);
          } else if (item.table) {
            tables.push(item.table);
            tableIndices.push(index);
          }
        });

        // Batch translate texts
        const textTranslations = textsToTranslate.length > 0
          ? await this.translator.translateBatch(textsToTranslate, fullConfig)
          : [];

        // Translate tables
        const tableTranslations = await Promise.all(
          tables.map(table => this.translator.translateTable(table, fullConfig))
        );

        // Reconstruct slide with translations
        const translations: TranslatedSlideContent['translations'] = [];
        let textIndex = 0;
        let tableIndex = 0;
        
        for (let j = 0; j < slide.texts.length; j++) {
          const item = slide.texts[j];
          
          if (item.text) {
            const translation = textTranslations[textIndex];
            translations.push({
              original_text: translation.originalText,
              translated_text: translation.translatedText,
              shape_id: item.shape_id,
              placeholder_type: item.placeholder_type
            });
            textIndex++;
          } else if (item.table) {
            const translation = tableTranslations[tableIndex];
            translations.push({
              original_table: translation.originalTable,
              translated_table: translation.translatedTable,
              shape_id: item.shape_id,
              placeholder_type: item.placeholder_type
            });
            tableIndex++;
          }
        }

        translatedSlides.push({
          slide_number: slide.slide_number,
          translations
        });
      }

      this.emitProgress({
        total_slides: slides.length,
        completed_slides: slides.length,
        percentage: 100,
        status: 'completed',
        message: 'Translation completed successfully'
      });

      return translatedSlides;
    } catch (error) {
      logger.error('Presentation translation error:', error);
      
      this.emitProgress({
        total_slides: slides.length,
        completed_slides: 0,
        percentage: 0,
        status: 'failed',
        message: error instanceof Error ? error.message : 'Translation failed'
      });
      
      throw error;
    }
  }

  /**
   * Optimize translations for better quality (second pass)
   */
  async optimizeTranslations(
    translatedSlides: TranslatedSlideContent[],
    config: TranslationConfig
  ): Promise<TranslatedSlideContent[]> {
    try {
      this.emitProgress({
        total_slides: translatedSlides.length,
        completed_slides: 0,
        percentage: 0,
        status: 'finalizing',
        message: 'Optimizing translations for consistency...'
      });

      // Create context from all translations for consistency check
      const allTranslations: string[] = [];
      for (const slide of translatedSlides) {
        for (const item of slide.translations) {
          if (item.translated_text) {
            allTranslations.push(item.translated_text);
          }
        }
      }

      // Second pass: Check for consistency and improve quality
      // This is a placeholder for more sophisticated optimization
      // Could include terminology consistency, style unification, etc.
      
      this.emitProgress({
        total_slides: translatedSlides.length,
        completed_slides: translatedSlides.length,
        percentage: 100,
        status: 'completed',
        message: 'Optimization completed'
      });

      return translatedSlides;
    } catch (error) {
      logger.error('Translation optimization error:', error);
      return translatedSlides; // Return original translations if optimization fails
    }
  }

  /**
   * Format translations for Python update script
   */
  formatForPythonScript(translatedSlides: TranslatedSlideContent[]): Record<number, any[]> {
    const formattedTranslations: Record<number, any[]> = {};
    
    for (const slide of translatedSlides) {
      const slideTranslations: any[] = [];
      
      for (const item of slide.translations) {
        if (item.translated_text) {
          slideTranslations.push({
            text: item.original_text,
            translated_text: item.translated_text,
            shape_id: item.shape_id,
            placeholder_type: item.placeholder_type
          });
        } else if (item.translated_table) {
          slideTranslations.push({
            table: item.original_table,
            translated_table: item.translated_table,
            shape_id: item.shape_id
          });
        }
      }
      
      formattedTranslations[slide.slide_number] = slideTranslations;
    }
    
    return formattedTranslations;
  }
}

// Singleton instance
let serviceInstance: PPTXTranslationService | null = null;

export function getTranslationService(): PPTXTranslationService {
  if (!serviceInstance) {
    serviceInstance = new PPTXTranslationService();
  }
  return serviceInstance;
}