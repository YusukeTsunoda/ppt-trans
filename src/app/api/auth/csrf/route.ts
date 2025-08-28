import { NextRequest, NextResponse } from 'next/server';
import { CSRFProtection } from '@/lib/security/csrf';

/**
 * CSRFトークンを生成・取得するエンドポイント
 * クライアントはフォーム送信前にこのエンドポイントを呼び出してトークンを取得
 */
export async function GET(request: NextRequest) {
  try {
    // CSRFトークンを生成または取得
    const token = await CSRFProtection.getOrGenerateToken();
    
    const response = NextResponse.json({
      success: true,
      csrfToken: token,
    });

    // キャッシュを無効化（毎回新しいトークンを確認）
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  } catch (error) {
    console.error('CSRF token generation error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'トークンの生成に失敗しました',
      },
      { status: 500 }
    );
  }
}