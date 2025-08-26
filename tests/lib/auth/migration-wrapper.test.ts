import { MigrationWrapper, MigrationConfig } from '../../../src/lib/auth/migration-wrapper';
import logger from '../../../src/lib/logger';

// Mock logger
jest.mock('../../../src/lib/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const mockLogger = logger as jest.Mocked<typeof logger>;

describe('MigrationWrapper', () => {
  let wrapper: MigrationWrapper;
  let mockConfig: MigrationConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConfig = {
      version: '1.0.0',
      description: 'Test migration',
      rollbackable: true
    };
    
    wrapper = new MigrationWrapper(mockConfig);
  });

  describe('constructor', () => {
    test('initializes with config', () => {
      expect(wrapper).toBeInstanceOf(MigrationWrapper);
      expect(wrapper.getConfig()).toEqual(mockConfig);
    });

    test('sets default values', () => {
      const minimalConfig: MigrationConfig = {
        version: '1.0.0',
        description: 'Minimal migration'
      };
      
      const minimalWrapper = new MigrationWrapper(minimalConfig);
      const config = minimalWrapper.getConfig();
      
      expect(config.rollbackable).toBe(false);
      expect(config.timeout).toBeUndefined();
    });
  });

  describe('execute', () => {
    test('executes migration successfully', async () => {
      const mockMigrationFn = jest.fn().mockResolvedValue('success');
      
      const result = await wrapper.execute(mockMigrationFn);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.executionTime).toBeGreaterThan(0);
      expect(mockMigrationFn).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting migration: Test migration (v1.0.0)'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Migration completed successfully')
      );
    });

    test('handles migration failure', async () => {
      const error = new Error('Migration failed');
      const mockMigrationFn = jest.fn().mockRejectedValue(error);
      
      const result = await wrapper.execute(mockMigrationFn);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
      expect(result.executionTime).toBeGreaterThan(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Migration failed: Test migration (v1.0.0)',
        error
      );
    });

    test('respects timeout configuration', async () => {
      const timeoutConfig: MigrationConfig = {
        version: '1.0.0',
        description: 'Timeout test',
        timeout: 100 // 100ms timeout
      };
      
      const timeoutWrapper = new MigrationWrapper(timeoutConfig);
      const slowMigrationFn = jest.fn(() => 
        new Promise(resolve => setTimeout(resolve, 200))
      );
      
      const result = await timeoutWrapper.execute(slowMigrationFn);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toContain('timeout');
    });

    test('validates migration function', async () => {
      const result = await wrapper.execute(null as any);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toContain('Migration function is required');
    });

    test('prevents concurrent executions', async () => {
      const slowMigrationFn = jest.fn(() => 
        new Promise(resolve => setTimeout(resolve, 50))
      );
      
      const promise1 = wrapper.execute(slowMigrationFn);
      const promise2 = wrapper.execute(slowMigrationFn);
      
      const [result1, result2] = await Promise.all([promise1, promise2]);
      
      expect(slowMigrationFn).toHaveBeenCalledTimes(1);
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(false);
      expect(result2.error?.message).toContain('already in progress');
    });
  });

  describe('rollback', () => {
    test('executes rollback successfully when rollbackable', async () => {
      const rollbackableConfig: MigrationConfig = {
        version: '1.0.0',
        description: 'Rollbackable migration',
        rollbackable: true
      };
      
      const rollbackableWrapper = new MigrationWrapper(rollbackableConfig);
      const mockRollbackFn = jest.fn().mockResolvedValue('rolled back');
      
      const result = await rollbackableWrapper.rollback(mockRollbackFn);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('rolled back');
      expect(mockRollbackFn).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting rollback: Rollbackable migration (v1.0.0)'
      );
    });

    test('rejects rollback for non-rollbackable migrations', async () => {
      const nonRollbackableConfig: MigrationConfig = {
        version: '1.0.0',
        description: 'Non-rollbackable migration',
        rollbackable: false
      };
      
      const nonRollbackableWrapper = new MigrationWrapper(nonRollbackableConfig);
      const mockRollbackFn = jest.fn();
      
      const result = await nonRollbackableWrapper.rollback(mockRollbackFn);
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('not rollbackable');
      expect(mockRollbackFn).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Migration is not rollbackable')
      );
    });

    test('handles rollback failure', async () => {
      const rollbackableConfig: MigrationConfig = {
        version: '1.0.0',
        description: 'Rollbackable migration',
        rollbackable: true
      };
      
      const rollbackableWrapper = new MigrationWrapper(rollbackableConfig);
      const error = new Error('Rollback failed');
      const mockRollbackFn = jest.fn().mockRejectedValue(error);
      
      const result = await rollbackableWrapper.rollback(mockRollbackFn);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Rollback failed: Rollbackable migration (v1.0.0)',
        error
      );
    });

    test('validates rollback function', async () => {
      const rollbackableConfig: MigrationConfig = {
        version: '1.0.0',
        description: 'Rollbackable migration',
        rollbackable: true
      };
      
      const rollbackableWrapper = new MigrationWrapper(rollbackableConfig);
      const result = await rollbackableWrapper.rollback(null as any);
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Rollback function is required');
    });
  });

  describe('isDryRun', () => {
    test('returns false by default', () => {
      expect(wrapper.isDryRun()).toBe(false);
    });

    test('can be set to dry run mode', () => {
      wrapper.setDryRun(true);
      expect(wrapper.isDryRun()).toBe(true);
      
      wrapper.setDryRun(false);
      expect(wrapper.isDryRun()).toBe(false);
    });

    test('logs dry run executions', async () => {
      wrapper.setDryRun(true);
      const mockMigrationFn = jest.fn();
      
      const result = await wrapper.execute(mockMigrationFn);
      
      expect(result.success).toBe(true);
      expect(mockMigrationFn).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('DRY RUN')
      );
    });
  });

  describe('getStatus', () => {
    test('returns idle status initially', () => {
      expect(wrapper.getStatus()).toBe('idle');
    });

    test('returns running status during execution', async () => {
      const slowMigrationFn = jest.fn(() => 
        new Promise(resolve => {
          expect(wrapper.getStatus()).toBe('running');
          setTimeout(resolve, 10);
        })
      );
      
      await wrapper.execute(slowMigrationFn);
    });

    test('returns completed status after successful execution', async () => {
      const mockMigrationFn = jest.fn().mockResolvedValue('success');
      
      await wrapper.execute(mockMigrationFn);
      
      expect(wrapper.getStatus()).toBe('completed');
    });

    test('returns failed status after failed execution', async () => {
      const mockMigrationFn = jest.fn().mockRejectedValue(new Error('Failed'));
      
      await wrapper.execute(mockMigrationFn);
      
      expect(wrapper.getStatus()).toBe('failed');
    });
  });

  describe('getExecutionTime', () => {
    test('returns execution time after completion', async () => {
      const mockMigrationFn = jest.fn(() => 
        new Promise(resolve => setTimeout(resolve, 50))
      );
      
      await wrapper.execute(mockMigrationFn);
      
      const executionTime = wrapper.getExecutionTime();
      expect(executionTime).toBeGreaterThan(40); // Allow some variance
      expect(executionTime).toBeLessThan(100);
    });

    test('returns 0 before execution', () => {
      expect(wrapper.getExecutionTime()).toBe(0);
    });
  });

  describe('getConfig', () => {
    test('returns configuration object', () => {
      const config = wrapper.getConfig();
      expect(config).toEqual(mockConfig);
    });

    test('returns immutable configuration', () => {
      const config = wrapper.getConfig();
      config.version = '2.0.0'; // Try to modify
      
      const originalConfig = wrapper.getConfig();
      expect(originalConfig.version).toBe('1.0.0'); // Should remain unchanged
    });
  });
});