'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import logger from '@/lib/logger';

export interface ProgressUpdate {
  type: 'upload' | 'processing' | 'translation' | 'generation' | 'completion' | 'error';
  stage: string;
  progress: number; // 0-100
  message: string;
  details?: any;
  timestamp: string;
}

export interface RealtimeProgressState {
  isConnected: boolean;
  currentProgress: ProgressUpdate | null;
  progressHistory: ProgressUpdate[];
  error: string | null;
}

export function useRealtimeProgress(sessionId?: string) {
  const [state, setState] = useState<RealtimeProgressState>({
    isConnected: false,
    currentProgress: null,
    progressHistory: [],
    error: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const addProgressUpdate = useCallback((update: ProgressUpdate) => {
    setState(prev => ({
      ...prev,
      currentProgress: update,
      progressHistory: [...prev.progressHistory.slice(-49), update], // 最新50件を保持
      error: null,
    }));
  }, []);

  const connect = useCallback(() => {
    if (!sessionId || eventSourceRef.current) {
      return;
    }

    try {
      const url = `/api/progress?sessionId=${encodeURIComponent(sessionId)}`;
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        logger.info(`SSE connection opened for session: ${sessionId}`);
        setState(prev => ({ ...prev, isConnected: true, error: null }));
        reconnectAttempts.current = 0;
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'connected') {
            logger.info('SSE connection established');
          } else if (data.type === 'heartbeat') {
            // ハートビートは無視（接続確認のため）
          } else {
            // 進捗更新を処理
            addProgressUpdate({
              ...data.data,
              timestamp: data.timestamp,
            });
          }
        } catch (error) {
          logger.error('Error parsing SSE message:', error);
        }
      };

      eventSource.onerror = (event) => {
        logger.warn('SSE connection error:', { event: event.type || 'unknown' });
        setState(prev => ({ ...prev, isConnected: false }));
        
        if (eventSource.readyState === EventSource.CLOSED) {
          eventSourceRef.current = null;
          
          // 自動再接続（指数バックオフ）
          if (reconnectAttempts.current < maxReconnectAttempts) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
            reconnectAttempts.current++;
            
            logger.info(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts.current})`);
            
            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, delay);
          } else {
            setState(prev => ({
              ...prev,
              error: '接続が失われました。ページを更新してください。',
            }));
          }
        }
      };

    } catch (error) {
      logger.error('Error creating SSE connection:', error);
      setState(prev => ({
        ...prev,
        error: '進捗通知の接続に失敗しました。',
      }));
    }
  }, [sessionId, addProgressUpdate]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setState(prev => ({ ...prev, isConnected: false }));
  }, []);

  const sendProgress = useCallback(async (update: Omit<ProgressUpdate, 'timestamp'>) => {
    if (!sessionId) return;

    try {
      const response = await fetch('/api/progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          type: 'progress',
          data: update,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

    } catch (error) {
      logger.error('Error sending progress update:', error);
    }
  }, [sessionId]);

  // セッションIDが変更されたら再接続
  useEffect(() => {
    if (sessionId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [sessionId, connect, disconnect]);

  // ページが非表示になったら切断、表示されたら再接続
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && sessionId && !eventSourceRef.current) {
        connect();
      } else if (document.visibilityState === 'hidden') {
        disconnect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [sessionId, connect, disconnect]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    sendProgress,
  };
}