'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useSessionManager, SessionRenewalDialog } from '@/hooks/useSessionManager';
import logger from '@/lib/logger';

// グローバルで一つのSessionManagerのみが有効になるように管理
// React StrictModeでの二重レンダリングを考慮
let globalManagerId: string | null = null;

export function SessionManager() {
  const instanceIdRef = useRef<string>(Math.random().toString(36).substring(2, 11));
  // isActiveの初期値を決定（グローバル変数を直接チェック）
  const [isActive, setIsActive] = useState(() => !globalManagerId);
  
  // 再マウントを検出するログ
  logger.warn(`<<<<< SessionManager Component MOUNTED/RE-RENDERED (instance: ${instanceIdRef.current}, isActive: ${isActive}) >>>>>`);
  
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
      logger.error(`<<<<< SessionManager Component UNMOUNTING (instance: ${instanceId}) >>>>>`);
      // このインスタンスがアクティブだった場合のみグローバルIDをクリア
      if (globalManagerId === instanceId) {
        globalManagerId = null;
        logger.info(`[SessionManager ${instanceId}] DEACTIVATED - clearing global`);
      } else {
        logger.debug(`[SessionManager ${instanceId}] Cleanup - was not active`);
      }
    };
  }, []);
  
  // useMemoでconfig objectの参照を固定化（再レンダリング対策）
  const sessionConfig = useMemo(() => ({
    warningTime: 5 * 60 * 1000, // 5分前に警告
    checkInterval: 60 * 1000, // 1分ごとにチェック
    autoRenew: isActive // このインスタンスがアクティブな場合のみ自動更新
  }), [isActive]);

  const {
    showRenewDialog,
    timeRemaining,
    renewSession,
    handleDismissWarning
  } = useSessionManager(sessionConfig);

  // 条件付きレンダリングを削除（再マウントループを防ぐ）
  // isActiveに関係なくダイアログは常にレンダリング（表示/非表示はisOpenで制御）

  return (
    <SessionRenewalDialog
      isOpen={showRenewDialog}
      timeRemaining={timeRemaining}
      onRenew={renewSession}
      onDismiss={handleDismissWarning}
    />
  );
}