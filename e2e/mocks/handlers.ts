import { http, HttpResponse } from 'msw';

/**
 * MSW (Mock Service Worker) ハンドラー定義
 * Server ActionsとAPIリクエストをモック化
 */

// テスト環境のベースURL
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

/**
 * 認証関連のモック
 */
export const authHandlers = [
  // Supabase認証エンドポイントのモック
  http.post('*/auth/v1/token', async ({ request }) => {
    const body = await request.json() as any;
    
    // テストユーザーの認証情報を確認
    if (body.email === 'test@example.com' && body.password === 'password123') {
      return HttpResponse.json({
        access_token: 'mock-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'mock-refresh-token',
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
          role: 'authenticated'
        }
      });
    }
    
    // 認証失敗
    return HttpResponse.json(
      { error: 'Invalid login credentials' },
      { status: 400 }
    );
  }),

  // セッション取得のモック
  http.get('*/auth/v1/user', () => {
    return HttpResponse.json({
      id: 'test-user-id',
      email: 'test@example.com',
      role: 'authenticated',
      created_at: new Date().toISOString()
    });
  }),

  // ログアウトのモック
  http.post('*/auth/v1/logout', () => {
    return HttpResponse.json({ success: true });
  })
];

/**
 * ファイル操作のモック
 */
export const fileHandlers = [
  // ファイル一覧取得
  http.get('*/api/files', () => {
    return HttpResponse.json({
      files: [
        {
          id: 'file-1',
          name: 'test-presentation.pptx',
          size: 1024000,
          createdAt: new Date().toISOString(),
          status: 'completed'
        }
      ]
    });
  }),

  // ファイルアップロード
  http.post('*/api/upload', async ({ request }) => {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (file && file.name.endsWith('.pptx')) {
      return HttpResponse.json({
        success: true,
        fileId: 'new-file-id',
        message: 'ファイルがアップロードされました'
      });
    }
    
    return HttpResponse.json(
      { error: 'Invalid file format' },
      { status: 400 }
    );
  }),

  // ファイル削除
  http.delete('*/api/files/:id', ({ params }) => {
    return HttpResponse.json({
      success: true,
      message: `File ${params.id} deleted`
    });
  })
];

/**
 * 翻訳APIのモック
 */
export const translationHandlers = [
  // 翻訳リクエスト
  http.post('*/api/translate', async ({ request }) => {
    const body = await request.json() as any;
    
    return HttpResponse.json({
      success: true,
      translationId: 'translation-123',
      status: 'processing',
      estimatedTime: 30
    });
  }),

  // 翻訳ステータス確認
  http.get('*/api/translate/:id/status', ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      status: 'completed',
      downloadUrl: `/api/download/${params.id}`
    });
  })
];

/**
 * Server Actionsのモック
 * Next.jsのServer Actionsをインターセプト
 */
export const serverActionHandlers = [
  // loginActionのモック
  http.post(`${BASE_URL}/*`, async ({ request }) => {
    const url = new URL(request.url);
    
    // Server Actionの判定（Next.jsの内部実装に依存）
    if (request.headers.get('Next-Action')) {
      const formData = await request.formData();
      const email = formData.get('email');
      const password = formData.get('password');
      
      if (email === 'test@example.com' && password === 'password123') {
        // 成功レスポンス
        return HttpResponse.json({
          success: true,
          message: 'ログインに成功しました',
          redirect: '/dashboard'
        });
      }
      
      // エラーレスポンス
      return HttpResponse.json({
        success: false,
        error: '認証に失敗しました'
      });
    }
    
    // Server Actionでない場合はスルー
    return HttpResponse.json({});
  })
];

/**
 * デフォルトハンドラー
 * すべてのモックハンドラーを統合
 */
export const handlers = [
  ...authHandlers,
  ...fileHandlers,
  ...translationHandlers,
  ...serverActionHandlers
];

/**
 * エラーシナリオ用のハンドラー
 * ネットワークエラーやサーバーエラーをシミュレート
 */
export const errorHandlers = {
  // ネットワークエラー
  networkError: [
    http.post('*/api/*', () => {
      return HttpResponse.error();
    }),
    http.get('*/api/*', () => {
      return HttpResponse.error();
    })
  ],

  // サーバーエラー (500)
  serverError: [
    http.post('*/api/*', () => {
      return HttpResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 }
      );
    }),
    http.get('*/api/*', () => {
      return HttpResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 }
      );
    })
  ],

  // レート制限エラー (429)
  rateLimitError: [
    http.post('*/api/*', () => {
      return HttpResponse.json(
        { error: 'Too Many Requests' },
        { 
          status: 429,
          headers: {
            'Retry-After': '60'
          }
        }
      );
    })
  ],

  // タイムアウト
  timeout: [
    http.post('*/api/*', async () => {
      await new Promise(resolve => setTimeout(resolve, 35000)); // 35秒待機
      return HttpResponse.json({ success: true });
    })
  ]
};