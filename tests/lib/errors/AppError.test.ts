import { AppError, normalizeError } from '../../../src/lib/errors/AppError';

describe('AppError', () => {
  describe('constructor', () => {
    test('creates error with all parameters', () => {
      const details = { userId: 'user-123', action: 'upload' };
      const error = new AppError(
        'Test error message',
        'TEST_ERROR',
        400,
        true,
        'User friendly message',
        details
      );

      expect(error.message).toBe('Test error message');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
      expect(error.userMessage).toBe('User friendly message');
      expect(error.details).toBe(details);
      expect(error.metadata).toBe(details); // Should be alias for details
      expect(error.timestamp).toBeInstanceOf(Date);
      expect(error.name).toBe('AppError');
    });

    test('creates error with minimal parameters', () => {
      const error = new AppError('Test error', 'TEST_ERROR');

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.statusCode).toBe(500); // Default
      expect(error.isOperational).toBe(true); // Default
      expect(error.userMessage).toBe('Test error'); // Defaults to message
      expect(error.details).toBeUndefined();
      expect(error.metadata).toBeUndefined();
    });

    test('sets custom user message when provided', () => {
      const error = new AppError(
        'Internal error message',
        'INTERNAL_ERROR',
        500,
        true,
        'Something went wrong'
      );

      expect(error.message).toBe('Internal error message');
      expect(error.userMessage).toBe('Something went wrong');
    });

    test('captures stack trace', () => {
      const error = new AppError('Test error', 'TEST_ERROR');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AppError');
    });

    test('handles different detail types', () => {
      const stringDetails = 'String details';
      const objectDetails = { key: 'value' };
      const arrayDetails = [1, 2, 3];

      const stringError = new AppError('Test', 'TEST', 400, true, 'Message', stringDetails);
      const objectError = new AppError('Test', 'TEST', 400, true, 'Message', objectDetails);
      const arrayError = new AppError('Test', 'TEST', 400, true, 'Message', arrayDetails);

      expect(stringError.details).toBe(stringDetails);
      expect(objectError.details).toEqual(objectDetails);
      expect(arrayError.details).toEqual(arrayDetails);
    });
  });

  describe('isRetryable', () => {
    test('returns true for network errors', () => {
      const networkError = new AppError('Network failed', 'NETWORK_ERROR', 500);
      expect(networkError.isRetryable()).toBe(true);
    });

    test('returns true for timeout errors', () => {
      const timeoutError = new AppError('Request timeout', 'REQUEST_TIMEOUT', 408);
      expect(timeoutError.isRetryable()).toBe(true);
    });

    test('returns true for 5xx status codes', () => {
      const serverError = new AppError('Server error', 'SERVER_ERROR', 500);
      const badGateway = new AppError('Bad gateway', 'BAD_GATEWAY', 502);
      const serviceUnavailable = new AppError('Service unavailable', 'SERVICE_UNAVAILABLE', 503);

      expect(serverError.isRetryable()).toBe(true);
      expect(badGateway.isRetryable()).toBe(true);
      expect(serviceUnavailable.isRetryable()).toBe(true);
    });

    test('returns false for client errors', () => {
      const badRequest = new AppError('Bad request', 'BAD_REQUEST', 400);
      const unauthorized = new AppError('Unauthorized', 'UNAUTHORIZED', 401);
      const notFound = new AppError('Not found', 'NOT_FOUND', 404);

      expect(badRequest.isRetryable()).toBe(false);
      expect(unauthorized.isRetryable()).toBe(false);
      expect(notFound.isRetryable()).toBe(false);
    });

    test('returns false for non-retryable business logic errors', () => {
      const validationError = new AppError('Invalid input', 'VALIDATION_ERROR', 400);
      expect(validationError.isRetryable()).toBe(false);
    });

    test('handles edge cases', () => {
      const edgeCase1 = new AppError('Error', 'NETWORK_FAILURE', 400); // Network error but 4xx
      const edgeCase2 = new AppError('Error', 'CONNECTION_TIMEOUT', 200); // Timeout but 2xx

      expect(edgeCase1.isRetryable()).toBe(true); // Should be true due to NETWORK
      expect(edgeCase2.isRetryable()).toBe(true); // Should be true due to TIMEOUT
    });
  });

  describe('toLogObject', () => {
    test('returns complete log object', () => {
      const details = { userId: 'user-123' };
      const error = new AppError(
        'Test error',
        'TEST_ERROR',
        400,
        true,
        'User message',
        details
      );

      const logObject = error.toLogObject();

      expect(logObject).toEqual({
        name: 'AppError',
        message: 'Test error',
        code: 'TEST_ERROR',
        statusCode: 400,
        isOperational: true,
        timestamp: expect.any(Date),
        stack: expect.any(String),
        details: details
      });
    });

    test('handles error without details', () => {
      const error = new AppError('Simple error', 'SIMPLE_ERROR');
      const logObject = error.toLogObject();

      expect(logObject.details).toBeUndefined();
      expect(logObject).toHaveProperty('name');
      expect(logObject).toHaveProperty('message');
      expect(logObject).toHaveProperty('code');
    });

    test('includes stack trace', () => {
      const error = new AppError('Error with stack', 'STACK_ERROR');
      const logObject = error.toLogObject();

      expect(logObject.stack).toBeDefined();
      expect(typeof logObject.stack).toBe('string');
      expect(logObject.stack).toContain('AppError');
    });
  });

  describe('toClientResponse', () => {
    const originalEnv = process.env;

    afterEach(() => {
      process.env = originalEnv;
    });

    test('returns basic client response in production', () => {
      (process.env as any).NODE_ENV = 'production';

      const details = { sensitive: 'data' };
      const error = new AppError(
        'Internal error',
        'INTERNAL_ERROR',
        500,
        true,
        'Something went wrong',
        details
      );

      const clientResponse = error.toClientResponse();

      expect(clientResponse).toEqual({
        error: 'Something went wrong',
        code: 'INTERNAL_ERROR',
        timestamp: expect.any(Date)
      });

      // Should not include sensitive details in production
      expect(clientResponse).not.toHaveProperty('details');
      expect(clientResponse).not.toHaveProperty('stack');
    });

    test('includes debug information in development', () => {
      (process.env as any).NODE_ENV = 'development';

      const details = { debug: 'info' };
      const error = new AppError(
        'Debug error',
        'DEBUG_ERROR',
        400,
        true,
        'Debug message',
        details
      );

      const clientResponse = error.toClientResponse();

      expect(clientResponse).toEqual({
        error: 'Debug message',
        code: 'DEBUG_ERROR',
        timestamp: expect.any(Date),
        details: details,
        stack: expect.any(String)
      });
    });

    test('includes debug information in test environment', () => {
      (process.env as any).NODE_ENV = 'test';

      const error = new AppError('Test error', 'TEST_ERROR');
      const clientResponse = error.toClientResponse();

      // Test environment should not include debug info by default
      expect(clientResponse).not.toHaveProperty('details');
      expect(clientResponse).not.toHaveProperty('stack');
    });

    test('handles missing userMessage gracefully', () => {
      const error = new AppError('Internal message', 'INTERNAL');
      const clientResponse = error.toClientResponse();

      expect(clientResponse.error).toBe('Internal message'); // Falls back to message
    });
  });

  describe('inheritance and instanceof', () => {
    test('is instance of Error', () => {
      const error = new AppError('Test', 'TEST');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });

    test('can be caught as Error', () => {
      expect(() => {
        throw new AppError('Test error', 'TEST');
      }).toThrow(Error);
    });

    test('can be caught as AppError', () => {
      expect(() => {
        throw new AppError('Test error', 'TEST');
      }).toThrow(AppError);
    });
  });
});

