import { withTimeout, TimeoutError, calculateUploadTimeout } from '../timeout';

describe('Timeout Utilities', () => {
  describe('withTimeout', () => {
    beforeEach(() => {
      jest.clearAllTimers();
      jest.useRealTimers();
    });

    it('should resolve with the promise result when it completes before timeout', async () => {
      const promise = new Promise<string>((resolve) => {
        setTimeout(() => resolve('success'), 100);
      });
      
      const result = await withTimeout(promise, 1000, 'Timeout message');
      expect(result).toBe('success');
    });

    it('should throw TimeoutError when promise exceeds timeout', async () => {
      const promise = new Promise<string>((resolve) => {
        setTimeout(() => resolve('success'), 1000);
      });
      
      await expect(withTimeout(promise, 100, 'Custom timeout message'))
        .rejects
        .toThrow(TimeoutError);
    });

    it('should clean up timeout when promise resolves', async () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      const promise = Promise.resolve('immediate');
      
      await withTimeout(promise, 1000);
      expect(clearTimeoutSpy).toHaveBeenCalled();
      
      clearTimeoutSpy.mockRestore();
    });

    it('should clean up timeout when promise rejects', async () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      const promise = Promise.reject(new Error('test error'));
      
      await expect(withTimeout(promise, 1000)).rejects.toThrow('test error');
      expect(clearTimeoutSpy).toHaveBeenCalled();
      
      clearTimeoutSpy.mockRestore();
    });

    it('should use custom timeout message', async () => {
      const promise = new Promise(() => {}); // Never resolves
      const customMessage = 'カスタムタイムアウトメッセージ';
      
      await expect(withTimeout(promise, 100, customMessage))
        .rejects
        .toThrow(customMessage);
    });
  });

  describe('calculateUploadTimeout', () => {
    it('should return minimum timeout for small files', () => {
      const timeout = calculateUploadTimeout(1024); // 1KB
      expect(timeout).toBe(30000); // 30 seconds minimum
    });

    it('should return maximum timeout for very large files', () => {
      const timeout = calculateUploadTimeout(1024 * 1024 * 1024); // 1GB
      expect(timeout).toBe(300000); // 5 minutes maximum
    });

    it('should calculate proportional timeout for medium files', () => {
      const fileSizeBytes = 10 * 1024 * 1024; // 10MB
      const timeout = calculateUploadTimeout(fileSizeBytes);
      
      // (10MB / 100KB/s) * 1000ms * 2 ≈ 209715.2ms
      expect(timeout).toBeCloseTo(209715.2, 0);
    });

    it('should handle zero size', () => {
      const timeout = calculateUploadTimeout(0);
      expect(timeout).toBe(30000); // minimum timeout
    });

    it('should handle negative values gracefully', () => {
      const timeout = calculateUploadTimeout(-1000);
      expect(timeout).toBe(30000); // minimum timeout
    });
  });

  describe('TimeoutError', () => {
    it('should be an instance of Error', () => {
      const error = new TimeoutError();
      expect(error).toBeInstanceOf(Error);
    });

    it('should have correct name', () => {
      const error = new TimeoutError();
      expect(error.name).toBe('TimeoutError');
    });

    it('should use default message when not provided', () => {
      const error = new TimeoutError();
      expect(error.message).toBe('リクエストがタイムアウトしました');
    });

    it('should use custom message when provided', () => {
      const customMessage = 'Custom error message';
      const error = new TimeoutError(customMessage);
      expect(error.message).toBe(customMessage);
    });
  });
});