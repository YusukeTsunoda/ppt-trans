/**
 * Zod validation schemas for Server Actions
 * Provides comprehensive input validation with security constraints
 */

import { z } from 'zod';

// Maximum limits for security
const MAX_TEXT_LENGTH = 10000;
const MAX_TEXTS_COUNT = 100;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const VALID_LANGUAGES = ['ja', 'en', 'zh', 'ko', 'es', 'fr', 'de'] as const;
const VALID_EXTENSIONS = ['.pptx', '.ppt'] as const;

// UUID validation pattern
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Text item validation for translation
 */
export const textItemSchema = z.object({
  id: z.string().min(1).max(100),
  text: z.string().min(1).max(MAX_TEXT_LENGTH),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Translation action input validation
 */
export const translateTextsSchema = z.object({
  texts: z.array(textItemSchema).min(1).max(MAX_TEXTS_COUNT),
  targetLanguage: z.enum(VALID_LANGUAGES),
});

/**
 * File ID validation (UUID format)
 */
export const fileIdSchema = z.string().regex(UUID_PATTERN, 'Invalid file ID format');

/**
 * File path validation (security checks)
 */
export const filePathSchema = z.string()
  .min(1)
  .max(500)
  .refine((path) => {
    // Prevent path traversal attacks
    return !path.includes('../') && !path.includes('..\\');
  }, 'Invalid file path')
  .refine((path) => {
    // Must have valid extension
    return VALID_EXTENSIONS.some(ext => path.toLowerCase().endsWith(ext));
  }, 'Invalid file extension');

/**
 * Extract text from PPTX action validation
 */
export const extractTextFromPPTXSchema = z.object({
  fileId: fileIdSchema,
  filePath: filePathSchema,
});

/**
 * Apply translations action validation
 */
export const applyTranslationsSchema = z.object({
  fileId: fileIdSchema,
  filePath: filePathSchema,
  translations: z.object({
    slides: z.array(z.object({
      slide_number: z.number(),
      translations: z.array(z.object({
        original: z.string(),
        translated: z.string().max(MAX_TEXT_LENGTH),
        isTable: z.boolean().optional(),
        isTableCell: z.boolean().optional(),
        tableInfo: z.object({
          row: z.number(),
          col: z.number(),
        }).optional(),
      }))
    }))
  }),
});

/**
 * Translate PPTX action validation
 */
export const translatePPTXSchema = z.object({
  fileId: fileIdSchema,
  targetLanguage: z.enum(VALID_LANGUAGES).default('ja'),
});

/**
 * Admin activity query validation
 */
export const getActivitiesSchema = z.object({
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).default(0),
  userId: z.string().uuid().optional(),
  action: z.string().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
});

/**
 * Validate and sanitize input for Server Actions
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  input: unknown
): { success: true; data: T } | { success: false; error: string } {
  try {
    const data = schema.parse(input);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      // error.issuesを使用（error.errorsは存在しない）
      const messages = error.issues?.map(e => `${e.path.join('.')}: ${e.message}`) || ['Validation error'];
      return { success: false, error: messages.join(', ') };
    }
    return { success: false, error: 'Invalid input' };
  }
}

/**
 * Type exports for Server Actions
 */
export type TextItem = z.infer<typeof textItemSchema>;
export type TranslateTextsInput = z.infer<typeof translateTextsSchema>;
export type ExtractTextInput = z.infer<typeof extractTextFromPPTXSchema>;
export type ApplyTranslationsInput = z.infer<typeof applyTranslationsSchema>;
export type TranslatePPTXInput = z.infer<typeof translatePPTXSchema>;
export type GetActivitiesInput = z.infer<typeof getActivitiesSchema>;