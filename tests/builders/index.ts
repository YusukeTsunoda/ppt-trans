/**
 * Test Data Builders
 * Fluent API for creating test data with sensible defaults
 */

import { FileRecord } from '@/lib/data/files';
import { User } from '@supabase/supabase-js';

// Base builder class
abstract class TestDataBuilder<T> {
  protected data: Partial<T> = {};
  
  abstract build(): T;
  
  reset(): this {
    this.data = {};
    return this;
  }
  
  with(updates: Partial<T>): this {
    this.data = { ...this.data, ...updates };
    return this;
  }
}

// User builder
export class UserBuilder extends TestDataBuilder<User> {
  constructor() {
    super();
    // Default values
    this.data = {
      id: 'user-' + Math.random().toString(36).substr(2, 9),
      email: 'user@test.com',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      role: 'authenticated',
    };
  }
  
  withId(id: string): this {
    this.data.id = id;
    return this;
  }
  
  withEmail(email: string): this {
    this.data.email = email;
    return this;
  }
  
  withRole(role: string): this {
    this.data.role = role;
    this.data.app_metadata = { ...this.data.app_metadata, role };
    return this;
  }
  
  asAdmin(): this {
    return this.withRole('admin');
  }
  
  asPremium(): this {
    this.data.user_metadata = { 
      ...this.data.user_metadata, 
      subscription: 'premium' 
    };
    return this;
  }
  
  build(): User {
    return this.data as User;
  }
}

// File builder
export class FileBuilder extends TestDataBuilder<FileRecord> {
  private static counter = 0;
  
  constructor() {
    super();
    FileBuilder.counter++;
    
    // Default values
    this.data = {
      id: `file-${FileBuilder.counter}`,
      user_id: 'user-123',
      filename: `file-${FileBuilder.counter}.pptx`,
      original_filename: `Presentation ${FileBuilder.counter}.pptx`,
      file_size: 1024 * 1024, // 1MB
      mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      storage_path: `uploads/file-${FileBuilder.counter}.pptx`,
      status: 'uploaded',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  
  withId(id: string): this {
    this.data.id = id;
    return this;
  }
  
  withName(name: string): this {
    this.data.original_filename = name;
    this.data.filename = name.toLowerCase().replace(/\s+/g, '-');
    return this;
  }
  
  withSize(bytes: number): this {
    this.data.file_size = bytes;
    return this;
  }
  
  withStatus(status: FileRecord['status']): this {
    this.data.status = status;
    return this;
  }
  
  asTranslating(progress?: number): this {
    this.data.status = 'processing';
    this.data.translation_result = {
      slide_count: 10,
    };
    return this;
  }
  
  asTranslated(): this {
    this.data.status = 'completed';
    this.data.translation_result = {
      translated_path: `translated/${this.data.filename}`,
      slide_count: 10,
    };
    return this;
  }
  
  withError(message: string): this {
    this.data.status = 'failed';
    this.data.translation_result = {
      error: message,
    };
    return this;
  }
  
  forUser(userId: string): this {
    this.data.user_id = userId;
    return this;
  }
  
  build(): FileRecord {
    return this.data as FileRecord;
  }
}

// Form data builder
export class FormDataBuilder {
  private formData: FormData;
  
  constructor() {
    this.formData = new FormData();
  }
  
  withFile(
    name = 'file',
    content = 'test content',
    filename = 'test.pptx',
    type = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ): this {
    const file = new File([content], filename, { type });
    this.formData.append(name, file);
    return this;
  }
  
  withField(name: string, value: string): this {
    this.formData.append(name, value);
    return this;
  }
  
  withLargeFile(sizeMB: number): this {
    const content = new Array(sizeMB * 1024 * 1024).join('a');
    return this.withFile('file', content, 'large.pptx');
  }
  
  withInvalidFile(): this {
    const file = new File(['content'], 'invalid.pdf', { type: 'application/pdf' });
    this.formData.append('file', file);
    return this;
  }
  
  build(): FormData {
    return this.formData;
  }
}

// Supabase response builder
export class SupabaseResponseBuilder<T = any> {
  private response: any = {
    data: null,
    error: null,
    count: null,
    status: 200,
    statusText: 'OK',
  };
  
  withData(data: T): this {
    this.response.data = data;
    return this;
  }
  
  withError(message: string, code?: string): this {
    this.response.error = {
      message,
      code: code || 'ERROR',
      details: null,
      hint: null,
    };
    this.response.data = null;
    return this;
  }
  
  withCount(count: number): this {
    this.response.count = count;
    return this;
  }
  
  withStatus(status: number, statusText?: string): this {
    this.response.status = status;
    this.response.statusText = statusText || 'Error';
    return this;
  }
  
  asNotFound(): this {
    return this
      .withError('Not found', 'PGRST116')
      .withStatus(404, 'Not Found');
  }
  
  asUnauthorized(): this {
    return this
      .withError('Unauthorized', 'AUTH_UNAUTHORIZED')
      .withStatus(401, 'Unauthorized');
  }
  
  asNetworkError(): this {
    return this
      .withError('Network error', 'NETWORK_ERROR')
      .withStatus(0, 'Network Error');
  }
  
  build() {
    return this.response;
  }
}

// Mock builder for Supabase client
export class SupabaseMockBuilder {
  private client: any = {};
  
  withAuth(overrides = {}): this {
    this.client.auth = {
      getUser: jest.fn().mockResolvedValue(
        new SupabaseResponseBuilder()
          .withData({ user: new UserBuilder().build() })
          .build()
      ),
      getSession: jest.fn().mockResolvedValue(
        new SupabaseResponseBuilder()
          .withData({ session: null })
          .build()
      ),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      ...overrides,
    };
    return this;
  }
  
  withStorage(overrides = {}): this {
    this.client.storage = {
      from: jest.fn(() => ({
        upload: jest.fn().mockResolvedValue(
          new SupabaseResponseBuilder()
            .withData({ path: 'uploads/test.pptx' })
            .build()
        ),
        download: jest.fn(),
        remove: jest.fn(),
        createSignedUrl: jest.fn(),
        getPublicUrl: jest.fn(),
        ...overrides,
      })),
    };
    return this;
  }
  
  withDatabase(overrides = {}): this {
    this.client.from = jest.fn((table: string) => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
          limit: jest.fn(),
        })),
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
      update: jest.fn(),
      delete: jest.fn(),
      ...overrides,
    }));
    return this;
  }
  
  build() {
    // Ensure all parts are initialized
    if (!this.client.auth) this.withAuth();
    if (!this.client.storage) this.withStorage();
    if (!this.client.from) this.withDatabase();
    
    return this.client;
  }
}

// Export convenient factory functions
export const aUser = () => new UserBuilder();
export const aFile = () => new FileBuilder();
export const aFormData = () => new FormDataBuilder();
export const aSupabaseResponse = <T = any>() => new SupabaseResponseBuilder<T>();
export const aSupabaseMock = () => new SupabaseMockBuilder();

// Preset builders
export const presets = {
  adminUser: () => aUser().asAdmin().withEmail('admin@test.com'),
  premiumUser: () => aUser().asPremium().withEmail('premium@test.com'),
  uploadedFile: () => aFile().withStatus('uploaded'),
  translatingFile: () => aFile().asTranslating(50),
  translatedFile: () => aFile().asTranslated(),
  errorFile: () => aFile().withError('Translation failed'),
  validFormData: () => aFormData().withFile(),
  largeFormData: () => aFormData().withLargeFile(90),
  invalidFormData: () => aFormData().withInvalidFile(),
};