describe('normalizeError', () => {
  test('returns AppError as-is', () => {
    const appError = new AppError('App error', 'APP_ERROR', 400);
    const result = normalizeError(appError);

    expect(result).toBe(appError); // Should be the same instance
  });

  test('converts Error to AppError', () => {
    const genericError = new Error('Generic error message');
    const result = normalizeError(genericError);

    expect(result).toBeInstanceOf(AppError);
    expect(result.message).toBe('Generic error message');
    expect(result.code).toBe('UNKNOWN_ERROR');
    expect(result.statusCode).toBe(500);
    expect(result.isOperational).toBe(false);
    expect(result.userMessage).toBe('システムエラーが発生しました');
  });

  test('converts string to AppError', () => {
    const stringError = 'String error message';
    const result = normalizeError(stringError);

    expect(result).toBeInstanceOf(AppError);
    expect(result.message).toBe('String error message');
    expect(result.code).toBe('UNKNOWN_ERROR');
    expect(result.statusCode).toBe(500);
    expect(result.isOperational).toBe(false);
    expect(result.userMessage).toBe('システムエラーが発生しました');
  });

  test('converts number to AppError', () => {
    const numberError = 404;
    const result = normalizeError(numberError);

    expect(result).toBeInstanceOf(AppError);
    expect(result.message).toBe('404');
    expect(result.code).toBe('UNKNOWN_ERROR');
  });

  test('converts object to AppError', () => {
    const objectError = { message: 'Object error', code: 500 };
    const result = normalizeError(objectError);

    expect(result).toBeInstanceOf(AppError);
    expect(result.message).toBe(JSON.stringify(objectError));
    expect(result.code).toBe('UNKNOWN_ERROR');
  });

  test('converts null to AppError', () => {
    const result = normalizeError(null);

    expect(result).toBeInstanceOf(AppError);
    expect(result.message).toBe('null');
    expect(result.code).toBe('UNKNOWN_ERROR');
  });

  test('converts undefined to AppError', () => {
    const result = normalizeError(undefined);

    expect(result).toBeInstanceOf(AppError);
    expect(result.message).toBe('undefined');
    expect(result.code).toBe('UNKNOWN_ERROR');
  });

  test('preserves Error subclass information', () => {
    class CustomError extends Error {
      constructor(message: string, public customProperty: string) {
        super(message);
      }
    }

    const customError = new CustomError('Custom message', 'custom value');
    const result = normalizeError(customError);

    expect(result).toBeInstanceOf(AppError);
    expect(result.message).toBe('Custom message');
    expect(result.code).toBe('UNKNOWN_ERROR');
    expect(result.isOperational).toBe(false);
  });
});