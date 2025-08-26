/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.test.ts',
    '<rootDir>/src/**/__tests__/**/*.test.tsx',
    '<rootDir>/src/**/*.test.ts',
    '<rootDir>/src/**/*.test.tsx',
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/tests/**/*.test.tsx'
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
        moduleResolution: 'node',
        allowSyntheticDefaultImports: true,
        strict: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
      }
    }]
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|sass|scss)$': 'identity-obj-proxy',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js', '<rootDir>/tests/setup/test-setup.ts'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/index.ts',
    '!src/types/**',
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  },
  moduleDirectories: ['node_modules', 'src'],
  testPathIgnorePatterns: [
    '/node_modules/', 
    '/.next/',
    '/e2e/',
    '/cypress/',
    '/playwright.config.ts'
  ],
  // プロセス分離とクロスコンタミネーション防止
  modulePathIgnorePatterns: [
    '<rootDir>/e2e/',
    '<rootDir>/playwright.config.ts',
    '<rootDir>/auth.json',
    '<rootDir>/test-results/',
    '<rootDir>/playwright-report/'
  ],
  // プロセス制御強化
  maxWorkers: 1,
  forceExit: true,
  detectOpenHandles: true,
  verbose: true
};