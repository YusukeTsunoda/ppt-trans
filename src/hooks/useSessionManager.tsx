'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';
import logger from '@/lib/logger';

// グローバルな状態を管理（複数インスタンスの防止）
let globalLastRenewalTime = 0;
let globalRenewalInProgress = false;

interface SessionConfig {
  warningTime?: number; // セッション期限切れ警告を表示する時間（ミリ秒）
  checkInterval?: number; // セッションチェック間隔（ミリ秒）
  autoRenew?: boolean; // 自動更新を有効にするか
}

const DEFAULT_WARNING_TIME = 5 * 60 * 1000; // 5分前に警告
const DEFAULT_CHECK_INTERVAL = 60 * 1000; // 1分ごとにチェック

export function useSessionManager(config: SessionConfig = {}) {
  const {
    warningTime = DEFAULT_WARNING_TIME,
    checkInterval = DEFAULT_CHECK_INTERVAL,
    autoRenew = true
  } = config;

  const { data: session, status, update } = useSession();
  const router = useRouter();
  const { showToast } = useToast();
  
  const [isWarningShown, setIsWarningShown] = useState(false);
  const [showRenewDialog, setShowRenewDialog] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const lastRenewRef = useRef<number>(0); // 最後の更新時刻を記録
  const isMountedRef = useRef<boolean>(false); // マウント状態を追跡
  
  // 最新の値を保持するためのref
  const sessionRef = useRef(session);
  const routerRef = useRef(router);
  const showToastRef = useRef(showToast);
  const updateRef = useRef(update);
  const autoRenewRef = useRef(autoRenew);
  const warningTimeRef = useRef(warningTime);
  const isWarningShownRef = useRef(isWarningShown);
  
  // refを更新
  useEffect(() => {
    sessionRef.current = session;
    routerRef.current = router;
    showToastRef.current = showToast;
    updateRef.current = update;
    autoRenewRef.current = autoRenew;
    warningTimeRef.current = warningTime;
    isWarningShownRef.current = isWarningShown;
  });

  // ユーザーアクティビティを記録
  const recordActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    
    // 警告が表示されている場合は非表示にする
    if (isWarningShownRef.current) {
      setIsWarningShown(false);
      setShowRenewDialog(false);
    }
  }, [isWarningShown]);

  // セッション期限切れ処理
  const handleSessionExpired = useCallback(async () => {
    showToastRef.current('セッションの有効期限が切れました。再度ログインしてください。', 'error');
    
    // 現在のURLを保存（ログイン後にリダイレクトするため）
    const currentPath = window.location.pathname;
    sessionStorage.setItem('redirectAfterLogin', currentPath);
    
    // サインアウト
    await signOut({ redirect: false });
    routerRef.current.push('/login');
  }, []); // 依存配列を空にして再作成を防ぐ

  // セッションを更新
  const renewSession = useCallback(async () => {
    // グローバルな連続更新チェック
    const now = Date.now();
    if (globalRenewalInProgress || now - globalLastRenewalTime < 10000) {
      logger.debug('Session renewal skipped - another renewal in progress or too frequent');
      return;
    }
    
    // ローカルな連続更新チェック
    if (now - lastRenewRef.current < 10000) { // 10秒以内の連続更新をブロック
      logger.debug('Session renewal skipped - too frequent (local)');
      return;
    }
    
    // 更新をグローバルとローカルの両方で記録
    globalRenewalInProgress = true;
    globalLastRenewalTime = now;
    lastRenewRef.current = now;
    
    try {
      logger.info('Renewing session');
      
      // セッションを更新するAPIを呼び出す
      const response = await fetch('/api/auth/renew-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin' // クッキーを含める
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      
      // NextAuthのセッションを更新
      await updateRef.current();
      
      setIsWarningShown(false);
      setShowRenewDialog(false);
      showToastRef.current('セッションを更新しました', 'success');
      
      logger.info('Session renewed successfully', data);
      // 最後の更新時刻を再度記録
      globalLastRenewalTime = Date.now();
      lastRenewRef.current = Date.now();
    } catch (error) {
      // ネットワークエラーの場合は警告レベルで記録
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        logger.warn('Network error while renewing session - API may not be ready');
      } else {
        logger.error('Failed to renew session', error);
        showToastRef.current('セッションの更新に失敗しました', 'error');
      }
    } finally {
      globalRenewalInProgress = false;
    }
  }, []); // 依存配列を空にして再作成を防ぐ

  // セッションの有効期限をチェック
  const checkSessionExpiry = useCallback(async () => {
    const currentSession = sessionRef.current;
    if (!currentSession?.expires) {
      logger.debug('[checkSessionExpiry] No session expires data');
      return;
    }
    
    // 初回マウント直後はスキップ
    if (!isMountedRef.current) {
      logger.debug('[checkSessionExpiry] Component not yet mounted');
      return;
    }

    const expiryTime = new Date(currentSession.expires).getTime();
    const now = Date.now();
    const remaining = expiryTime - now;

    logger.debug(`[checkSessionExpiry] Session check:`, {
      expires: currentSession.expires,
      remaining: `${Math.floor(remaining / 1000)}s`,
      autoRenew: autoRenewRef.current,
      isWarningShown: isWarningShownRef.current,
      lastActivity: `${Math.floor((now - lastActivityRef.current) / 1000)}s ago`,
      lastRenewal: `${Math.floor((now - lastRenewRef.current) / 1000)}s ago`,
      globalLastRenewal: `${Math.floor((now - globalLastRenewalTime) / 1000)}s ago`,
      globalRenewalInProgress
    });

    setTimeRemaining(remaining);

    // セッションが既に期限切れ
    if (remaining <= 0) {
      logger.warn('[checkSessionExpiry] Session expired, signing out');
      await handleSessionExpired();
      return;
    }

    // 警告時間に達した
    if (remaining <= warningTimeRef.current && !isWarningShownRef.current) {
      logger.info(`[checkSessionExpiry] Warning time reached: ${Math.ceil(remaining / 60000)} minutes remaining`);
      setIsWarningShown(true);
      setShowRenewDialog(true);
      showToastRef.current(
        `セッションがあと${Math.ceil(remaining / 60000)}分で期限切れになります`,
        'warning'
      );
    }

    // 自動更新が有効で、最近アクティビティがある場合
    // かつ、最後の更新から5分以上経過している場合のみ更新
    const activityRecent = now - lastActivityRef.current < 30000;
    const renewalNotRecent = now - lastRenewRef.current > 300000;
    const expiringPeriod = remaining < 600000 && remaining > 0;
    
    logger.debug(`[checkSessionExpiry] Auto-renewal conditions:`, {
      autoRenew: autoRenewRef.current,
      activityRecent,
      renewalNotRecent,
      expiringPeriod,
      willRenew: autoRenewRef.current && activityRecent && renewalNotRecent && expiringPeriod
    });
    
    if (autoRenewRef.current && activityRecent && renewalNotRecent && expiringPeriod) {
      logger.info('[checkSessionExpiry] Triggering auto-renewal');
      renewSession();
    }
  }, []); // 依存配列を空にして再作成を防ぐ

  // アクティビティリスナーを設定
  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    
    events.forEach(event => {
      window.addEventListener(event, recordActivity);
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, recordActivity);
      });
    };
  }, [recordActivity]);

  // マウント状態を管理
  useEffect(() => {
    // マウント完了を少し遅延させる
    const timer = setTimeout(() => {
      isMountedRef.current = true;
      logger.debug('SessionManager mounted and ready');
    }, 1000); // 1秒後にマウント完了とする

    return () => {
      clearTimeout(timer);
      isMountedRef.current = false;
    };
  }, []);

  // セッションチェックを定期実行
  useEffect(() => {
    logger.debug(`[useEffect] Session check setup:`, {
      status,
      hasSession: !!session,
      sessionExpires: session?.expires,
      isMounted: isMountedRef.current,
      autoRenew,
      checkInterval: `${checkInterval}ms`
    });
    
    // 自動更新が無効の場合は何もしない
    if (!autoRenew) {
      logger.debug('[useEffect] Auto-renewal is disabled for this instance');
      return;
    }
    
    if (status === 'authenticated' && isMountedRef.current) {
      // 既存のインターバルをクリア
      if (checkIntervalRef.current) {
        logger.warn('[useEffect] Clearing existing interval before setting new one');
        clearInterval(checkIntervalRef.current);
      }
      
      // セッションがあることを確認してからチェックを開始
      if (session) {
        // 初回チェック（マウント後のみ）
        logger.info('[useEffect] Running initial session check');
        checkSessionExpiry();

        // 定期チェックを設定
        checkIntervalRef.current = setInterval(() => {
          logger.info(`[setInterval] Running scheduled check (${checkInterval}ms interval)`);
          checkSessionExpiry();
        }, checkInterval);
        logger.info(`[useEffect] Session check interval started: ${checkInterval}ms`);
      }
    }

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        logger.debug('[useEffect cleanup] Session check interval cleared');
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
    };
  }, [status, checkInterval, autoRenew]); // sessionとcheckSessionExpiryを削除して無限ループを防ぐ

  return {
    isAuthenticated: status === 'authenticated',
    isSessionExpiring: isWarningShown,
    timeRemaining,
    showRenewDialog,
    renewSession,
    handleDismissWarning: () => setShowRenewDialog(false)
  };
}

