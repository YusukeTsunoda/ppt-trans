import logger from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';

export type SecurityEventType = 
  | 'csrf_failure'
  | 'rate_limit'
  | 'auth_failure'
  | 'suspicious_activity'
  | 'token_rotation'
  | 'origin_violation'
  | 'content_type_violation';

export type SecuritySeverity = 'low' | 'medium' | 'high' | 'critical';

export interface SecurityEvent {
  type: SecurityEventType;
  severity: SecuritySeverity;
  details: Record<string, any>;
  timestamp: Date;
  requestId: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  path?: string;
  method?: string;
}

interface AlertThreshold {
  count: number;
  window: number; // ミリ秒
  severity: SecuritySeverity;
}

interface SecurityAlert {
  type: string;
  count: number;
  severity: SecuritySeverity;
  message: string;
  firstEvent: SecurityEvent;
  lastEvent: SecurityEvent;
  affectedUsers?: string[];
  suspiciousIPs?: string[];
}

export class SecurityMonitor {
  private static instance: SecurityMonitor;
  private events: SecurityEvent[] = [];
  private alerts: SecurityAlert[] = [];
  
  private alertThresholds: Record<SecurityEventType, AlertThreshold> = {
    csrf_failure: { count: 10, window: 60000, severity: 'high' },      // 1分間に10回
    rate_limit: { count: 50, window: 60000, severity: 'medium' },      // 1分間に50回
    auth_failure: { count: 5, window: 300000, severity: 'high' },      // 5分間に5回
    suspicious_activity: { count: 3, window: 60000, severity: 'critical' }, // 1分間に3回
    token_rotation: { count: 100, window: 60000, severity: 'low' },    // 1分間に100回（異常な頻度）
    origin_violation: { count: 20, window: 60000, severity: 'high' },  // 1分間に20回
    content_type_violation: { count: 30, window: 60000, severity: 'medium' }, // 1分間に30回
  };
  
  // IPベースのブロックリスト（一時的）
  private blockedIPs: Map<string, number> = new Map(); // IP -> ブロック終了時刻
  private suspiciousIPs: Set<string> = new Set();
  
  private constructor() {
    // クリーンアップタスクを定期実行（10分ごと）
    if (typeof global !== 'undefined' && !global.securityCleanupInterval) {
      global.securityCleanupInterval = setInterval(() => {
        this.cleanup();
        this.checkBlockedIPs();
      }, 10 * 60 * 1000);
    }
  }
  
  static getInstance(): SecurityMonitor {
    if (!SecurityMonitor.instance) {
      SecurityMonitor.instance = new SecurityMonitor();
    }
    return SecurityMonitor.instance;
  }
  
  /**
   * セキュリティイベントを記録
   */
  async logEvent(event: Omit<SecurityEvent, 'timestamp'>): Promise<void> {
    const fullEvent: SecurityEvent = {
      ...event,
      timestamp: new Date(),
    };
    
    this.events.push(fullEvent);
    
    // 重要度に応じたログレベル
    switch (event.severity) {
      case 'critical':
        logger.error('[Security Monitor] Critical event', { ...fullEvent });
        break;
      case 'high':
        logger.error('[Security Monitor] High severity event', { ...fullEvent });
        break;
      case 'medium':
        logger.warn('[Security Monitor] Medium severity event', { ...fullEvent });
        break;
      case 'low':
        logger.info('[Security Monitor] Low severity event', { ...fullEvent });
        break;
    }
    
    // データベースに記録（非同期、エラーは無視）
    this.storeEventInDatabase(fullEvent).catch(error => {
      logger.error('[Security Monitor] Failed to store event in database', { error });
    });
    
    // 閾値チェック
    await this.checkThresholds(event.type);
    
    // 特定のパターンを検出
    this.detectPatterns(fullEvent);
  }
  
