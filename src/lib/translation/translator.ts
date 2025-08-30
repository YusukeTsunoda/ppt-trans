import Anthropic from '@anthropic-ai/sdk';
import logger from '@/lib/logger';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function translateText(
  text: string,
  targetLanguage: string = 'en'
): Promise<{ translatedText: string; sourceLanguage: string; confidence: number }> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Translate the following text to ${targetLanguage}. Only return the translated text, nothing else: ${text}`
      }]
    });
    
    const translatedText = response.content[0].type === 'text' 
      ? response.content[0].text 
      : '';
    
    return {
      translatedText,
      sourceLanguage: 'auto',
      confidence: 0.95
    };
  } catch (error) {
    logger.error('Translation error:', error);
    throw new Error('Translation failed');
  }
}

export default { translateText };