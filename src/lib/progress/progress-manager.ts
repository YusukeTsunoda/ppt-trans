import logger from '@/lib/logger';

// Store active progress streams
const progressStreams = new Map<string, ReadableStreamDefaultController>();

/**
 * Register a progress stream controller
 */
export function registerProgressStream(fileId: string, controller: ReadableStreamDefaultController) {
  progressStreams.set(fileId, controller);
}

/**
 * Unregister a progress stream controller
 */
export function unregisterProgressStream(fileId: string) {
  progressStreams.delete(fileId);
}

/**
 * Get a progress stream controller
 */
export function getProgressStream(fileId: string) {
  return progressStreams.get(fileId);
}

/**
 * Send progress update to a specific file's stream
 */
export function sendProgressUpdate(fileId: string, progress: any) {
  const controller = progressStreams.get(fileId);
  if (controller) {
    try {
      const encoder = new TextEncoder();
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'progress', ...progress })}\n\n`)
      );
    } catch (error) {
      logger.error('Failed to send progress update:', error);
      progressStreams.delete(fileId);
    }
  }
}