  /**
   * データベースにイベントを保存
   */
  private async storeEventInDatabase(event: SecurityEvent): Promise<void> {
    try {
      const supabase = await createClient();
      
      // security_eventsテーブルが存在する場合のみ保存
      // TODO: マイグレーションでテーブルを作成
      const { error } = await supabase
        .from('security_events')
        .insert({
          event_type: event.type,
          severity: event.severity,
          details: event.details,
          request_id: event.requestId,
          user_id: event.userId,
          ip_address: event.ip,
          user_agent: event.userAgent,
          path: event.path,
          method: event.method,
          created_at: event.timestamp,
        });
      
      if (error) {
        // テーブルが存在しない場合はログのみ
        if (error.message.includes('relation') && error.message.includes('does not exist')) {
          logger.debug('[Security Monitor] security_events table not found, skipping DB storage');
        } else {
          throw error;
        }
      }
    } catch (error) {
      logger.error('[Security Monitor] Database storage error', { error });
    }
  }
  
  /**
   * 閾値チェックとアラート
   */
  private async checkThresholds(eventType: SecurityEventType): Promise<void> {
    const threshold = this.alertThresholds[eventType];
    if (!threshold) return;
    
    const now = Date.now();
    const recentEvents = this.events.filter(
      e => e.type === eventType && 
      (now - e.timestamp.getTime()) < threshold.window
    );
    
    if (recentEvents.length >= threshold.count) {
      await this.triggerAlert(eventType, recentEvents, threshold);
    }
  }
  
  /**
   * アラート発動
   */
  private async triggerAlert(
    eventType: SecurityEventType, 
    events: SecurityEvent[],
    threshold: AlertThreshold
  ): Promise<void> {
    // 影響を受けたユーザーとIPを収集
    const affectedUsers = [...new Set(events.map(e => e.userId).filter(Boolean))];
    const suspiciousIPs = [...new Set(events.map(e => e.ip).filter(Boolean))];
    
    const alert: SecurityAlert = {
      type: eventType,
      count: events.length,
      severity: threshold.severity,
      message: `Security threshold exceeded: ${events.length} ${eventType} events in ${threshold.window / 1000} seconds`,
      firstEvent: events[0],
      lastEvent: events[events.length - 1],
      affectedUsers: affectedUsers as string[],
      suspiciousIPs: suspiciousIPs as string[],
    };
    
    this.alerts.push(alert);
    
    logger.error('[SECURITY ALERT]', alert);
    
    // 自動対応
    await this.handleAlert(alert);
  }
  
  /**
   * アラートへの自動対応
   */
  private async handleAlert(alert: SecurityAlert): Promise<void> {
    // Critical以上の場合、IPを一時ブロック
    if (alert.severity === 'critical' || 
        (alert.severity === 'high' && alert.count > 20)) {
      
      for (const ip of alert.suspiciousIPs || []) {
        this.blockIP(ip, 15 * 60 * 1000); // 15分間ブロック
        logger.warn(`[Security Monitor] IP temporarily blocked: ${ip}`);
      }
    }
    
    // 疑わしいIPをマーク
    if (alert.severity === 'high' || alert.severity === 'critical') {
      for (const ip of alert.suspiciousIPs || []) {
        this.suspiciousIPs.add(ip);
      }
    }
    
    // TODO: 管理者への通知（Email/Slack）
    // await this.notifyAdministrators(alert);
  }
  
  /**
   * パターン検出
   */
  private detectPatterns(event: SecurityEvent): void {
    // ブルートフォース攻撃の検出
    if (event.type === 'auth_failure' && event.userId) {
      const recentAuthFailures = this.events.filter(
        e => e.type === 'auth_failure' && 
             e.userId === event.userId &&
             (Date.now() - e.timestamp.getTime()) < 300000 // 5分
      );
      
      if (recentAuthFailures.length >= 3) {
        this.logEvent({
          type: 'suspicious_activity',
          severity: 'high',
          details: {
            pattern: 'brute_force_attempt',
            userId: event.userId,
            attempts: recentAuthFailures.length,
          },
          requestId: event.requestId,
          userId: event.userId,
          ip: event.ip,
        }).catch(() => {}); // エラーは無視
      }
    }
    
    // DDoS攻撃の検出
    if (event.type === 'rate_limit' && event.ip) {
      const recentRateLimits = this.events.filter(
        e => e.type === 'rate_limit' && 
             e.ip === event.ip &&
             (Date.now() - e.timestamp.getTime()) < 60000 // 1分
      );
      
      if (recentRateLimits.length >= 10) {
        this.logEvent({
          type: 'suspicious_activity',
          severity: 'critical',
          details: {
            pattern: 'potential_ddos',
            ip: event.ip,
            requests: recentRateLimits.length,
          },
          requestId: event.requestId,
          ip: event.ip,
        }).catch(() => {}); // エラーは無視
      }
    }
  }
  
