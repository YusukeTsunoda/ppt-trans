'use client';

import { useEffect, useRef, useState } from 'react';
import { useSessionManager, SessionRenewalDialog } from '@/hooks/useSessionManager';
import logger from '@/lib/logger';

// グローバルで一つのSessionManagerのみが有効になるように管理
// React StrictModeでの二重レンダリングを考慮
let globalManagerId: string | null = null;

export function SessionManager() {
  const instanceIdRef = useRef<string>(Math.random().toString(36).substr(2, 9));
  const [isActive, setIsActive] = useState(false);
  
  useEffect(() => {
    const instanceId = instanceIdRef.current;
    
    logger.info(`[SessionManager ${instanceId}] Component mounted, current global: ${globalManagerId}`);
    
    // 最初のインスタンスのみをアクティブにする
    if (!globalManagerId) {
      globalManagerId = instanceId;
      setIsActive(true);
      logger.info(`[SessionManager ${instanceId}] ACTIVATED as primary instance`);
    } else if (globalManagerId !== instanceId) {
      logger.info(`[SessionManager ${instanceId}] SKIPPED - ${globalManagerId} is already active`);
    }
    
    return () => {
      // このインスタンスがアクティブだった場合のみグローバルIDをクリア
      if (globalManagerId === instanceId) {
        globalManagerId = null;
        logger.info(`[SessionManager ${instanceId}] DEACTIVATED - clearing global`);
      } else {
        logger.debug(`[SessionManager ${instanceId}] Cleanup - was not active`);
      }
    };
  }, []);
  
  const {
    showRenewDialog,
    timeRemaining,
    renewSession,
    handleDismissWarning
  } = useSessionManager({
    warningTime: 5 * 60 * 1000, // 5分前に警告
    checkInterval: 60 * 1000, // 1分ごとにチェック
    autoRenew: isActive // このインスタンスがアクティブな場合のみ自動更新
  });

  // アクティブでない場合は何もレンダリングしない
  if (!isActive) return null;

  return (
    <SessionRenewalDialog
      isOpen={showRenewDialog}
      timeRemaining={timeRemaining}
      onRenew={renewSession}
      onDismiss={handleDismissWarning}
    />
  );
}