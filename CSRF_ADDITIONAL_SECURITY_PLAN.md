# CSRF追加セキュリティ対策実装計画

## 実装優先度とスケジュール

### 🔴 Phase 1: 即座対応項目（Critical）
エラーレポート機能のCSRF保護実装

### 🟡 Phase 2: 短期改善項目（High Priority）
Cookie設定のセキュリティ強化

### 🟢 Phase 3: 中期改善項目（Medium Priority）
トークンローテーション機能の実装

### 🔵 Phase 4: 長期改善項目（Low Priority）
セキュリティ監視・分析機能の実装

---

## Phase 1: エラーレポート機能の実装とCSRF保護

### 1.1 エラーレポートAPIエンドポイントの作成
**ファイル**: `/src/app/api/error-report/route.ts`（新規作成）

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { performSecurityChecks, createErrorResponse, createSuccessResponse } from '@/lib/security/api-security';
import logger from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  // セキュリティチェック（エラーレポートは頻度制限を緩め）
  const securityCheck = await performSecurityChecks(request, {
    csrf: true,
    origin: true,
    rateLimit: {
      maxRequests: 60,  // エラーレポートは頻度高めに許可
      windowMs: 60 * 1000,
      identifier: 'error-report',
    },
    contentType: 'application/json',
    methods: ['POST'],
  });
  
  if (!securityCheck.success) {
    return createErrorResponse(
      securityCheck.error!,
      securityCheck.status!,
      securityCheck.headers,
      securityCheck.requestId
    );
  }
  
  const requestId = securityCheck.requestId;
  
  try {
    const { error, errorInfo, userAgent, timestamp, userId } = await request.json();
    
    // エラー情報をログに記録
    logger.error('Client error reported', {
      requestId,
      error,
      errorInfo,
      userAgent,
      timestamp,
      userId,
    });
    
    // Supabaseのerror_logsテーブルに記録（オプション）
    const supabase = await createClient();
    if (userId) {
      await supabase.from('error_logs').insert({
        user_id: userId,
        error_message: error,
        error_stack: errorInfo?.componentStack,
        user_agent: userAgent,
        occurred_at: timestamp,
        request_id: requestId,
      });
    }
    
    return createSuccessResponse(
      { success: true, message: 'エラーレポートを受信しました' },
      200,
      requestId
    );
  } catch (error) {
    logger.error('Error report processing failed:', { 
      requestId, 
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    return createErrorResponse(
      'エラーレポートの処理に失敗しました',
      500,
      undefined,
      requestId
    );
  }
}
```

### 1.2 ErrorBoundary.tsxの修正
**ファイル**: `/src/components/ErrorBoundary.tsx`
**修正箇所**: Line 207

```typescript
// 修正前
await fetch('/api/error-report', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(errorReport),
});

// 修正後
import { fetchWithCSRF } from '@/lib/security/csrf';

await fetchWithCSRF('/api/error-report', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(errorReport),
});
```

### 1.3 ErrorDetailModal.tsxの修正
**ファイル**: `/src/components/ErrorDetailModal.tsx`
**修正箇所**: Line 74

```typescript
// 修正前
await fetch('/api/error-report', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(reportData),
});

// 修正後
import { fetchWithCSRF } from '@/lib/security/csrf';

