import { NextRequest } from 'next/server';
import { SecurityMonitor } from './security-monitor';
import logger from '@/lib/logger';

export class OriginValidator {
  private static allowedOrigins: Set<string>;
  
  static {
    // 環境変数から許可されたオリジンを設定
    const origins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 
                  process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('.supabase.co', '.vercel.app') || 
                  'http://localhost:3000';
    
    origins.push(appUrl);
    
    // 開発環境では localhost を追加
    if (process.env.NODE_ENV !== 'production') {
      origins.push('http://localhost:3000');
      origins.push('http://localhost:3001');
      origins.push('http://127.0.0.1:3000');
    }
    
    this.allowedOrigins = new Set(origins.filter(Boolean));
    
    console.log('[OriginValidator] Allowed origins:', Array.from(this.allowedOrigins));
  }

  static validate(request: NextRequest): boolean {
    // GETリクエストはスキップ
    if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
      return true;
    }

    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    
    // OriginヘッダーとRefererヘッダーの両方をチェック
    const requestOrigin = origin || (referer ? new URL(referer).origin : null);
    
    if (!requestOrigin) {
      // 同一オリジンの場合、ブラウザはOriginヘッダーを送信しないことがある
      // その場合はRefererヘッダーで確認
      console.warn('[Origin] No origin or referer header');
      
      // 本番環境では厳格に、開発環境では許容
      return process.env.NODE_ENV !== 'production';
    }

    if (!this.allowedOrigins.has(requestOrigin)) {
      console.error(`[Origin] Invalid origin: ${requestOrigin}`);
      console.error(`[Origin] Allowed origins: ${Array.from(this.allowedOrigins).join(', ')}`);
      
      // セキュリティモニターに記録
      const monitor = SecurityMonitor.getInstance();
      const requestId = crypto.randomUUID();
      const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
      const userAgent = request.headers.get('user-agent') || 'unknown';
      
      monitor.logEvent({
        type: 'origin_violation',
        severity: 'high',
        details: {
          invalidOrigin: requestOrigin,
          allowedOrigins: Array.from(this.allowedOrigins),
          referer,
        },
        requestId,
        ip: clientIP,
        userAgent,
        path: request.url,
        method: request.method,
      }).catch(error => {
        logger.error('[OriginValidator] Failed to log security event', { error });
      });
      
      return false;
    }

    return true;
  }

  /**
   * 許可するオリジンを追加（テスト用）
   */
  static addAllowedOrigin(origin: string): void {
    this.allowedOrigins.add(origin);
  }

  /**
   * 現在の許可されたオリジンのリストを取得
   */
  static getAllowedOrigins(): string[] {
    return Array.from(this.allowedOrigins);
  }
}