// セッション更新ダイアログコンポーネント
export function SessionRenewalDialog({
  isOpen,
  timeRemaining,
  onRenew,
  onDismiss
}: {
  isOpen: boolean;
  timeRemaining: number | null;
  onRenew: () => Promise<void>;
  onDismiss: () => void;
}) {
  const [isRenewing, setIsRenewing] = useState(false);

  const handleRenew = async () => {
    setIsRenewing(true);
    await onRenew();
    setIsRenewing(false);
  };

  if (!isOpen) return null;

  const minutes = timeRemaining ? Math.ceil(timeRemaining / 60000) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
        onClick={onDismiss}
      />
      
      <div className="relative bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <svg
              className="w-12 h-12 text-yellow-600 dark:text-yellow-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              セッションの有効期限が近づいています
            </h3>
            
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              あと<span className="font-bold text-yellow-600 dark:text-yellow-400">{minutes}分</span>でセッションの有効期限が切れます。
              作業を続けるには、セッションを更新してください。
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={handleRenew}
                disabled={isRenewing}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isRenewing ? (
                  <>
                    <span className="animate-spin inline-block mr-2">⏳</span>
                    更新中...
                  </>
                ) : (
                  'セッションを更新'
                )}
              </button>
              
              <button
                onClick={onDismiss}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                後で
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}