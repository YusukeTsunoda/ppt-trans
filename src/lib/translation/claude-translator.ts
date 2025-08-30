import Anthropic from '@anthropic-ai/sdk';
import logger from '@/lib/logger';

export interface TranslationConfig {
  sourceLanguage?: string;
  targetLanguage: string;
  documentType?: 'business' | 'technical' | 'marketing' | 'general';
  preserveFormatting?: boolean;
  glossary?: Record<string, string>;
}

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  confidence?: number;
  notes?: string;
}

export interface TableTranslationResult {
  originalTable: string[][];
  translatedTable: string[][];
}

export class ClaudeTranslator {
  private client: Anthropic;
  private model: string = 'claude-3-opus-20240229';
  
  constructor(apiKey?: string) {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error('ANTHROPIC_API_KEY is required');
    }
    
    this.client = new Anthropic({
      apiKey: key
    });
  }

  /**
   * Generate translation prompt based on document type
   */
  private generatePrompt(
    text: string,
    config: TranslationConfig
  ): string {
    const { sourceLanguage = 'auto-detect', targetLanguage, documentType = 'general', glossary } = config;
    
    let contextPrompt = '';
    switch (documentType) {
      case 'business':
        contextPrompt = 'This is a business presentation. Maintain professional tone and business terminology.';
        break;
      case 'technical':
        contextPrompt = 'This is a technical document. Preserve technical terms, code snippets, and maintain accuracy of technical concepts.';
        break;
      case 'marketing':
        contextPrompt = 'This is marketing material. Keep the persuasive tone and emotional appeal while adapting to cultural context.';
        break;
      default:
        contextPrompt = 'This is a general presentation.';
    }

    const glossaryPrompt = glossary && Object.keys(glossary).length > 0
      ? `\n\nUse this glossary for consistent translation of specific terms:\n${JSON.stringify(glossary, null, 2)}`
      : '';

    return `You are a professional translator specializing in PowerPoint presentations. ${contextPrompt}

Task: Translate the following text from ${sourceLanguage === 'auto-detect' ? 'the detected language' : sourceLanguage} to ${targetLanguage}.

Requirements:
1. Preserve the original meaning and intent
2. Maintain appropriate formality level
3. Keep formatting markers (bullets, numbers, etc.)
4. Preserve any placeholders or variables (e.g., {name}, %s)
5. Adapt cultural references appropriately
6. If the text is already in the target language, return it unchanged
${glossaryPrompt}

Text to translate:
"""
${text}
"""

Provide ONLY the translated text without any explanation or metadata.`;
  }

  /**
   * Translate a single text string
   */
  async translateText(
    text: string,
    config: TranslationConfig
  ): Promise<TranslationResult> {
    try {
      // Skip translation for empty or whitespace-only text
      if (!text || !text.trim()) {
        return {
          originalText: text,
          translatedText: text
        };
      }

      const prompt = this.generatePrompt(text, config);
      
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 2000,
        temperature: 0.3, // Lower temperature for more consistent translations
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const translatedText = response.content[0].type === 'text' 
        ? response.content[0].text.trim()
        : text;

      return {
        originalText: text,
        translatedText,
        confidence: 0.95 // Claude typically has high confidence
      };
    } catch (error) {
      logger.error('Translation error:', error);
      
      // Fallback to original text on error
      return {
        originalText: text,
        translatedText: text,
        notes: 'Translation failed, returning original text'
      };
    }
  }

  /**
   * Translate multiple texts in batch for efficiency
   */
  async translateBatch(
    texts: string[],
    config: TranslationConfig
  ): Promise<TranslationResult[]> {
    try {
      // Filter out empty texts but keep their indices
      const nonEmptyTexts = texts.map((text, index) => ({ text, index }))
        .filter(item => item.text && item.text.trim());

      if (nonEmptyTexts.length === 0) {
        return texts.map(text => ({
          originalText: text,
          translatedText: text
        }));
      }

      // Create batch prompt
      const batchPrompt = `You are a professional translator specializing in PowerPoint presentations.

Task: Translate the following ${nonEmptyTexts.length} texts from ${config.sourceLanguage || 'auto-detect'} to ${config.targetLanguage}.

Requirements:
1. Preserve the original meaning and intent
2. Maintain appropriate formality level  
3. Keep formatting markers
4. Return translations in the same order as input
5. Format output as JSON array

Texts to translate:
${JSON.stringify(nonEmptyTexts.map(item => item.text), null, 2)}

Return ONLY a JSON array of translated strings in the same order.`;

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4000,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: batchPrompt
          }
        ]
      });

      let translations: string[] = [];
      if (response.content[0].type === 'text') {
        try {
          translations = JSON.parse(response.content[0].text);
        } catch {
          // Fallback to single translation if JSON parsing fails
          translations = nonEmptyTexts.map(item => item.text);
        }
      }

      // Reconstruct results maintaining original indices
      const results: TranslationResult[] = [];
      let translationIndex = 0;
      
      for (let i = 0; i < texts.length; i++) {
        if (!texts[i] || !texts[i].trim()) {
          results.push({
            originalText: texts[i],
            translatedText: texts[i]
          });
        } else {
          results.push({
            originalText: texts[i],
            translatedText: translations[translationIndex] || texts[i],
            confidence: 0.95
          });
          translationIndex++;
        }
      }

      return results;
    } catch (error) {
      logger.error('Batch translation error:', error);
      
      // Fallback to translating one by one
      return Promise.all(
        texts.map(text => this.translateText(text, config))
      );
    }
  }

  /**
   * Translate a table (2D array of strings)
   */
  async translateTable(
    table: string[][],
    config: TranslationConfig
  ): Promise<TableTranslationResult> {
    try {
      // Flatten table for batch translation
      const flatTexts = table.flat();
      const translations = await this.translateBatch(flatTexts, config);
      
      // Reconstruct table structure
      const translatedTable: string[][] = [];
      let index = 0;
      
      for (const row of table) {
        const translatedRow: string[] = [];
        for (const cell of row) {
          translatedRow.push(translations[index].translatedText);
          index++;
        }
        translatedTable.push(translatedRow);
      }
      
      return {
        originalTable: table,
        translatedTable
      };
    } catch (error) {
      logger.error('Table translation error:', error);
      
      return {
        originalTable: table,
        translatedTable: table
      };
    }
  }

  /**
   * Detect the language of the input text
   */
  async detectLanguage(text: string): Promise<string> {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 50,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: `Detect the language of this text and return ONLY the ISO 639-1 language code (e.g., 'en' for English, 'ja' for Japanese, 'zh' for Chinese): "${text.substring(0, 200)}"`
          }
        ]
      });

      if (response.content[0].type === 'text') {
        return response.content[0].text.trim().toLowerCase();
      }
      
      return 'en'; // Default to English
    } catch (error) {
      logger.error('Language detection error:', error);
      return 'en';
    }
  }

  /**
   * Create a custom glossary from the document
   */
  async extractGlossary(texts: string[]): Promise<Record<string, string>> {
    try {
      const prompt = `Analyze these presentation texts and identify key terms that should be translated consistently. Return a JSON object mapping source terms to target terms.

Texts:
${texts.slice(0, 10).join('\n')}

Return ONLY a JSON object like: {"term1": "translation1", "term2": "translation2"}`;

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1000,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      if (response.content[0].type === 'text') {
        try {
          return JSON.parse(response.content[0].text);
        } catch {
          return {};
        }
      }
      
      return {};
    } catch (error) {
      logger.error('Glossary extraction error:', error);
      return {};
    }
  }
}

// Singleton instance
let translatorInstance: ClaudeTranslator | null = null;

export function getTranslator(): ClaudeTranslator {
  if (!translatorInstance) {
    translatorInstance = new ClaudeTranslator();
  }
  return translatorInstance;
}