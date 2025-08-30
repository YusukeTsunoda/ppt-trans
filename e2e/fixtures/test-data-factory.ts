/**
 * Test Data Factory
 * 
 * Purpose: Generate dynamic, unique test data to prevent test coupling
 * and ensure each test runs with isolated data sets.
 * 
 * Key Benefits:
 * - No hardcoded values that could exist in production
 * - Unique data per test run prevents data collision
 * - Centralized test data management
 * - Realistic data generation for better testing
 */

export interface TestUser {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role?: 'USER' | 'ADMIN';
}

export interface TestFile {
  name: string;
  path: string;
  size: number;
  type: 'pptx' | 'pdf' | 'docx';
  content?: Buffer;
}

export interface TestProject {
  name: string;
  description: string;
  targetLanguage: string;
  sourceLanguage: string;
}

export class TestDataFactory {
  private static readonly TEST_DOMAIN = 'testdomain.local';
  private static readonly MIN_PASSWORD_LENGTH = 12;

  /**
   * Generate a unique test user with realistic data
   * @param overrides Partial user data to override defaults
   */
  static createUser(overrides?: Partial<TestUser>): TestUser {
    const timestamp = Date.now();
    const randomHex = Math.random().toString(16).substring(2, 10);
    
    return {
      email: `test.user.${timestamp}.${randomHex}@${this.TEST_DOMAIN}`,
      password: this.generateSecurePassword(),
      firstName: `TestUser${timestamp}`,
      lastName: `Lastname${randomHex}`,
      role: 'USER',
      ...overrides
    };
  }

  /**
   * Generate an admin user with elevated privileges
   */
  static createAdminUser(overrides?: Partial<TestUser>): TestUser {
    return this.createUser({
      ...overrides,
      role: 'ADMIN',
      email: overrides?.email || `admin.${Date.now()}@${this.TEST_DOMAIN}`
    });
  }

  /**
   * Generate a secure password that meets complexity requirements
   */
  static generateSecurePassword(): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    let password = '';
    
    // Ensure at least one of each required character type
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];
    
    // Fill the rest with random characters
    const allChars = uppercase + lowercase + numbers + special;
    const remainingLength = this.MIN_PASSWORD_LENGTH - password.length;
    
    for (let i = 0; i < remainingLength; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password to avoid predictable patterns
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  /**
   * Generate test file metadata
   */
  static createTestFile(overrides?: Partial<TestFile>): TestFile {
    const timestamp = Date.now();
    const fileTypes = ['pptx', 'pdf', 'docx'] as const;
    const type = overrides?.type || fileTypes[Math.floor(Math.random() * fileTypes.length)];
    
    return {
      name: `test-file-${timestamp}.${type}`,
      path: `/tmp/test-files/test-file-${timestamp}.${type}`,
      size: Math.floor(Math.random() * (10485760 - 1024) + 1024), // 1KB to 10MB
      type,
      ...overrides
    };
  }

  /**
   * Generate test project data
   */
  static createProject(overrides?: Partial<TestProject>): TestProject {
    const timestamp = Date.now();
    return {
      name: `Test Presentation ${timestamp}`,
      description: `Test project description for automated testing ${timestamp}`,
      sourceLanguage: 'en',
      targetLanguage: 'ja',
      ...overrides
    };
  }

  /**
   * Create a batch of users for testing
   */
  static createUsers(count: number, overrides?: Partial<TestUser>): TestUser[] {
    return Array.from({ length: count }, () => this.createUser(overrides));
  }

  /**
   * Create test data for specific scenarios
   */
  static scenarios = {
    /**
     * User with invalid email format
     */
    invalidEmailUser(): TestUser {
      return {
        email: 'invalid-email-format',
        password: TestDataFactory.generateSecurePassword()
      };
    },

    /**
     * User with weak password
     */
    weakPasswordUser(): TestUser {
      return {
        email: TestDataFactory.createUser().email,
        password: '123' // Intentionally weak
      };
    },

    /**
     * User with SQL injection attempt
     */
    sqlInjectionUser(): TestUser {
      return {
        email: `'; DROP TABLE users; --@${TestDataFactory.TEST_DOMAIN}`,
        password: TestDataFactory.generateSecurePassword()
      };
    },

    /**
     * User with XSS attempt
     */
    xssUser(): TestUser {
      return {
        email: TestDataFactory.createUser().email,
        password: '<script>alert("XSS")</script>',
        firstName: '<img src=x onerror=alert("XSS")>'
      };
    },

    /**
     * Large file for upload testing
     */
    largeFile(): TestFile {
      return TestDataFactory.createTestFile({
        name: 'large-presentation.pptx',
        size: 52428800, // 50MB
        type: 'pptx'
      });
    },

    /**
     * File with special characters in name
     */
    specialCharFile(): TestFile {
      const timestamp = Date.now();
      return TestDataFactory.createTestFile({
        name: `test-file-special-chars-${timestamp}.pptx`
      });
    }
  };

  /**
   * Clean up test data (for use in afterEach/afterAll hooks)
   */
  static cleanup = {
    /**
     * Generate cleanup queries for test users
     */
    getUserCleanupQuery(): string {
      return `DELETE FROM users WHERE email LIKE '%@${TestDataFactory.TEST_DOMAIN}'`;
    },

    /**
     * Generate cleanup queries for test files
     */
    getFileCleanupQuery(): string {
      return `DELETE FROM files WHERE filename LIKE 'test-file-%'`;
    },

    /**
     * Generate cleanup queries for test projects
     */
    getProjectCleanupQuery(): string {
      return `DELETE FROM projects WHERE name LIKE '%Test Project%'`;
    }
  };

  /**
   * Validation helpers
   */
  static validators = {
    /**
     * Check if email is in test domain
     */
    isTestEmail(email: string): boolean {
      return email.endsWith(`@${TestDataFactory.TEST_DOMAIN}`);
    },

    /**
     * Check if file is test file
     */
    isTestFile(filename: string): boolean {
      return filename.startsWith('test-file-');
    },

    /**
     * Validate password complexity
     */
    isValidPassword(password: string): boolean {
      const hasUpperCase = /[A-Z]/.test(password);
      const hasLowerCase = /[a-z]/.test(password);
      const hasNumbers = /\d/.test(password);
      const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
      const hasMinLength = password.length >= TestDataFactory.MIN_PASSWORD_LENGTH;
      
      return hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar && hasMinLength;
    }
  };
}

// Export commonly used scenarios for convenience
export const {
  invalidEmailUser,
  weakPasswordUser,
  sqlInjectionUser,
  xssUser,
  largeFile,
  specialCharFile
} = TestDataFactory.scenarios;