import { NextRequest, NextResponse } from 'next/server';
import { CSRFProtection, CSRF_TOKEN_NAME, CSRF_META_TOKEN_NAME } from './csrf';
import logger from '@/lib/logger';
import { randomBytes } from 'crypto';

interface TokenRotationConfig {
  rotationInterval: number;  // ミリ秒
  gracePeriod: number;       // 古いトークンの猶予期間
  maxTokensPerUser: number;  // ユーザーごとの最大トークン数
}

interface TokenData {
  token: string;
  expires: number;
  userId?: string;
  created: number;
  lastUsed: number;
}

export class CSRFTokenRotation {
  private static instance: CSRFTokenRotation;
  private tokenStore: Map<string, TokenData> = new Map();
  private userTokens: Map<string, Set<string>> = new Map();
  
  private config: TokenRotationConfig = {
    rotationInterval: 60 * 60 * 1000,  // 1時間
    gracePeriod: 5 * 60 * 1000,        // 5分
    maxTokensPerUser: 5,
  };
  
  private constructor() {
    // クリーンアップタスクを定期実行（5分ごと）
    if (typeof global !== 'undefined' && !global.csrfCleanupInterval) {
      global.csrfCleanupInterval = setInterval(() => {
        this.cleanupExpiredTokens();
      }, 5 * 60 * 1000);
    }
  }
  
  static getInstance(): CSRFTokenRotation {
    if (!CSRFTokenRotation.instance) {
      CSRFTokenRotation.instance = new CSRFTokenRotation();
    }
    return CSRFTokenRotation.instance;
  }
  
  /**
   * トークンローテーションが必要かチェック
   */
  shouldRotate(request: NextRequest): boolean {
    // 両方のトークンをチェック
    const token = request.cookies.get(CSRF_TOKEN_NAME)?.value;
    const metaToken = request.cookies.get(CSRF_META_TOKEN_NAME)?.value;
    const activeToken = metaToken || token;
    
    if (!activeToken) {
      logger.debug('[Token Rotation] No token found, rotation needed');
      return true;
    }
    
    const tokenData = this.tokenStore.get(activeToken);
    if (!tokenData) {
      logger.debug('[Token Rotation] Token not in store, rotation needed');
      return true;
    }
    
    const now = Date.now();
    const shouldRotate = now > tokenData.expires;
    
    if (shouldRotate) {
      logger.info('[Token Rotation] Token expired, rotation needed', {
        tokenAge: Math.floor((now - tokenData.created) / 1000 / 60) + ' minutes',
        expiresAt: new Date(tokenData.expires).toISOString(),
      });
    }
    
    // 使用時刻を更新
    tokenData.lastUsed = now;
    
    return shouldRotate;
  }
  
  /**
   * 新しいトークンを生成してローテーション
   */
  rotateToken(response: NextResponse, userId?: string): string {
    const newToken = randomBytes(32).toString('hex');
    const now = Date.now();
    
    // 古いトークンをクリーンアップ
    this.cleanupExpiredTokens();
    
    // ユーザーごとのトークン数制限
    if (userId) {
      this.enforceUserTokenLimit(userId);
    }
    
    // 新しいトークンデータを作成
    const tokenData: TokenData = {
      token: newToken,
      expires: now + this.config.rotationInterval,
      userId,
      created: now,
      lastUsed: now,
    };
    
    // トークンストアに保存
    this.tokenStore.set(newToken, tokenData);
    
    // ユーザーとトークンの関連付け
    if (userId) {
      if (!this.userTokens.has(userId)) {
        this.userTokens.set(userId, new Set());
      }
      this.userTokens.get(userId)!.add(newToken);
    }
    
    // Cookieに設定
    const isProduction = process.env.NODE_ENV === 'production';
    const maxAge = Math.floor(this.config.rotationInterval / 1000);
    
    // httpOnlyメタトークン
    response.cookies.set(CSRF_META_TOKEN_NAME, newToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/',
      maxAge,
    });
    
    // Double Submit Cookie用トークン
    response.cookies.set(CSRF_TOKEN_NAME, newToken, {
      httpOnly: false,
      secure: isProduction,
      sameSite: 'strict',
      path: '/',
      maxAge,
    });
    
    logger.info('[Token Rotation] Token rotated', {
      userId,
      newTokenExpires: new Date(tokenData.expires).toISOString(),
      activeTokens: this.tokenStore.size,
    });
    