  /**
   * IPをブロック
   */
  blockIP(ip: string, duration: number): void {
    const unblockTime = Date.now() + duration;
    this.blockedIPs.set(ip, unblockTime);
  }
  
  /**
   * IPがブロックされているかチェック
   */
  isIPBlocked(ip: string): boolean {
    const unblockTime = this.blockedIPs.get(ip);
    if (!unblockTime) return false;
    
    if (Date.now() < unblockTime) {
      return true;
    } else {
      this.blockedIPs.delete(ip);
      return false;
    }
  }
  
  /**
   * ブロック期限切れのIPをクリーンアップ
   */
  private checkBlockedIPs(): void {
    const now = Date.now();
    for (const [ip, unblockTime] of this.blockedIPs.entries()) {
      if (now >= unblockTime) {
        this.blockedIPs.delete(ip);
        logger.info(`[Security Monitor] IP unblocked: ${ip}`);
      }
    }
  }
  
  /**
   * 統計情報取得
   */
  getStatistics(window: number = 3600000): {
    events: Record<SecurityEventType, number>;
    alerts: number;
    blockedIPs: number;
    suspiciousIPs: number;
    topIPs: { ip: string; count: number }[];
    topUsers: { userId: string; count: number }[];
  } {
    const now = Date.now();
    const recentEvents = this.events.filter(
      e => (now - e.timestamp.getTime()) < window
    );
    
    // イベントタイプ別集計
    const eventCounts: Record<string, number> = {};
    for (const event of recentEvents) {
      eventCounts[event.type] = (eventCounts[event.type] || 0) + 1;
    }
    
    // IP別集計
    const ipCounts: Record<string, number> = {};
    for (const event of recentEvents) {
      if (event.ip) {
        ipCounts[event.ip] = (ipCounts[event.ip] || 0) + 1;
      }
    }
    
    // ユーザー別集計
    const userCounts: Record<string, number> = {};
    for (const event of recentEvents) {
      if (event.userId) {
        userCounts[event.userId] = (userCounts[event.userId] || 0) + 1;
      }
    }
    
    // Top 5を抽出
    const topIPs = Object.entries(ipCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([ip, count]) => ({ ip, count }));
    
    const topUsers = Object.entries(userCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([userId, count]) => ({ userId, count }));
    
    return {
      events: eventCounts as Record<SecurityEventType, number>,
      alerts: this.alerts.filter(
        a => (now - a.lastEvent.timestamp.getTime()) < window
      ).length,
      blockedIPs: this.blockedIPs.size,
      suspiciousIPs: this.suspiciousIPs.size,
      topIPs,
      topUsers,
    };
  }
  
  /**
   * 最近のアラートを取得
   */
  getRecentAlerts(limit: number = 10): SecurityAlert[] {
    return this.alerts
      .sort((a, b) => b.lastEvent.timestamp.getTime() - a.lastEvent.timestamp.getTime())
      .slice(0, limit);
  }
  
  /**
   * 古いイベントをクリーンアップ
   */
  private cleanup(maxAge: number = 86400000): void { // デフォルト24時間
    const cutoff = Date.now() - maxAge;
    const beforeCount = this.events.length;
    
    this.events = this.events.filter(e => e.timestamp.getTime() > cutoff);
    this.alerts = this.alerts.filter(a => a.lastEvent.timestamp.getTime() > cutoff);
    
    const removed = beforeCount - this.events.length;
    if (removed > 0) {
      logger.info(`[Security Monitor] Cleaned up ${removed} old events`);
    }
  }
  
  /**
   * リセット（テスト用）
   */
  reset(): void {
    this.events = [];
    this.alerts = [];
    this.blockedIPs.clear();
    this.suspiciousIPs.clear();
    logger.info('[Security Monitor] Monitor state reset');
  }
}

// グローバル宣言（TypeScript用）
declare global {
  var securityCleanupInterval: NodeJS.Timeout | undefined;
}