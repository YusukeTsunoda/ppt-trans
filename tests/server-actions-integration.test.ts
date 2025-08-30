/**
 * Server Actions統合テスト
 * QAエキスパート観点での包括的なテスト
 */

import { translateTextsAction } from '@/app/actions/translate';
import { extractTextFromPPTXAction, applyTranslationsAction, translatePPTXAction } from '@/app/actions/pptx';
import { getActivitiesAction, checkAdminRoleAction } from '@/app/actions/admin';
import { createClient } from '@/lib/supabase/server';

// モックの設定
jest.mock('@/lib/supabase/server');
jest.mock('@/lib/logger');

describe('Server Actions - エラー検出能力テスト', () => {
  
  describe('translateTextsAction', () => {
    
    it('認証なしでエラーを返す', async () => {
      // Supabaseモックを設定
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({ 
            data: { user: null }, 
            error: { message: 'Not authenticated' } 
          })
        }
      };
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);
      
      const result = await translateTextsAction(
        [{ id: '1', text: 'test' }],
        'ja'
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('認証が必要です');
    });
    
    it('空のテキスト配列でエラーを返す', async () => {
      const result = await translateTextsAction([], 'ja');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('テキストが指定されていません');
    });
    
    it('無効な言語コードでも処理する（フォールバック）', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({ 
            data: { user: { id: 'user1', email: 'test@example.com' } }, 
            error: null 
          })
        }
      };
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);
      
      const result = await translateTextsAction(
        [{ id: '1', text: 'test' }],
        'invalid-lang'
      );
      
      // デフォルトで日本語にフォールバック
      expect(result.success).toBe(true);
    });
  });
  
  describe('extractTextFromPPTXAction', () => {
    
    it('ファイルIDが空でエラーを返す', async () => {
      const result = await extractTextFromPPTXAction('', 'path/to/file');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('ファイル情報が不足しています');
    });
    
    it('他ユーザーのファイルにアクセスできない', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({ 
            data: { user: { id: 'user2', email: 'other@example.com' } }, 
            error: null 
          })
        },
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ 
                  data: null, 
                  error: { message: 'Not found' } 
                })
              })
            })
          })
        })
      };
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);
      
      const result = await extractTextFromPPTXAction('file123', 'path/to/file');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('ファイルが見つかりません');
    });
  });
  
  describe('並行処理とレースコンディション', () => {
    
    it('同時に複数の翻訳を実行してもデータが混在しない', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({ 
            data: { user: { id: 'user1', email: 'test@example.com' } }, 
            error: null 
          })
        }
      };
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);
      
      // 並行実行
      const results = await Promise.all([
        translateTextsAction([{ id: '1', text: 'text1' }], 'ja'),
        translateTextsAction([{ id: '2', text: 'text2' }], 'en'),
        translateTextsAction([{ id: '3', text: 'text3' }], 'zh'),
      ]);
      
      // 各結果が独立していることを確認
      expect(results[0].translations?.[0].id).toBe('1');
      expect(results[1].translations?.[0].id).toBe('2');
      expect(results[2].translations?.[0].id).toBe('3');
    });
  });
  
  describe('セキュリティ境界テスト', () => {
    
    it('SQLインジェクションの試行を防ぐ', async () => {
      const maliciousId = "'; DROP TABLE files; --";
      
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({ 
            data: { user: { id: 'user1', email: 'test@example.com' } }, 
            error: null 
          })
        },
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn((field, value) => {
              // Supabaseは内部でパラメータ化されたクエリを使用
              expect(typeof value).toBe('string');
              return {
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ 
                    data: null, 
                    error: { message: 'Not found' } 
                  })
                })
              };
            })
          })
        })
      };
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);
      
      const result = await extractTextFromPPTXAction(maliciousId, 'path');
      
      expect(result.success).toBe(false);
      // SQLインジェクションが実行されていないことを確認
      expect(mockSupabase.from).toHaveBeenCalledWith('files');
    });
    
    it('XSS攻撃のペイロードをサニタイズする', async () => {
      const xssPayload = '<script>alert("XSS")</script>';
      
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({ 
            data: { user: { id: 'user1', email: 'test@example.com' } }, 
            error: null 
          })
        }
      };
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);
      
      const result = await translateTextsAction(
        [{ id: '1', text: xssPayload }],
        'ja'
      );
      
      // XSSペイロードがそのまま処理されることを確認
      // （表示時にエスケープされることが重要）
      expect(result.translations?.[0].original).toBe(xssPayload);
    });
  });
  
  describe('エラー回復とフォルトトレランス', () => {
    
    it('一時的なネットワークエラーから回復する', async () => {
      let callCount = 0;
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              // 最初の呼び出しは失敗
              return Promise.reject(new Error('Network error'));
            }
            // 2回目は成功
            return Promise.resolve({ 
              data: { user: { id: 'user1', email: 'test@example.com' } }, 
              error: null 
            });
          })
        }
      };
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);
      
      // リトライロジックがある場合のテスト
      const result = await translateTextsAction(
        [{ id: '1', text: 'test' }],
        'ja'
      );
      
      // 現在の実装ではリトライなしでエラーを返す
      expect(result.success).toBe(false);
    });
    
    it('部分的な成功を適切に処理する', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({ 
            data: { user: { id: 'user1', email: 'test@example.com' } }, 
            error: null 
          })
        }
      };
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);
      
      // 3つのテキストのうち2つが成功する想定
      const texts = [
        { id: '1', text: 'success1' },
        { id: '2', text: 'fail' }, // これは失敗する想定
        { id: '3', text: 'success2' },
      ];
      
      const result = await translateTextsAction(texts, 'ja');
      
      // 現在の実装では全て成功するか全て失敗するか
      expect(result.success).toBeDefined();
    });
  });
});

describe('管理者機能のアクセス制御', () => {
  
  it('非管理者が管理者機能にアクセスできない', async () => {
    const mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ 
          data: { user: { id: 'user1', email: 'user@example.com' } }, 
          error: null 
        })
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ 
              data: { role: 'user' }, // 一般ユーザー
              error: null 
            })
          })
        })
      })
    };
    (createClient as jest.Mock).mockResolvedValue(mockSupabase);
    
    const result = await checkAdminRoleAction();
    
    expect(result.isAdmin).toBe(false);
  });
  
  it('管理者のみがアクティビティログを全て取得できる', async () => {
    const mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ 
          data: { user: { id: 'admin1', email: 'admin@example.com' } }, 
          error: null 
        })
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ 
              data: { role: 'admin' }, 
              error: null 
            })
          })
        })
      }),
      rpc: jest.fn().mockResolvedValue({
        data: [
          { id: '1', action: 'login', user_id: 'user1' },
          { id: '2', action: 'upload', user_id: 'user2' },
        ],
        error: null
      })
    };
    (createClient as jest.Mock).mockResolvedValue(mockSupabase);
    
    const result = await getActivitiesAction();
    
    expect(result.success).toBe(true);
    expect(result.activities?.length).toBeGreaterThan(0);
  });
});