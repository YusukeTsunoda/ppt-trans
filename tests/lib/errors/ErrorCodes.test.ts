import {
  ErrorCategory,
  ErrorCodes,
  ErrorStatusMap,
  isRetryableError,
  isUserRecoverableError,
  getErrorCategory,
  ErrorCode
} from '../../../src/lib/errors/ErrorCodes';

describe('ErrorCodes', () => {
  describe('ErrorCategory enum', () => {
    test('contains all expected categories', () => {
      expect(ErrorCategory.VALIDATION).toBe('VALIDATION');
      expect(ErrorCategory.AUTHENTICATION).toBe('AUTH');
      expect(ErrorCategory.AUTHORIZATION).toBe('AUTHZ');
      expect(ErrorCategory.NOT_FOUND).toBe('NOT_FOUND');
      expect(ErrorCategory.CONFLICT).toBe('CONFLICT');
      expect(ErrorCategory.INTERNAL).toBe('INTERNAL');
      expect(ErrorCategory.DATABASE).toBe('DATABASE');
      expect(ErrorCategory.EXTERNAL_SERVICE).toBe('EXTERNAL');
      expect(ErrorCategory.NETWORK).toBe('NETWORK');
      expect(ErrorCategory.TIMEOUT).toBe('TIMEOUT');
      expect(ErrorCategory.FILE_PROCESSING).toBe('FILE');
      expect(ErrorCategory.TRANSLATION).toBe('TRANSLATION');
      expect(ErrorCategory.RATE_LIMIT).toBe('RATE_LIMIT');
      expect(ErrorCategory.QUOTA).toBe('QUOTA');
    });
  });

  describe('ErrorCodes object', () => {
    test('contains auth error codes', () => {
      expect(ErrorCodes.AUTH_INVALID_CREDENTIALS).toBe('AUTH_001');
      expect(ErrorCodes.AUTH_TOKEN_EXPIRED).toBe('AUTH_002');
      expect(ErrorCodes.AUTH_TOKEN_INVALID).toBe('AUTH_003');
      expect(ErrorCodes.AUTH_UNAUTHORIZED).toBe('AUTH_004');
      expect(ErrorCodes.AUTH_SESSION_EXPIRED).toBe('AUTH_005');
      expect(ErrorCodes.AUTH_USER_NOT_FOUND).toBe('AUTH_006');
      expect(ErrorCodes.AUTH_ACCOUNT_LOCKED).toBe('AUTH_007');
      expect(ErrorCodes.AUTH_EMAIL_NOT_VERIFIED).toBe('AUTH_008');
    });

    test('contains validation error codes', () => {
      expect(ErrorCodes.VALIDATION_REQUIRED_FIELD).toBe('VAL_001');
      expect(ErrorCodes.VALIDATION_INVALID_FORMAT).toBe('VAL_002');
      expect(ErrorCodes.VALIDATION_INVALID_EMAIL).toBe('VAL_003');
      expect(ErrorCodes.VALIDATION_INVALID_PASSWORD).toBe('VAL_004');
      expect(ErrorCodes.VALIDATION_FIELD_TOO_LONG).toBe('VAL_005');
      expect(ErrorCodes.VALIDATION_FIELD_TOO_SHORT).toBe('VAL_006');
      expect(ErrorCodes.VALIDATION_INVALID_FILE_TYPE).toBe('VAL_007');
      expect(ErrorCodes.VALIDATION_FILE_TOO_LARGE).toBe('VAL_008');
    });

    test('contains file processing error codes', () => {
      expect(ErrorCodes.FILE_UPLOAD_FAILED).toBe('FILE_001');
      expect(ErrorCodes.FILE_NOT_FOUND).toBe('FILE_002');
      expect(ErrorCodes.FILE_PROCESSING_FAILED).toBe('FILE_003');
      expect(ErrorCodes.FILE_INVALID_FORMAT).toBe('FILE_004');
      expect(ErrorCodes.FILE_CORRUPTED).toBe('FILE_005');
      expect(ErrorCodes.FILE_TOO_MANY_SLIDES).toBe('FILE_006');
      expect(ErrorCodes.FILE_EMPTY).toBe('FILE_007');
      expect(ErrorCodes.FILE_PERMISSION_DENIED).toBe('FILE_008');
      expect(ErrorCodes.FILE_DELETE_FAILED).toBe('FILE_009');
      expect(ErrorCodes.FILE_LIST_FAILED).toBe('FILE_010');
    });

    test('contains translation error codes', () => {
      expect(ErrorCodes.TRANSLATION_FAILED).toBe('TRANS_001');
      expect(ErrorCodes.TRANSLATION_TIMEOUT).toBe('TRANS_002');
      expect(ErrorCodes.TRANSLATION_UNSUPPORTED_LANGUAGE).toBe('TRANS_003');
      expect(ErrorCodes.TRANSLATION_EMPTY_TEXT).toBe('TRANS_004');
      expect(ErrorCodes.TRANSLATION_API_ERROR).toBe('TRANS_005');
      expect(ErrorCodes.TRANSLATION_QUOTA_EXCEEDED).toBe('TRANS_006');
      expect(ErrorCodes.TRANSLATION_RATE_LIMITED).toBe('TRANS_007');
    });

    test('contains database error codes', () => {
      expect(ErrorCodes.DATABASE_CONNECTION_FAILED).toBe('DB_001');
      expect(ErrorCodes.DATABASE_QUERY_FAILED).toBe('DB_002');
      expect(ErrorCodes.DATABASE_TRANSACTION_FAILED).toBe('DB_003');
      expect(ErrorCodes.DATABASE_CONSTRAINT_VIOLATION).toBe('DB_004');
      expect(ErrorCodes.DATABASE_DEADLOCK).toBe('DB_005');
      expect(ErrorCodes.DATABASE_TIMEOUT).toBe('DB_006');
    });

    test('contains external service error codes', () => {
      expect(ErrorCodes.EXTERNAL_API_ERROR).toBe('EXT_001');
      expect(ErrorCodes.EXTERNAL_API_TIMEOUT).toBe('EXT_002');
      expect(ErrorCodes.EXTERNAL_API_RATE_LIMITED).toBe('EXT_003');
      expect(ErrorCodes.EXTERNAL_API_UNAUTHORIZED).toBe('EXT_004');
      expect(ErrorCodes.EXTERNAL_SERVICE_UNAVAILABLE).toBe('EXT_005');
    });

    test('contains network error codes', () => {
      expect(ErrorCodes.NETWORK_ERROR).toBe('NET_001');
      expect(ErrorCodes.NETWORK_TIMEOUT).toBe('NET_002');
      expect(ErrorCodes.NETWORK_CONNECTION_LOST).toBe('NET_003');
      expect(ErrorCodes.NETWORK_DNS_FAILED).toBe('NET_004');
    });

    test('contains rate limit error codes', () => {
      expect(ErrorCodes.RATE_LIMIT_EXCEEDED).toBe('RATE_001');
      expect(ErrorCodes.DAILY_QUOTA_EXCEEDED).toBe('RATE_002');
      expect(ErrorCodes.MONTHLY_QUOTA_EXCEEDED).toBe('RATE_003');
      expect(ErrorCodes.CONCURRENT_REQUEST_LIMIT).toBe('RATE_004');
    });

    test('contains security error codes', () => {
      expect(ErrorCodes.SECURITY_FILE_VALIDATION_FAILED).toBe('SEC_001');
      expect(ErrorCodes.SECURITY_CSRF_TOKEN_INVALID).toBe('SEC_002');
      expect(ErrorCodes.SECURITY_RATE_LIMIT_EXCEEDED).toBe('SEC_003');
      expect(ErrorCodes.SECURITY_XSS_DETECTED).toBe('SEC_004');
      expect(ErrorCodes.SECURITY_SQL_INJECTION_DETECTED).toBe('SEC_005');
    });

    test('contains system error codes', () => {
      expect(ErrorCodes.INTERNAL_SERVER_ERROR).toBe('SYS_001');
      expect(ErrorCodes.SERVICE_UNAVAILABLE).toBe('SYS_002');
      expect(ErrorCodes.CONFIGURATION_ERROR).toBe('SYS_003');
      expect(ErrorCodes.UNKNOWN_ERROR).toBe('SYS_999');
    });

    test('has unique error codes', () => {
      const codes = Object.values(ErrorCodes);
      const uniqueCodes = [...new Set(codes)];
      expect(codes.length).toBe(uniqueCodes.length);
    });
  });

  describe('ErrorStatusMap', () => {
    test('maps validation errors to 400', () => {
      expect(ErrorStatusMap[ErrorCodes.VALIDATION_REQUIRED_FIELD]).toBe(400);
      expect(ErrorStatusMap[ErrorCodes.VALIDATION_INVALID_FORMAT]).toBe(400);
      expect(ErrorStatusMap[ErrorCodes.VALIDATION_INVALID_EMAIL]).toBe(400);
      expect(ErrorStatusMap[ErrorCodes.VALIDATION_INVALID_PASSWORD]).toBe(400);
      expect(ErrorStatusMap[ErrorCodes.VALIDATION_FIELD_TOO_LONG]).toBe(400);
      expect(ErrorStatusMap[ErrorCodes.VALIDATION_FIELD_TOO_SHORT]).toBe(400);
      expect(ErrorStatusMap[ErrorCodes.VALIDATION_INVALID_FILE_TYPE]).toBe(400);
      expect(ErrorStatusMap[ErrorCodes.VALIDATION_FILE_TOO_LARGE]).toBe(400);
      expect(ErrorStatusMap[ErrorCodes.TRANSLATION_EMPTY_TEXT]).toBe(400);
    });

    test('maps auth token errors to 401', () => {
      expect(ErrorStatusMap[ErrorCodes.AUTH_INVALID_CREDENTIALS]).toBe(401);
      expect(ErrorStatusMap[ErrorCodes.AUTH_TOKEN_EXPIRED]).toBe(401);
      expect(ErrorStatusMap[ErrorCodes.AUTH_TOKEN_INVALID]).toBe(401);
      expect(ErrorStatusMap[ErrorCodes.AUTH_SESSION_EXPIRED]).toBe(401);
      expect(ErrorStatusMap[ErrorCodes.EXTERNAL_API_UNAUTHORIZED]).toBe(401);
    });

    test('maps authorization errors to 403', () => {
      expect(ErrorStatusMap[ErrorCodes.AUTH_UNAUTHORIZED]).toBe(403);
      expect(ErrorStatusMap[ErrorCodes.AUTH_ACCOUNT_LOCKED]).toBe(403);
      expect(ErrorStatusMap[ErrorCodes.AUTH_EMAIL_NOT_VERIFIED]).toBe(403);
      expect(ErrorStatusMap[ErrorCodes.FILE_PERMISSION_DENIED]).toBe(403);
    });

    test('maps not found errors to 404', () => {
      expect(ErrorStatusMap[ErrorCodes.AUTH_USER_NOT_FOUND]).toBe(404);
      expect(ErrorStatusMap[ErrorCodes.FILE_NOT_FOUND]).toBe(404);
    });

    test('maps conflict errors to 409', () => {
      expect(ErrorStatusMap[ErrorCodes.DATABASE_CONSTRAINT_VIOLATION]).toBe(409);
      expect(ErrorStatusMap[ErrorCodes.DATABASE_DEADLOCK]).toBe(409);
    });

    test('maps large payload errors to 413', () => {
      expect(ErrorStatusMap[ErrorCodes.FILE_TOO_MANY_SLIDES]).toBe(413);
    });

    test('maps unprocessable entity errors to 422', () => {
      expect(ErrorStatusMap[ErrorCodes.FILE_INVALID_FORMAT]).toBe(422);
      expect(ErrorStatusMap[ErrorCodes.FILE_CORRUPTED]).toBe(422);
      expect(ErrorStatusMap[ErrorCodes.FILE_EMPTY]).toBe(422);
      expect(ErrorStatusMap[ErrorCodes.TRANSLATION_UNSUPPORTED_LANGUAGE]).toBe(422);
      expect(ErrorStatusMap[ErrorCodes.SECURITY_FILE_VALIDATION_FAILED]).toBe(422);
      expect(ErrorStatusMap[ErrorCodes.SECURITY_CSRF_TOKEN_INVALID]).toBe(422);
      expect(ErrorStatusMap[ErrorCodes.SECURITY_XSS_DETECTED]).toBe(422);
      expect(ErrorStatusMap[ErrorCodes.SECURITY_SQL_INJECTION_DETECTED]).toBe(422);
    });

    test('maps rate limit errors to 429', () => {
      expect(ErrorStatusMap[ErrorCodes.RATE_LIMIT_EXCEEDED]).toBe(429);
      expect(ErrorStatusMap[ErrorCodes.DAILY_QUOTA_EXCEEDED]).toBe(429);
      expect(ErrorStatusMap[ErrorCodes.MONTHLY_QUOTA_EXCEEDED]).toBe(429);
      expect(ErrorStatusMap[ErrorCodes.CONCURRENT_REQUEST_LIMIT]).toBe(429);
      expect(ErrorStatusMap[ErrorCodes.TRANSLATION_RATE_LIMITED]).toBe(429);
      expect(ErrorStatusMap[ErrorCodes.EXTERNAL_API_RATE_LIMITED]).toBe(429);
      expect(ErrorStatusMap[ErrorCodes.SECURITY_RATE_LIMIT_EXCEEDED]).toBe(429);
    });

    test('maps server errors to 500', () => {
      expect(ErrorStatusMap[ErrorCodes.INTERNAL_SERVER_ERROR]).toBe(500);
      expect(ErrorStatusMap[ErrorCodes.FILE_UPLOAD_FAILED]).toBe(500);
      expect(ErrorStatusMap[ErrorCodes.FILE_PROCESSING_FAILED]).toBe(500);
      expect(ErrorStatusMap[ErrorCodes.TRANSLATION_FAILED]).toBe(500);
      expect(ErrorStatusMap[ErrorCodes.DATABASE_CONNECTION_FAILED]).toBe(500);
      expect(ErrorStatusMap[ErrorCodes.DATABASE_QUERY_FAILED]).toBe(500);
      expect(ErrorStatusMap[ErrorCodes.DATABASE_TRANSACTION_FAILED]).toBe(500);
      expect(ErrorStatusMap[ErrorCodes.EXTERNAL_API_ERROR]).toBe(500);
      expect(ErrorStatusMap[ErrorCodes.NETWORK_ERROR]).toBe(500);
      expect(ErrorStatusMap[ErrorCodes.CONFIGURATION_ERROR]).toBe(500);
      expect(ErrorStatusMap[ErrorCodes.UNKNOWN_ERROR]).toBe(500);
      expect(ErrorStatusMap[ErrorCodes.TRANSLATION_API_ERROR]).toBe(500);
    });

    test('maps DNS errors to 502', () => {
      expect(ErrorStatusMap[ErrorCodes.NETWORK_DNS_FAILED]).toBe(502);
    });

    test('maps service unavailable errors to 503', () => {
      expect(ErrorStatusMap[ErrorCodes.SERVICE_UNAVAILABLE]).toBe(503);
      expect(ErrorStatusMap[ErrorCodes.EXTERNAL_SERVICE_UNAVAILABLE]).toBe(503);
      expect(ErrorStatusMap[ErrorCodes.NETWORK_CONNECTION_LOST]).toBe(503);
    });

    test('maps timeout errors to 504', () => {
      expect(ErrorStatusMap[ErrorCodes.TRANSLATION_TIMEOUT]).toBe(504);
      expect(ErrorStatusMap[ErrorCodes.DATABASE_TIMEOUT]).toBe(504);
      expect(ErrorStatusMap[ErrorCodes.EXTERNAL_API_TIMEOUT]).toBe(504);
      expect(ErrorStatusMap[ErrorCodes.NETWORK_TIMEOUT]).toBe(504);
    });

    test('maps storage errors to 507', () => {
      expect(ErrorStatusMap[ErrorCodes.TRANSLATION_QUOTA_EXCEEDED]).toBe(507);
    });

    test('contains mapping for all error codes', () => {
      const allErrorCodes = Object.values(ErrorCodes);
      const mappedCodes = Object.keys(ErrorStatusMap);
      
      expect(mappedCodes.length).toBe(allErrorCodes.length);
      
      for (const code of allErrorCodes) {
        expect(ErrorStatusMap).toHaveProperty(code);
        expect(typeof ErrorStatusMap[code as ErrorCode]).toBe('number');
        expect(ErrorStatusMap[code as ErrorCode]).toBeGreaterThanOrEqual(400);
        expect(ErrorStatusMap[code as ErrorCode]).toBeLessThan(600);
      }
    });
  });

  describe('isRetryableError', () => {
    test('returns true for network errors', () => {
      expect(isRetryableError(ErrorCodes.NETWORK_ERROR)).toBe(true);
      expect(isRetryableError(ErrorCodes.NETWORK_TIMEOUT)).toBe(true);
      expect(isRetryableError(ErrorCodes.NETWORK_CONNECTION_LOST)).toBe(true);
    });

    test('returns true for timeout errors', () => {
      expect(isRetryableError(ErrorCodes.DATABASE_TIMEOUT)).toBe(true);
      expect(isRetryableError(ErrorCodes.EXTERNAL_API_TIMEOUT)).toBe(true);
      expect(isRetryableError(ErrorCodes.TRANSLATION_TIMEOUT)).toBe(true);
    });

    test('returns true for service unavailable errors', () => {
      expect(isRetryableError(ErrorCodes.SERVICE_UNAVAILABLE)).toBe(true);
      expect(isRetryableError(ErrorCodes.EXTERNAL_SERVICE_UNAVAILABLE)).toBe(true);
    });

    test('returns true for deadlock errors', () => {
      expect(isRetryableError(ErrorCodes.DATABASE_DEADLOCK)).toBe(true);
    });

    test('returns false for validation errors', () => {
      expect(isRetryableError(ErrorCodes.VALIDATION_REQUIRED_FIELD)).toBe(false);
      expect(isRetryableError(ErrorCodes.VALIDATION_INVALID_FORMAT)).toBe(false);
      expect(isRetryableError(ErrorCodes.VALIDATION_INVALID_EMAIL)).toBe(false);
    });

    test('returns false for authentication errors', () => {
      expect(isRetryableError(ErrorCodes.AUTH_INVALID_CREDENTIALS)).toBe(false);
      expect(isRetryableError(ErrorCodes.AUTH_UNAUTHORIZED)).toBe(false);
      expect(isRetryableError(ErrorCodes.AUTH_TOKEN_EXPIRED)).toBe(false);
    });

    test('returns false for file processing errors', () => {
      expect(isRetryableError(ErrorCodes.FILE_INVALID_FORMAT)).toBe(false);
      expect(isRetryableError(ErrorCodes.FILE_CORRUPTED)).toBe(false);
      expect(isRetryableError(ErrorCodes.FILE_NOT_FOUND)).toBe(false);
    });

    test('returns false for rate limit errors', () => {
      expect(isRetryableError(ErrorCodes.RATE_LIMIT_EXCEEDED)).toBe(false);
      expect(isRetryableError(ErrorCodes.DAILY_QUOTA_EXCEEDED)).toBe(false);
    });
  });

  describe('isUserRecoverableError', () => {
    test('returns true for validation errors', () => {
      expect(isUserRecoverableError(ErrorCodes.VALIDATION_REQUIRED_FIELD)).toBe(true);
      expect(isUserRecoverableError(ErrorCodes.VALIDATION_INVALID_FORMAT)).toBe(true);
      expect(isUserRecoverableError(ErrorCodes.VALIDATION_INVALID_EMAIL)).toBe(true);
      expect(isUserRecoverableError(ErrorCodes.VALIDATION_INVALID_PASSWORD)).toBe(true);
      expect(isUserRecoverableError(ErrorCodes.VALIDATION_FIELD_TOO_LONG)).toBe(true);
      expect(isUserRecoverableError(ErrorCodes.VALIDATION_FIELD_TOO_SHORT)).toBe(true);
      expect(isUserRecoverableError(ErrorCodes.VALIDATION_INVALID_FILE_TYPE)).toBe(true);
      expect(isUserRecoverableError(ErrorCodes.VALIDATION_FILE_TOO_LARGE)).toBe(true);
    });

    test('returns true for credential errors', () => {
      expect(isUserRecoverableError(ErrorCodes.AUTH_INVALID_CREDENTIALS)).toBe(true);
    });

    test('returns true for file format errors', () => {
      expect(isUserRecoverableError(ErrorCodes.FILE_INVALID_FORMAT)).toBe(true);
      expect(isUserRecoverableError(ErrorCodes.FILE_TOO_MANY_SLIDES)).toBe(true);
      expect(isUserRecoverableError(ErrorCodes.FILE_EMPTY)).toBe(true);
    });

    test('returns true for translation errors', () => {
      expect(isUserRecoverableError(ErrorCodes.TRANSLATION_EMPTY_TEXT)).toBe(true);
      expect(isUserRecoverableError(ErrorCodes.TRANSLATION_UNSUPPORTED_LANGUAGE)).toBe(true);
    });

    test('returns false for system errors', () => {
      expect(isUserRecoverableError(ErrorCodes.INTERNAL_SERVER_ERROR)).toBe(false);
      expect(isUserRecoverableError(ErrorCodes.DATABASE_CONNECTION_FAILED)).toBe(false);
      expect(isUserRecoverableError(ErrorCodes.NETWORK_ERROR)).toBe(false);
    });

    test('returns false for authorization errors', () => {
      expect(isUserRecoverableError(ErrorCodes.AUTH_UNAUTHORIZED)).toBe(false);
      expect(isUserRecoverableError(ErrorCodes.AUTH_ACCOUNT_LOCKED)).toBe(false);
      expect(isUserRecoverableError(ErrorCodes.FILE_PERMISSION_DENIED)).toBe(false);
    });

    test('returns false for quota errors', () => {
      expect(isUserRecoverableError(ErrorCodes.RATE_LIMIT_EXCEEDED)).toBe(false);
      expect(isUserRecoverableError(ErrorCodes.DAILY_QUOTA_EXCEEDED)).toBe(false);
      expect(isUserRecoverableError(ErrorCodes.TRANSLATION_QUOTA_EXCEEDED)).toBe(false);
    });
  });

  describe('getErrorCategory', () => {
    test('categorizes auth errors correctly', () => {
      expect(getErrorCategory(ErrorCodes.AUTH_INVALID_CREDENTIALS)).toBe(ErrorCategory.AUTHENTICATION);
      expect(getErrorCategory(ErrorCodes.AUTH_TOKEN_EXPIRED)).toBe(ErrorCategory.AUTHENTICATION);
      expect(getErrorCategory(ErrorCodes.AUTH_UNAUTHORIZED)).toBe(ErrorCategory.AUTHENTICATION);
    });

    test('categorizes validation errors correctly', () => {
      expect(getErrorCategory(ErrorCodes.VALIDATION_REQUIRED_FIELD)).toBe(ErrorCategory.VALIDATION);
      expect(getErrorCategory(ErrorCodes.VALIDATION_INVALID_FORMAT)).toBe(ErrorCategory.VALIDATION);
      expect(getErrorCategory(ErrorCodes.VALIDATION_INVALID_EMAIL)).toBe(ErrorCategory.VALIDATION);
    });

    test('categorizes file errors correctly', () => {
      expect(getErrorCategory(ErrorCodes.FILE_UPLOAD_FAILED)).toBe(ErrorCategory.FILE_PROCESSING);
      expect(getErrorCategory(ErrorCodes.FILE_NOT_FOUND)).toBe(ErrorCategory.FILE_PROCESSING);
      expect(getErrorCategory(ErrorCodes.FILE_PROCESSING_FAILED)).toBe(ErrorCategory.FILE_PROCESSING);
    });

    test('categorizes translation errors correctly', () => {
      expect(getErrorCategory(ErrorCodes.TRANSLATION_FAILED)).toBe(ErrorCategory.TRANSLATION);
      expect(getErrorCategory(ErrorCodes.TRANSLATION_TIMEOUT)).toBe(ErrorCategory.TRANSLATION);
      expect(getErrorCategory(ErrorCodes.TRANSLATION_API_ERROR)).toBe(ErrorCategory.TRANSLATION);
    });

    test('categorizes database errors correctly', () => {
      expect(getErrorCategory(ErrorCodes.DATABASE_CONNECTION_FAILED)).toBe(ErrorCategory.DATABASE);
      expect(getErrorCategory(ErrorCodes.DATABASE_QUERY_FAILED)).toBe(ErrorCategory.DATABASE);
      expect(getErrorCategory(ErrorCodes.DATABASE_TIMEOUT)).toBe(ErrorCategory.DATABASE);
    });

    test('categorizes external service errors correctly', () => {
      expect(getErrorCategory(ErrorCodes.EXTERNAL_API_ERROR)).toBe(ErrorCategory.EXTERNAL_SERVICE);
      expect(getErrorCategory(ErrorCodes.EXTERNAL_API_TIMEOUT)).toBe(ErrorCategory.EXTERNAL_SERVICE);
      expect(getErrorCategory(ErrorCodes.EXTERNAL_SERVICE_UNAVAILABLE)).toBe(ErrorCategory.EXTERNAL_SERVICE);
    });

    test('categorizes network errors correctly', () => {
      expect(getErrorCategory(ErrorCodes.NETWORK_ERROR)).toBe(ErrorCategory.NETWORK);
      expect(getErrorCategory(ErrorCodes.NETWORK_TIMEOUT)).toBe(ErrorCategory.NETWORK);
      expect(getErrorCategory(ErrorCodes.NETWORK_CONNECTION_LOST)).toBe(ErrorCategory.NETWORK);
    });

    test('categorizes rate limit errors correctly', () => {
      expect(getErrorCategory(ErrorCodes.RATE_LIMIT_EXCEEDED)).toBe(ErrorCategory.RATE_LIMIT);
      expect(getErrorCategory(ErrorCodes.DAILY_QUOTA_EXCEEDED)).toBe(ErrorCategory.RATE_LIMIT);
      expect(getErrorCategory(ErrorCodes.MONTHLY_QUOTA_EXCEEDED)).toBe(ErrorCategory.RATE_LIMIT);
    });

    test('categorizes security errors as validation', () => {
      expect(getErrorCategory(ErrorCodes.SECURITY_FILE_VALIDATION_FAILED)).toBe(ErrorCategory.VALIDATION);
      expect(getErrorCategory(ErrorCodes.SECURITY_CSRF_TOKEN_INVALID)).toBe(ErrorCategory.VALIDATION);
      expect(getErrorCategory(ErrorCodes.SECURITY_XSS_DETECTED)).toBe(ErrorCategory.VALIDATION);
    });

    test('categorizes system errors correctly', () => {
      expect(getErrorCategory(ErrorCodes.INTERNAL_SERVER_ERROR)).toBe(ErrorCategory.INTERNAL);
      expect(getErrorCategory(ErrorCodes.SERVICE_UNAVAILABLE)).toBe(ErrorCategory.INTERNAL);
      expect(getErrorCategory(ErrorCodes.CONFIGURATION_ERROR)).toBe(ErrorCategory.INTERNAL);
      expect(getErrorCategory(ErrorCodes.UNKNOWN_ERROR)).toBe(ErrorCategory.INTERNAL);
    });

    test('defaults to internal for unknown prefixes', () => {
      expect(getErrorCategory('UNKNOWN_PREFIX_001' as ErrorCode)).toBe(ErrorCategory.INTERNAL);
    });
  });

  describe('type safety', () => {
    test('ErrorCode type includes all error codes', () => {
      // This test ensures that the ErrorCode type is properly derived
      const testCode: ErrorCode = ErrorCodes.AUTH_INVALID_CREDENTIALS;
      expect(typeof testCode).toBe('string');
      expect(testCode).toBe('AUTH_001');
    });

    test('ErrorStatusMap keys match ErrorCodes values', () => {
      // Ensure type consistency between ErrorCodes and ErrorStatusMap
      const errorCodes = Object.values(ErrorCodes);
      const statusMapKeys = Object.keys(ErrorStatusMap);
      
      expect(statusMapKeys.sort()).toEqual(errorCodes.sort());
    });
  });
});