    return newToken;
  }
  
  /**
   * トークンが有効かチェック（猶予期間考慮）
   */
  validateWithRotation(token: string): boolean {
    const tokenData = this.tokenStore.get(token);
    if (!tokenData) {
      logger.debug('[Token Rotation] Token not found in store');
      return false;
    }
    
    const now = Date.now();
    const gracePeriodEnd = tokenData.expires + this.config.gracePeriod;
    
    // 有効期限内または猶予期間内
    const isValid = now < gracePeriodEnd;
    
    if (!isValid) {
      logger.warn('[Token Rotation] Token expired beyond grace period', {
        tokenAge: Math.floor((now - tokenData.created) / 1000 / 60) + ' minutes',
        gracePeriodExpired: Math.floor((now - gracePeriodEnd) / 1000) + ' seconds ago',
      });
    } else if (now > tokenData.expires) {
      logger.info('[Token Rotation] Token in grace period', {
        gracePeriodRemaining: Math.floor((gracePeriodEnd - now) / 1000) + ' seconds',
      });
    }
    
    // 使用時刻を更新
    if (isValid) {
      tokenData.lastUsed = now;
    }
    
    return isValid;
  }
  
  /**
   * 期限切れトークンのクリーンアップ
   */
  private cleanupExpiredTokens(): void {
    const now = Date.now();
    const gracePeriodEnd = now - this.config.gracePeriod;
    let cleanedCount = 0;
    
    for (const [token, data] of this.tokenStore.entries()) {
      if (data.expires < gracePeriodEnd) {
        this.tokenStore.delete(token);
        
        // ユーザートークンリストからも削除
        if (data.userId) {
          const userTokenSet = this.userTokens.get(data.userId);
          if (userTokenSet) {
            userTokenSet.delete(token);
            if (userTokenSet.size === 0) {
              this.userTokens.delete(data.userId);
            }
          }
        }
        
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      logger.info('[Token Rotation] Cleaned up expired tokens', {
        cleaned: cleanedCount,
        remaining: this.tokenStore.size,
      });
    }
  }
  
  /**
   * ユーザーごとのトークン数制限を適用
   */
  private enforceUserTokenLimit(userId: string): void {
    const userTokenSet = this.userTokens.get(userId);
    if (!userTokenSet || userTokenSet.size < this.config.maxTokensPerUser) {
      return;
    }
    
    // ユーザーのトークンを作成時刻でソート
    const userTokenData = Array.from(userTokenSet)
      .map(token => ({ token, data: this.tokenStore.get(token)! }))
      .filter(item => item.data)
      .sort((a, b) => a.data.created - b.data.created);
    
    // 古いトークンを削除
    while (userTokenData.length >= this.config.maxTokensPerUser) {
      const oldest = userTokenData.shift();
      if (oldest) {
        this.tokenStore.delete(oldest.token);
        userTokenSet.delete(oldest.token);
        
        logger.debug('[Token Rotation] Removed old token due to limit', {
          userId,
          tokenAge: Math.floor((Date.now() - oldest.data.created) / 1000 / 60) + ' minutes',
        });
      }
    }
  }
  
  /**
   * 統計情報を取得
   */
  getStatistics(): {
    totalTokens: number;
    activeTokens: number;
    expiredTokens: number;
    usersWithTokens: number;
    averageTokenAge: number;
  } {
    const now = Date.now();
    let activeCount = 0;
    let expiredCount = 0;
    let totalAge = 0;
    
    for (const data of this.tokenStore.values()) {
      if (now < data.expires) {
        activeCount++;
      } else {
        expiredCount++;
      }
      totalAge += (now - data.created);
    }
    
    return {
      totalTokens: this.tokenStore.size,
      activeTokens: activeCount,
      expiredTokens: expiredCount,
      usersWithTokens: this.userTokens.size,
      averageTokenAge: this.tokenStore.size > 0 
        ? Math.floor(totalAge / this.tokenStore.size / 1000 / 60) // 分単位
        : 0,
    };
  }
  
  /**
   * 設定を更新
   */
  updateConfig(config: Partial<TokenRotationConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
    
    logger.info('[Token Rotation] Configuration updated', { ...this.config });
  }
  
  /**
   * リセット（テスト用）
   */
  reset(): void {
    this.tokenStore.clear();
    this.userTokens.clear();
    logger.info('[Token Rotation] Token store reset');
  }
}

// グローバル宣言（TypeScript用）
declare global {
  var csrfCleanupInterval: NodeJS.Timeout | undefined;
}