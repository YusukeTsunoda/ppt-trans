import {
  downloadFile,
  downloadMultipleFiles,
  isDownloadable
} from '../../src/lib/downloadUtils';
import logger from '../../src/lib/logger';

// Mock dependencies
jest.mock('../../src/lib/logger', () => ({
  debug: jest.fn(),
  error: jest.fn()
}));

// Mock DOM APIs
Object.defineProperty(window, 'URL', {
  value: {
    createObjectURL: jest.fn(() => 'mock-blob-url'),
    revokeObjectURL: jest.fn()
  }
});

// Mock fetch
global.fetch = jest.fn();

describe('downloadUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
  });

  describe('downloadFile', () => {
    test('downloads file successfully with direct link', async () => {
      const mockCreateElement = jest.spyOn(document, 'createElement');
      const mockAppendChild = jest.spyOn(document.body, 'appendChild');
      const mockRemoveChild = jest.spyOn(document.body, 'removeChild');
      
      const mockAnchor = {
        href: '',
        download: '',
        style: { display: '' },
        target: '',
        rel: '',
        click: jest.fn()
      } as any;

      mockCreateElement.mockReturnValue(mockAnchor);
      mockAppendChild.mockImplementation(() => mockAnchor);
      mockRemoveChild.mockImplementation(() => mockAnchor);

      const result = await downloadFile({
        url: 'https://example.com/file.pptx',
        fileName: 'test.pptx'
      });

      expect(result).toBe(true);
      expect(mockAnchor.href).toBe('https://example.com/file.pptx');
      expect(mockAnchor.download).toBe('test.pptx');
      expect(mockAnchor.click).toHaveBeenCalled();
    });

    test('adds .pptx extension if missing', async () => {
      const mockCreateElement = jest.spyOn(document, 'createElement');
      const mockAnchor = {
        href: '',
        download: '',
        style: { display: '' },
        target: '',
        rel: '',
        click: jest.fn()
      } as any;

      mockCreateElement.mockReturnValue(mockAnchor);

      await downloadFile({
        url: 'https://example.com/file',
        fileName: 'test'
      });

      expect(mockAnchor.download).toBe('test.pptx');
    });

    test('handles Supabase URLs with fetch', async () => {
      const mockBlob = new Blob(['test content'], { type: 'application/octet-stream' });
      const mockResponse = {
        ok: true,
        blob: () => Promise.resolve(mockBlob)
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const mockCreateElement = jest.spyOn(document, 'createElement');
      const mockAnchor = {
        href: '',
        download: '',
        style: { display: '' },
        click: jest.fn()
      } as any;

      mockCreateElement.mockReturnValue(mockAnchor);

      const result = await downloadFile({
        url: 'https://project.supabase.co/storage/file.pptx',
        fileName: 'test.pptx'
      });

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://project.supabase.co/storage/file.pptx',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Accept': 'application/vnd.openxmlformats-officedocument.presentationml.presentation, application/octet-stream'
          })
        })
      );
    });

    test('handles progress tracking', async () => {
      const mockOnProgress = jest.fn();
      const chunks = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])];
      
      const mockReader = {
        read: jest.fn()
          .mockResolvedValueOnce({ done: false, value: chunks[0] })
          .mockResolvedValueOnce({ done: false, value: chunks[1] })
          .mockResolvedValueOnce({ done: true, value: undefined })
      };

      const mockResponse = {
        ok: true,
        headers: {
          get: (header: string) => header === 'content-length' ? '6' : null
        },
        body: {
          getReader: () => mockReader
        }
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const mockCreateElement = jest.spyOn(document, 'createElement');
      const mockAnchor = { href: '', download: '', style: { display: '' }, click: jest.fn() } as any;
      mockCreateElement.mockReturnValue(mockAnchor);

      const result = await downloadFile({
        url: 'https://project.supabase.co/storage/file.pptx',
        fileName: 'test.pptx',
        onProgress: mockOnProgress
      });

      expect(result).toBe(true);
      expect(mockOnProgress).toHaveBeenCalledWith(0.5); // 3/6
      expect(mockOnProgress).toHaveBeenCalledWith(1); // 6/6
    });

    test('calls onError when download fails', async () => {
      const mockOnError = jest.fn();
      const mockError = new Error('Network error');

      (global.fetch as jest.Mock).mockRejectedValue(mockError);
      
      const mockCreateElement = jest.spyOn(document, 'createElement');
      mockCreateElement.mockImplementation(() => {
        throw new Error('DOM error');
      });

      const result = await downloadFile({
        url: 'https://example.com/file.pptx',
        fileName: 'test.pptx',
        onError: mockOnError
      });

      expect(result).toBe(false);
      expect(mockOnError).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('downloadMultipleFiles', () => {
    test('downloads multiple files successfully', async () => {
      const mockOnProgress = jest.fn();
      
      const mockCreateElement = jest.spyOn(document, 'createElement');
      const mockAnchor = { href: '', download: '', style: { display: '' }, click: jest.fn() } as any;
      mockCreateElement.mockReturnValue(mockAnchor);

      const files = [
        { url: 'https://example.com/file1.pptx', fileName: 'file1.pptx' },
        { url: 'https://example.com/file2.pptx', fileName: 'file2.pptx' }
      ];

      const result = await downloadMultipleFiles(files, mockOnProgress);

      expect(result.successful).toEqual(['file1.pptx', 'file2.pptx']);
      expect(result.failed).toEqual([]);
      expect(mockOnProgress).toHaveBeenCalledWith(1, 2);
      expect(mockOnProgress).toHaveBeenCalledWith(2, 2);
    });

    test('handles mixed success and failure', async () => {
      const mockCreateElement = jest.spyOn(document, 'createElement');
      
      // First call succeeds, second fails
      let callCount = 0;
      mockCreateElement.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { href: '', download: '', style: { display: '' }, click: jest.fn() } as any;
        } else {
          throw new Error('DOM error');
        }
      });

      const files = [
        { url: 'https://example.com/file1.pptx', fileName: 'file1.pptx' },
        { url: 'https://example.com/file2.pptx', fileName: 'file2.pptx' }
      ];

      const result = await downloadMultipleFiles(files);

      expect(result.successful).toEqual(['file1.pptx']);
      expect(result.failed).toEqual(['file2.pptx']);
    });
  });

  describe('isDownloadable', () => {
    test('returns true for accessible URLs', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      const result = await isDownloadable('https://example.com/file.pptx');

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith('https://example.com/file.pptx', {
        method: 'HEAD'
      });
    });

    test('returns false for inaccessible URLs', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });

      const result = await isDownloadable('https://example.com/missing.pptx');

      expect(result).toBe(false);
    });

    test('returns true when HEAD request fails (fallback)', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await isDownloadable('https://example.com/file.pptx');

      expect(result).toBe(true); // Falls back to true
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});