import { useState, useEffect, useCallback } from 'react';
import logger from '@/lib/logger';

export interface TranslationProgress {
  total_slides: number;
  completed_slides: number;
  current_slide?: number;
  percentage: number;
  status: 'preparing' | 'translating' | 'finalizing' | 'completed' | 'failed';
  message?: string;
}

export function useTranslationProgress(fileId: string | null) {
  const [progress, setProgress] = useState<TranslationProgress | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(() => {
    if (!fileId) return;

    const eventSource = new EventSource(`/api/translate-pptx-progress?fileId=${fileId}`);
    
    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
      logger.info('Connected to translation progress stream');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'progress') {
          setProgress({
            total_slides: data.total_slides,
            completed_slides: data.completed_slides,
            current_slide: data.current_slide,
            percentage: data.percentage,
            status: data.status,
            message: data.message
          });
          
          // Check if translation is complete
          if (data.status === 'completed' || data.status === 'failed') {
            eventSource.close();
            setIsConnected(false);
          }
        }
      } catch (err) {
        logger.error('Failed to parse progress data:', err);
      }
    };

    eventSource.onerror = (err) => {
      logger.error('EventSource error:', err);
      setError('Failed to connect to progress stream');
      setIsConnected(false);
      eventSource.close();
    };

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, [fileId]);

  useEffect(() => {
    const cleanup = connect();
    return cleanup;
  }, [connect]);

  return {
    progress,
    isConnected,
    error,
    reconnect: connect
  };
}