await fetchWithCSRF('/api/error-report', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(reportData),
});
```

---

## Phase 2: Cookie設定のセキュリティ強化

### 2.1 CSRF Cookie設定の改善
**ファイル**: `/src/lib/security/csrf.ts`
**修正箇所**: Lines 17-23

```typescript
// 修正前
export function setCSRFToken(response: NextResponse): string {
  const token = generateCSRFToken();
  
  response.cookies.set(CSRF_TOKEN_NAME, token, {
    httpOnly: false, // XSSリスクあり
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24, // 24時間
  });

// 修正後
export function setCSRFToken(response: NextResponse, options?: {
  rotationInterval?: number;
  doubleSubmit?: boolean;
}): string {
  const token = generateCSRFToken();
  const isProduction = process.env.NODE_ENV === 'production';
  
  // メタトークン（httpOnly）として保存
  response.cookies.set(`${CSRF_TOKEN_NAME}_meta`, token, {
    httpOnly: true,  // XSS対策強化
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: options?.rotationInterval || 60 * 60 * 4, // デフォルト4時間
  });
  
  // Double Submit用トークン（JavaScript読み取り可能）
  if (options?.doubleSubmit !== false) {
    response.cookies.set(CSRF_TOKEN_NAME, token, {
      httpOnly: false,  // Double Submit Cookieパターン用
      secure: isProduction,
      sameSite: 'strict',
      path: '/',
      maxAge: options?.rotationInterval || 60 * 60 * 4,
    });
  }
  
  return token;
}
```

### 2.2 検証ロジックの強化
**ファイル**: `/src/lib/security/csrf.ts`
**修正箇所**: Lines 50-80

```typescript
// 修正後の検証ロジック
export async function validateCSRFToken(request: NextRequest): Promise<boolean> {
  try {
    // メタトークンの存在確認（httpOnly）
    const metaToken = request.cookies.get(`${CSRF_TOKEN_NAME}_meta`)?.value;
    if (!metaToken) {
      console.error('[CSRF] No meta token in secure cookie');
      return false;
    }
    
    // クライアントトークンの取得（ヘッダー優先）
    const headerToken = request.headers.get(CSRF_HEADER_NAME);
    const cookieToken = request.cookies.get(CSRF_TOKEN_NAME)?.value;
    
    // ボディトークンのチェック（フォールバック）
    let bodyToken: string | null = null;
    if (request.headers.get('content-type')?.includes('application/json')) {
      try {
        const body = await request.clone().json();
        bodyToken = body._csrf;
      } catch {
        // JSON解析エラーは無視
      }
    }
    
    // 優先順位: Header > Cookie > Body
    const clientToken = headerToken || cookieToken || bodyToken;
    
    if (!clientToken) {
      console.error('[CSRF] No client token found');
      return false;
    }
    
    // タイミング攻撃対策付き比較
    const isValid = secureCompare(metaToken, clientToken);
    
    if (!isValid) {
      console.error('[CSRF] Token mismatch');
      // セキュリティイベントログ
      logger.warn('CSRF validation failed', {
        path: request.url,
        method: request.method,
        hasMetaToken: !!metaToken,
        hasClientToken: !!clientToken,
      });
    }
    
    return isValid;
  } catch (error) {
    console.error('[CSRF] Validation error:', error);
    return false;
  }
}
```

---

## Phase 3: トークンローテーション機能

### 3.1 ローテーション管理クラスの作成
**ファイル**: `/src/lib/security/token-rotation.ts`（新規作成）

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { generateCSRFToken, setCSRFToken, CSRF_TOKEN_NAME } from './csrf';
import logger from '@/lib/logger';

interface TokenRotationConfig {
  rotationInterval: number; // ミリ秒
  gracePeriod: number;     // 古いトークンの猶予期間
  maxTokensPerUser: number; // ユーザーごとの最大トークン数
}

export class CSRFTokenRotation {
  private static instance: CSRFTokenRotation;
  private tokenStore: Map<string, { token: string; expires: number; userId?: string }> = new Map();
  private config: TokenRotationConfig = {
    rotationInterval: 60 * 60 * 1000, // 1時間
    gracePeriod: 5 * 60 * 1000,       // 5分
    maxTokensPerUser: 5,
  };
  
  static getInstance(): CSRFTokenRotation {
    if (!CSRFTokenRotation.instance) {
      CSRFTokenRotation.instance = new CSRFTokenRotation();
    }
    return CSRFTokenRotation.instance;
  }
  
  // トークンローテーションチェック
  shouldRotate(request: NextRequest): boolean {
    const token = request.cookies.get(CSRF_TOKEN_NAME)?.value;
    if (!token) return true;
    
    const tokenData = this.tokenStore.get(token);
    if (!tokenData) return true;
    
    const now = Date.now();
    return now > tokenData.expires;
  }
  
  // 新しいトークンを生成してローテーション
  rotateToken(response: NextResponse, userId?: string): string {
    const newToken = generateCSRFToken();
    const now = Date.now();
    
    // 古いトークンをクリーンアップ
    this.cleanupExpiredTokens();
    
    // ユーザーごとのトークン数制限
    if (userId) {
      this.enforceUserTokenLimit(userId);
    }
    
    // 新しいトークンを保存
    this.tokenStore.set(newToken, {
      token: newToken,
      expires: now + this.config.rotationInterval,
      userId,
    });
    
    // Cookieに設定
    setCSRFToken(response, { rotationInterval: this.config.rotationInterval / 1000 });
    
    logger.info('CSRF token rotated', {
      userId,
      newTokenExpires: new Date(now + this.config.rotationInterval),
    });
    
    return newToken;
  }
  
  // 期限切れトークンのクリーンアップ
  private cleanupExpiredTokens(): void {
    const now = Date.now();
    const gracePeriodEnd = now - this.config.gracePeriod;
    
    for (const [token, data] of this.tokenStore.entries()) {
      if (data.expires < gracePeriodEnd) {
        this.tokenStore.delete(token);
      }
    }
  }
  
  // ユーザーごとのトークン数制限
  private enforceUserTokenLimit(userId: string): void {
    const userTokens = Array.from(this.tokenStore.entries())
      .filter(([_, data]) => data.userId === userId)
      .sort((a, b) => a[1].expires - b[1].expires);
    
    while (userTokens.length >= this.config.maxTokensPerUser) {
      const oldest = userTokens.shift();
      if (oldest) {
        this.tokenStore.delete(oldest[0]);
      }
    }
  }
  
  // トークン検証（猶予期間考慮）
  validateWithRotation(token: string): boolean {
    const tokenData = this.tokenStore.get(token);
    if (!tokenData) return false;
    
    const now = Date.now();
    const gracePeriodEnd = tokenData.expires + this.config.gracePeriod;
    
    return now < gracePeriodEnd;
  }
}
```

### 3.2 ミドルウェアへのローテーション統合
**ファイル**: `/src/middleware.ts`
**追加箇所**: CSRFトークンローテーションの統合

```typescript
import { CSRFTokenRotation } from '@/lib/security/token-rotation';

export async function middleware(request: NextRequest) {
  // 既存のミドルウェアロジック...
  
  // CSRFトークンローテーションチェック
  if (request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE') {
    const rotation = CSRFTokenRotation.getInstance();
    
    if (rotation.shouldRotate(request)) {
      const response = NextResponse.next();
      const userId = request.headers.get('x-user-id'); // または認証から取得
      rotation.rotateToken(response, userId);
      return response;
    }
  }
  
  return NextResponse.next();
}
```

---

## Phase 4: セキュリティ監視機能

### 4.1 セキュリティイベントトラッカーの作成
**ファイル**: `/src/lib/security/security-monitor.ts`（新規作成）

```typescript
import logger from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';

interface SecurityEvent {
  type: 'csrf_failure' | 'rate_limit' | 'auth_failure' | 'suspicious_activity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, any>;
  timestamp: Date;
  requestId: string;
  userId?: string;
  ip?: string;
}

export class SecurityMonitor {
  private static instance: SecurityMonitor;
  private events: SecurityEvent[] = [];
  private alertThresholds = {
    csrf_failure: { count: 10, window: 60000 }, // 1分間に10回
    rate_limit: { count: 50, window: 60000 },
    auth_failure: { count: 5, window: 300000 }, // 5分間に5回
  };
  
  static getInstance(): SecurityMonitor {
    if (!SecurityMonitor.instance) {
      SecurityMonitor.instance = new SecurityMonitor();
    }
    return SecurityMonitor.instance;
  }
  
  // セキュリティイベントを記録
  async logEvent(event: Omit<SecurityEvent, 'timestamp'>): Promise<void> {
    const fullEvent: SecurityEvent = {
      ...event,
      timestamp: new Date(),
    };
    
    this.events.push(fullEvent);
    
    // ログ出力
    logger.warn('Security event', fullEvent);
    
    // データベースに記録
    try {
      const supabase = await createClient();
      await supabase.from('security_events').insert({
        event_type: event.type,
        severity: event.severity,
        details: event.details,
        request_id: event.requestId,
        user_id: event.userId,
        ip_address: event.ip,
        created_at: fullEvent.timestamp,
      });
    } catch (error) {
      logger.error('Failed to store security event', { error });
    }
    
    // 閾値チェック
    this.checkThresholds(event.type);
  }
  
  // 閾値チェックとアラート
  private checkThresholds(eventType: string): void {
    const threshold = this.alertThresholds[eventType as keyof typeof this.alertThresholds];
    if (!threshold) return;
    
    const now = Date.now();
    const recentEvents = this.events.filter(
      e => e.type === eventType && 
      (now - e.timestamp.getTime()) < threshold.window
    );
    
    if (recentEvents.length >= threshold.count) {
      this.triggerAlert(eventType, recentEvents);
    }
  }
  
  // アラート発動
  private async triggerAlert(eventType: string, events: SecurityEvent[]): Promise<void> {
    const alert = {
      type: eventType,
      count: events.length,
      severity: 'high' as const,
      message: `Security threshold exceeded: ${events.length} ${eventType} events`,
      firstEvent: events[0],
      lastEvent: events[events.length - 1],
    };
    
    logger.error('SECURITY ALERT', alert);
    
    // 管理者に通知（メール、Slack等）
    // await notificationService.sendAlert(alert);
    
    // 自動対応（例：一時的なブロック）
    if (eventType === 'csrf_failure' && events.length > 20) {
      // IPアドレスベースの一時ブロック実装
      const ips = events.map(e => e.ip).filter(Boolean);
      // await blockIPs(ips);
    }
  }
  
  // 統計情報取得
  getStatistics(window: number = 3600000): Record<string, number> {
    const now = Date.now();
    const stats: Record<string, number> = {};
    
    for (const event of this.events) {
      if ((now - event.timestamp.getTime()) < window) {
        stats[event.type] = (stats[event.type] || 0) + 1;
      }
    }
    
    return stats;
  }
  
  // クリーンアップ（古いイベントを削除）
  cleanup(maxAge: number = 86400000): void { // デフォルト24時間
    const cutoff = Date.now() - maxAge;
    this.events = this.events.filter(e => e.timestamp.getTime() > cutoff);
  }
}
```

### 4.2 セキュリティダッシュボード用APIの作成
**ファイル**: `/src/app/api/security/stats/route.ts`（新規作成）

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { SecurityMonitor } from '@/lib/security/security-monitor';
import { performSecurityChecks, createErrorResponse, createSuccessResponse } from '@/lib/security/api-security';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  // 管理者のみアクセス可能
  const securityCheck = await performSecurityChecks(request, {
    csrf: false, // GETリクエストなのでCSRF不要
    origin: true,
    methods: ['GET'],
  });
  
  if (!securityCheck.success) {
    return createErrorResponse(
      securityCheck.error!,
      securityCheck.status!,
      securityCheck.headers,
      securityCheck.requestId
    );
  }
  
  try {
    // ユーザー認証と管理者権限チェック
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return createErrorResponse('認証が必要です', 401);
    }
    
    // 管理者権限チェック（実装に応じて調整）
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    
    if (profile?.role !== 'admin') {
      return createErrorResponse('管理者権限が必要です', 403);
    }
    
    // セキュリティ統計を取得
    const monitor = SecurityMonitor.getInstance();
    const stats = {
      lastHour: monitor.getStatistics(3600000),
      last24Hours: monitor.getStatistics(86400000),
      last7Days: monitor.getStatistics(604800000),
    };
    
    // データベースから詳細統計を取得
    const { data: recentEvents } = await supabase
      .from('security_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    
    return createSuccessResponse({
      stats,
      recentEvents,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return createErrorResponse('統計情報の取得に失敗しました', 500);
  }
}
```

---

## Phase 5: データベーススキーマの追加

### 5.1 Supabaseテーブル作成SQL
**ファイル**: `/supabase/migrations/[timestamp]_add_security_tables.sql`（新規作成）

```sql
-- エラーログテーブル
CREATE TABLE IF NOT EXISTS error_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  user_agent TEXT,
  occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  request_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- セキュリティイベントテーブル
CREATE TABLE IF NOT EXISTS security_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  details JSONB,
  request_id TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX idx_error_logs_user_id ON error_logs(user_id);
CREATE INDEX idx_error_logs_occurred_at ON error_logs(occurred_at);
CREATE INDEX idx_security_events_event_type ON security_events(event_type);
CREATE INDEX idx_security_events_created_at ON security_events(created_at);
CREATE INDEX idx_security_events_user_id ON security_events(user_id);

-- Row Level Security
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- ポリシー設定（管理者のみ閲覧可能）
CREATE POLICY "Admin can view error logs" ON error_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin can view security events" ON security_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- APIからの挿入は許可
CREATE POLICY "Service role can insert error logs" ON error_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can insert security events" ON security_events
  FOR INSERT
  TO service_role
  WITH CHECK (true);
```

---

## 実装順序と工数見積もり

| Phase | 内容 | 優先度 | 推定工数 | リスク |
|-------|------|--------|----------|---------|
| 1 | エラーレポートAPI実装 | 🔴 Critical | 2時間 | Low |
| 2 | Cookie設定強化 | 🟡 High | 3時間 | Medium |
| 3 | トークンローテーション | 🟢 Medium | 4時間 | Medium |
| 4 | セキュリティ監視 | 🔵 Low | 6時間 | Low |
| 5 | データベース拡張 | 🟢 Medium | 2時間 | Low |

## テスト計画

### 単体テスト追加
- `/tests/api/error-report.test.ts`
- `/tests/lib/security/token-rotation.test.ts`
- `/tests/lib/security/security-monitor.test.ts`

### E2Eテスト追加
- CSRFトークンローテーションのシナリオテスト
- セキュリティイベント記録の確認テスト
- エラーレポート送信フロー

### パフォーマンステスト
- トークンローテーション時の応答時間
- セキュリティ監視のメモリ使用量
- 大量イベント時の処理性能

## リリース後の監視項目

1. **CSRF攻撃試行数**
   - 1時間あたりの失敗数
   - 特定IPからの集中アクセス

2. **トークンローテーション頻度**
   - 平均ローテーション間隔
   - ローテーション失敗率

3. **エラーレポート傾向**
   - エラー発生頻度
   - エラータイプ別統計

4. **パフォーマンス指標**
   - API応答時間の変化
   - メモリ使用量の推移