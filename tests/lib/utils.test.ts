import {
  cn,
  formatFileSize,
  formatRelativeTime,
  slugify,
  debounce,
  chunk,
  omit,
  sleep
} from '../../src/lib/utils';

describe('utils', () => {
  describe('cn', () => {
    test('merges classes correctly', () => {
      expect(cn('class1', 'class2')).toBe('class1 class2');
    });

    test('handles conditional classes', () => {
      expect(cn('base', true && 'conditional', false && 'hidden')).toBe('base conditional');
    });

    test('resolves tailwind conflicts', () => {
      expect(cn('px-2 px-4')).toBe('px-4');
    });

    test('handles empty inputs', () => {
      expect(cn()).toBe('');
      expect(cn('', null, undefined)).toBe('');
    });

    test('handles arrays and objects', () => {
      expect(cn(['class1', 'class2'])).toBe('class1 class2');
      expect(cn({ class1: true, class2: false })).toBe('class1');
    });
  });

  describe('formatFileSize', () => {
    test('formats bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1048576)).toBe('1 MB');
      expect(formatFileSize(1073741824)).toBe('1 GB');
    });

    test('handles decimal places', () => {
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(2621440)).toBe('2.5 MB');
    });

    test('handles large files', () => {
      expect(formatFileSize(1099511627776)).toBe('1 TB');
    });

    test('handles small files', () => {
      expect(formatFileSize(512)).toBe('512 Bytes');
    });
  });

  describe('formatRelativeTime', () => {
    const now = new Date('2023-01-01T12:00:00Z');
    
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(now);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('formats recent times', () => {
      const recent = new Date('2023-01-01T11:59:30Z');
      expect(formatRelativeTime(recent)).toBe('今');
    });

    test('formats minutes', () => {
      const minutes = new Date('2023-01-01T11:55:00Z');
      expect(formatRelativeTime(minutes)).toBe('5分前');
    });

    test('formats hours', () => {
      const hours = new Date('2023-01-01T10:00:00Z');
      expect(formatRelativeTime(hours)).toBe('2時間前');
    });

    test('formats days', () => {
      const days = new Date('2022-12-30T12:00:00Z');
      expect(formatRelativeTime(days)).toBe('2日前');
    });

    test('handles string dates', () => {
      const stringDate = '2022-12-31T12:00:00Z';
      expect(formatRelativeTime(stringDate)).toBe('1日前');
    });
  });

  describe('slugify', () => {
    test('converts text to slug', () => {
      expect(slugify('Hello World')).toBe('hello-world');
    });

    test('removes special characters', () => {
      expect(slugify('Hello, World!')).toBe('hello-world');
    });

    test('handles multiple spaces', () => {
      expect(slugify('Hello    World')).toBe('hello-world');
    });

    test('trims leading and trailing dashes', () => {
      expect(slugify('  Hello World  ')).toBe('hello-world');
    });

    test('handles underscores', () => {
      expect(slugify('hello_world_test')).toBe('hello-world-test');
    });
  });

  describe('debounce', () => {
    jest.useFakeTimers();

    test('delays function execution', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 1000);

      debouncedFn();
      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1000);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('cancels previous calls', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 1000);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      jest.advanceTimersByTime(1000);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('passes arguments correctly', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 1000);

      debouncedFn('arg1', 'arg2');
      jest.advanceTimersByTime(1000);

      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });

  describe('chunk', () => {
    test('splits array into chunks', () => {
      const array = [1, 2, 3, 4, 5];
      const result = chunk(array, 2);
      expect(result).toEqual([[1, 2], [3, 4], [5]]);
    });

    test('handles exact divisions', () => {
      const array = [1, 2, 3, 4];
      const result = chunk(array, 2);
      expect(result).toEqual([[1, 2], [3, 4]]);
    });

    test('handles empty arrays', () => {
      const result = chunk([], 2);
      expect(result).toEqual([]);
    });

    test('handles single element chunks', () => {
      const array = [1, 2, 3];
      const result = chunk(array, 1);
      expect(result).toEqual([[1], [2], [3]]);
    });
  });

  describe('omit', () => {
    test('removes specified keys', () => {
      const obj = { a: 1, b: 2, c: 3 };
      const result = omit(obj, ['b']);
      expect(result).toEqual({ a: 1, c: 3 });
    });

    test('removes multiple keys', () => {
      const obj = { a: 1, b: 2, c: 3, d: 4 };
      const result = omit(obj, ['b', 'd']);
      expect(result).toEqual({ a: 1, c: 3 });
    });

    test('handles non-existent keys', () => {
      const obj = { a: 1, b: 2 };
      const result = omit(obj, ['c'] as any);
      expect(result).toEqual({ a: 1, b: 2 });
    });

    test('does not mutate original object', () => {
      const obj = { a: 1, b: 2, c: 3 };
      const result = omit(obj, ['b']);
      expect(obj).toEqual({ a: 1, b: 2, c: 3 });
      expect(result).not.toBe(obj);
    });
  });

  describe('sleep', () => {
    jest.useFakeTimers();

    test('resolves after specified time', async () => {
      const promise = sleep(1000);
      
      jest.advanceTimersByTime(999);
      expect(promise).toEqual(expect.any(Promise));
      
      jest.advanceTimersByTime(1);
      await expect(promise).resolves.toBeUndefined();
    });
  });
});