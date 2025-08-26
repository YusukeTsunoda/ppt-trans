import { login, signupAction, logout, resetPassword } from '@/app/actions/auth';
import { createClient } from '@/lib/supabase/server';
import { aUser, aSupabaseMock, aSupabaseResponse, aFormData } from '../../builders';
import { fixtures } from '../../fixtures';

// Supabaseクライアントのモック
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn()
}));

describe('Auth Actions', () => {
  let mockSupabase: ReturnType<typeof aSupabaseMock>['build'];

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = aSupabaseMock()
      .withAuth()
      .build();
    (createClient as jest.Mock).mockResolvedValue(mockSupabase);
  });

  describe('login', () => {
    it('正常なログインを処理する', async () => {
      const mockUser = aUser()
        .withEmail('test@example.com')
        .build();

      mockSupabase.auth.signInWithPassword.mockResolvedValue(
        aSupabaseResponse()
          .withData({ user: mockUser })
          .build()
      );

      const formData = aFormData()
        .withField('email', 'test@example.com')
        .withField('password', 'Test123!')
        .build();

      const result = await login(formData);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Login successful');
      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'Test123!'
      });
    });

    it('無効な資格情報でエラーを返す', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue(
        aSupabaseResponse()
          .withError('Invalid credentials')
          .build()
      );

      const formData = aFormData()
        .withField('email', 'test@example.com')
        .withField('password', 'wrong')
        .build();

      const result = await login(formData);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid credentials');
    });

    it('空のフィールドでバリデーションエラーを返す', async () => {
      const formData = aFormData()
        .withField('email', '')
        .withField('password', '')
        .build();

      const result = await login(formData);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid input');
    });
  });

  describe('signupAction', () => {
    it('正常な登録を処理する', async () => {
      const mockUser = aUser()
        .withEmail('new@example.com')
        .build();

      mockSupabase.auth.signUp.mockResolvedValue(
        aSupabaseResponse()
          .withData({ user: mockUser })
          .build()
      );

      const formData = aFormData()
        .withField('email', 'new@example.com')
        .withField('password', 'Test123!')
        .withField('confirmPassword', 'Test123!')
        .build();

      const result = await signupAction(formData);

      expect(result.success).toBe(true);
      expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'Test123!'
      });
    });

    it('パスワード不一致でエラーを返す', async () => {
      const formData = aFormData()
        .withField('email', 'new@example.com')
        .withField('password', 'Test123!')
        .withField('confirmPassword', 'Different123!')
        .build();

      const result = await signupAction(formData);

      expect(result.success).toBe(false);
      expect(result.message).toContain('パスワードが一致しません');
    });

    it('弱いパスワードでエラーを返す', async () => {
      const formData = aFormData()
        .withField('email', 'new@example.com')
        .withField('password', '123')
        .withField('confirmPassword', '123')
        .build();

      const result = await signupAction(formData);

      expect(result.success).toBe(false);
      expect(result.message).toContain('パスワードは6文字以上');
    });

    it('既存のメールアドレスでエラーを返す', async () => {
      mockSupabase.auth.signUp.mockResolvedValue(
        aSupabaseResponse()
          .withError('User already registered')
          .build()
      );

      const formData = aFormData()
        .withField('email', 'existing@example.com')
        .withField('password', 'Test123!')
        .withField('confirmPassword', 'Test123!')
        .build();

      const result = await signupAction(formData);

      expect(result.success).toBe(false);
      expect(result.message).toBe('User already registered');
    });
  });

  describe('logout', () => {
    it('正常なログアウトを処理する', async () => {
      mockSupabase.auth.signOut.mockResolvedValue(
        aSupabaseResponse()
          .withData({})
          .build()
      );

      const result = await logout();

      expect(result.success).toBe(true);
      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    });

    it('ログアウトエラーを処理する', async () => {
      mockSupabase.auth.signOut.mockResolvedValue(
        aSupabaseResponse()
          .withError('Logout failed')
          .build()
      );

      const result = await logout();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Logout failed');
    });
  });

  describe('resetPassword', () => {
    it('パスワードリセットメールを送信する', async () => {
      mockSupabase.auth.resetPasswordForEmail.mockResolvedValue(
        aSupabaseResponse()
          .withData({})
          .build()
      );

      const formData = aFormData()
        .withField('email', 'forgot@example.com')
        .build();

      const result = await resetPassword(formData);

      expect(result.success).toBe(true);
      expect(result.message).toContain('パスワードリセットのメールを送信しました');
      expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'forgot@example.com',
        expect.objectContaining({
          redirectTo: expect.stringContaining('/reset-password')
        })
      );
    });

    it('無効なメールアドレスでエラーを返す', async () => {
      const formData = aFormData()
        .withField('email', 'invalid-email')
        .build();

      const result = await resetPassword(formData);

      expect(result.success).toBe(false);
      expect(result.message).toContain('有効なメールアドレスを入力してください');
    });

    it('存在しないメールアドレスでも成功を返す（セキュリティ）', async () => {
      mockSupabase.auth.resetPasswordForEmail.mockResolvedValue(
        aSupabaseResponse()
          .withError('User not found')
          .build()
      );

      const formData = aFormData()
        .withField('email', 'nonexistent@example.com')
        .build();

      const result = await resetPassword(formData);

      // セキュリティのため、存在しないメールでも成功を返す
      expect(result.success).toBe(true);
      expect(result.message).toContain('パスワードリセットのメールを送信しました');
    });
  });
});