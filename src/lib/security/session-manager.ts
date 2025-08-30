import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';

const SESSION_SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'your-secret-key-min-32-characters-long-for-security!!'
);
const SESSION_COOKIE_NAME = 'app-session';
const REFRESH_TOKEN_COOKIE_NAME = 'app-refresh-token';

export interface SessionData {
  userId: string;
  email: string;
  role: 'USER' | 'ADMIN';
  exp?: number;
  iat?: number;
  jti?: string; // JWT ID for revocation
}

export interface SessionToken {
  accessToken: string;
  refreshToken?: string;
}

export class SessionManager {
  // リボケーションリスト（実際の実装ではRedisやDBを使用）
  private static revokedTokens: Set<string> = new Set();

  /**
   * セッショントークンを作成
   */
  static async createSession(data: Omit<SessionData, 'exp' | 'iat' | 'jti'>): Promise<SessionToken> {
    const jti = randomUUID();
    
    // アクセストークンの作成（短期）
    const accessToken = await new SignJWT({
      ...data,
      jti,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('2h') // 2時間
      .sign(SESSION_SECRET);

    // リフレッシュトークンの作成（長期）
    const refreshToken = await new SignJWT({
      userId: data.userId,
      jti: `refresh-${jti}`,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d') // 7日間
      .sign(SESSION_SECRET);

    // HTTPOnly Cookieに保存
    const cookieStore = await cookies();
    
    cookieStore.set(SESSION_COOKIE_NAME, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // CSRFとユーザビリティのバランス
      path: '/',
      maxAge: 60 * 60 * 2, // 2時間
    });

    cookieStore.set(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict', // より厳格
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7日間
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * セッションを検証
   */
  static async verifySession(request: NextRequest): Promise<SessionData | null> {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    
    if (!token) {
      return null;
    }

    try {
      const { payload } = await jwtVerify(token, SESSION_SECRET);
      
      // JTIをチェック（リボケーション対応）
      if (payload.jti && this.isTokenRevoked(payload.jti as string)) {
        console.warn('[Session] Token has been revoked:', payload.jti);
        return null;
      }
      
      return payload as unknown as SessionData;
    } catch (error) {
      // トークンの有効期限切れの場合、リフレッシュを試みる
      if (error instanceof Error && error.message.includes('expired')) {
        return this.refreshSession(request);
      }
      
      console.error('[Session] Verification failed:', error);
      return null;
    }
  }

  /**
   * セッションを検証（validateSessionのエイリアス）
   */
  static async validateSession(request: NextRequest): Promise<SessionData | null> {
    return this.verifySession(request);
  }

  /**
   * セッションをリフレッシュ
   */
  private static async refreshSession(request: NextRequest): Promise<SessionData | null> {
    const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE_NAME)?.value;
    
    if (!refreshToken) {
      return null;
    }

    try {
      const { payload } = await jwtVerify(refreshToken, SESSION_SECRET);
      
      // リフレッシュトークンが有効な場合、新しいアクセストークンを発行
      // 実際の実装では、DBからユーザー情報を再取得する
      
      // この実装は簡略化されています
      // 実際にはユーザー情報をDBから取得する必要があります
      
      return null; // 簡略化のため
    } catch (error) {
      console.error('[Session] Refresh failed:', error);
      return null;
    }
  }

  /**
   * トークンのリボケーション確認
   */
  private static isTokenRevoked(jti: string): boolean {
    return this.revokedTokens.has(jti);
  }

  /**
   * トークンをリボーク
   */
  static async revokeToken(jti: string): Promise<void> {
    this.revokedTokens.add(jti);
    
    // 実際の実装ではRedisやDBに保存
    // await redis.set(`revoked:${jti}`, '1', { EX: 60 * 60 * 24 * 7 });
  }

  /**
   * セッションを破棄
   */
  static async destroySession(request?: NextRequest): Promise<void> {
    // 現在のセッションのJTIを取得してリボーク
    if (request) {
      const session = await this.verifySession(request);
      if (session?.jti) {
        await this.revokeToken(session.jti);
      }
    }

    // Cookieを削除
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE_NAME);
    cookieStore.delete(REFRESH_TOKEN_COOKIE_NAME);
  }

  /**
   * セッション情報を取得（検証なし）
   */
  static async getSessionInfo(token: string): Promise<SessionData | null> {
    try {
      const { payload } = await jwtVerify(token, SESSION_SECRET);
      return payload as unknown as SessionData;
    } catch {
      return null;
    }
  }
}