/**
 * Test Fixtures Management
 * Centralized fixture loading and caching
 */

import fs from 'fs';
import path from 'path';

export class TestFixtures {
  private static cache = new Map<string, any>();
  private static basePath = path.join(__dirname);
  
  /**
   * Load a fixture file
   */
  static load<T = any>(filename: string): T {
    const cacheKey = filename;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    const filePath = path.join(this.basePath, filename);
    
    try {
      let content: any;
      
      if (filename.endsWith('.json')) {
        content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } else if (filename.endsWith('.txt') || filename.endsWith('.md')) {
        content = fs.readFileSync(filePath, 'utf-8');
      } else {
        content = fs.readFileSync(filePath);
      }
      
      this.cache.set(cacheKey, content);
      return content;
    } catch (error) {
      throw new Error(`Failed to load fixture ${filename}: ${error}`);
    }
  }
  
  /**
   * Load a binary fixture (e.g., PPTX file)
   */
  static loadBinary(filename: string): Buffer {
    return this.load<Buffer>(filename);
  }
  
  /**
   * Create a test file object
   */
  static createTestFile(
    filename = 'test.pptx',
    content?: Buffer | string,
    mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ): File {
    const actualContent = content || 'test content';
    const blobContent = typeof actualContent === 'string' 
      ? actualContent 
      : actualContent as any;
    const blob = new Blob(
      [blobContent],
      { type: mimeType }
    );
    
    return new File([blob], filename, { type: mimeType });
  }
  
  /**
   * Clear the cache
   */
  static clearCache(): void {
    this.cache.clear();
  }
}

// Pre-defined fixtures
export const fixtures = {
  // User fixtures
  users: {
    regular: {
      id: 'user-regular-123',
      email: 'regular@test.com',
      role: 'user',
    },
    admin: {
      id: 'user-admin-456',
      email: 'admin@test.com',
      role: 'admin',
    },
    premium: {
      id: 'user-premium-789',
      email: 'premium@test.com',
      role: 'user',
      subscription: 'premium',
    },
  },
  
  // File fixtures
  files: {
    small: {
      name: 'small.pptx',
      size: 1024 * 100, // 100KB
      slides: 5,
    },
    medium: {
      name: 'medium.pptx',
      size: 1024 * 1024 * 10, // 10MB
      slides: 20,
    },
    large: {
      name: 'large.pptx',
      size: 1024 * 1024 * 90, // 90MB
      slides: 100,
    },
    invalid: {
      name: 'document.pdf',
      size: 1024 * 500, // 500KB
      type: 'application/pdf',
    },
  },
  
  // Translation fixtures
  translations: {
    simple: {
      source: 'Hello World',
      target: 'こんにちは世界',
      sourceLang: 'en',
      targetLang: 'ja',
    },
    complex: {
      source: 'The quick brown fox jumps over the lazy dog',
      target: '素早い茶色のキツネが怠け者の犬を飛び越える',
      sourceLang: 'en',
      targetLang: 'ja',
    },
    multiline: {
      source: `Line 1
Line 2
Line 3`,
      target: `行1
行2
行3`,
      sourceLang: 'en',
      targetLang: 'ja',
    },
  },
  
  // API responses
  responses: {
    success: {
      success: true,
      message: 'Operation completed successfully',
      data: {},
    },
    error: {
      success: false,
      error: 'Operation failed',
      code: 'OPERATION_FAILED',
    },
    unauthorized: {
      success: false,
      error: 'Unauthorized',
      code: 'AUTH_UNAUTHORIZED',
      statusCode: 401,
    },
    validation: {
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: [
        { field: 'email', message: 'Invalid email format' },
        { field: 'password', message: 'Password too short' },
      ],
    },
  },
  
  // Mock delays for realistic testing
  delays: {
    instant: 0,
    fast: 50,
    normal: 200,
    slow: 1000,
    timeout: 5000,
  },
};

// Helper function to create realistic test scenarios
export function createTestScenario(type: 'success' | 'error' | 'slow' | 'timeout') {
  switch (type) {
    case 'success':
      return {
        delay: fixtures.delays.fast,
        response: fixtures.responses.success,
        status: 200,
      };
    
    case 'error':
      return {
        delay: fixtures.delays.normal,
        response: fixtures.responses.error,
        status: 500,
      };
    
    case 'slow':
      return {
        delay: fixtures.delays.slow,
        response: fixtures.responses.success,
        status: 200,
      };
    
    case 'timeout':
      return {
        delay: fixtures.delays.timeout,
        response: null,
        status: 0,
      };
    
    default:
      throw new Error(`Unknown scenario type: ${type}`);
  }
}

export default TestFixtures;