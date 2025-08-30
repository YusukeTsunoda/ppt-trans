# 🧪 テストカバレッジ詳細分析と改善実装計画

**分析日時**: 2025-01-26  
**プロジェクト**: PowerPoint Translator  
**現在のカバレッジ**: 2.13% (極めて低い)

---

## 📊 現状分析

### テストファイル分布
```
総テストファイル数: 402
├── Unit Tests: 352ファイル
│   ├── tests/components: 15ファイル
│   ├── tests/hooks: 5ファイル
│   ├── tests/lib: 25ファイル
│   └── tests/app: 7ファイル
└── E2E Tests: 50ファイル
```

### 🔴 重大な問題
**実際のテストカバレッジ: 2.13%**
- Statements: 2.13%
- Branches: 1.40%
- Functions: 1.70%
- Lines: 2.21%

402個のテストファイルが存在するにも関わらず、実際のカバレッジが極端に低い。これは多くのテストファイルが：
1. 空またはスケルトン状態
2. 実装されていない
3. スキップされている

---

## 🚨 カバレッジ不足の重要領域

### 1. 完全に欠落しているテスト

#### 🔴 Landingページコンポーネント（0%カバレッジ）
```
src/components/landing/
├── Hero.tsx        ❌ テストなし
├── Features.tsx    ❌ テストなし
├── Pricing.tsx     ❌ テストなし
├── HowItWorks.tsx  ❌ テストなし
├── Header.tsx      ❌ テストなし
└── Footer.tsx      ❌ テストなし
```

#### 🔴 Server Actions（部分的カバレッジ）
```
src/app/actions/
├── auth.ts         ✅ テストあり
├── dashboard.ts    ✅ テストあり
├── files.ts        ❌ テストなし
├── generation.ts   ❌ テストなし
├── profile.ts      ❌ テストなし
├── upload.ts       ❌ テストなし
└── types.ts        ❌ テストなし
```

#### 🔴 重要なビジネスロジック
```
src/lib/
├── translation/TranslationManager.ts  ⚠️ 部分的
├── cache/CacheManager.ts             ⚠️ 部分的
├── upload/FileUploadManager.ts       ❌ テストなし
├── download/DownloadManager.ts       ❌ テストなし
└── api/ApiClient.ts                  ❌ テストなし
```

### 2. E2Eテストのギャップ
```
クリティカルパス:
1. ユーザー登録 → ログイン         ⚠️ 部分的
2. ファイルアップロード           ⚠️ 部分的
3. 翻訳処理                      ⚠️ 部分的
4. プレビュー                    ❌ 不完全
5. ダウンロード                  ❌ 不完全
```

---

## 📋 具体的な改善実装計画

### フェーズ1: 基盤整備（1週間）

#### 1.1 テスト環境の修正
```bash
# jest.config.jsの更新
module.exports = {
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/types.ts',
    '!src/**/*.stories.tsx'
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jsdom'
};
```

#### 1.2 テストユーティリティ作成
```typescript
// tests/utils/test-helpers.ts
import { render as rtlRender } from '@testing-library/react';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AuthProvider } from '@/components/AuthProvider';

export function renderWithProviders(ui: React.ReactElement) {
  return rtlRender(
    <AuthProvider>
      <ThemeProvider>
        {ui}
      </ThemeProvider>
    </AuthProvider>
  );
}

// tests/utils/mock-data.ts
export const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  role: 'user'
};

export const mockFile = {
  id: 'file-id',
  filename: 'test.pptx',
  original_name: 'presentation.pptx',
  file_size: 1024000,
  status: 'uploaded'
};
```

### フェーズ2: Critical Path Tests（2週間）

#### 2.1 Landingページコンポーネントテスト
```typescript
// tests/components/landing/Hero.test.tsx
import { render, screen } from '@testing-library/react';
import { Hero } from '@/components/landing/Hero';

describe('Hero Component', () => {
  it('メインタイトルを表示する', () => {
    render(<Hero />);
    expect(screen.getByText(/PowerPointを/)).toBeInTheDocument();
    expect(screen.getByText(/瞬時に翻訳/)).toBeInTheDocument();
  });

  it('CTAボタンが正しく表示される', () => {
    render(<Hero />);
    expect(screen.getByText('無料で始める')).toBeInTheDocument();
    expect(screen.getByText('今すぐアップロード')).toBeInTheDocument();
  });

  it('適切なリンク先を持つ', () => {
    render(<Hero />);
    const registerLink = screen.getByRole('link', { name: /無料で始める/ });
    expect(registerLink).toHaveAttribute('href', '/register');
  });
});
```

#### 2.2 Server Actions統合テスト
```typescript
// tests/app/actions/upload.test.ts
import { uploadFileAction } from '@/app/actions/upload';
import { createClient } from '@/lib/supabase/server';

jest.mock('@/lib/supabase/server');

describe('uploadFileAction', () => {
  const mockSupabase = {
    storage: {
      from: jest.fn().mockReturnThis(),
      upload: jest.fn()
    },
    from: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn()
  };

  beforeEach(() => {
    (createClient as jest.Mock).mockResolvedValue(mockSupabase);
  });

  it('ファイルを正常にアップロードする', async () => {
    const formData = new FormData();
    const file = new File(['content'], 'test.pptx', { 
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' 
    });
    formData.append('file', file);

    mockSupabase.storage.upload.mockResolvedValue({
      data: { path: 'uploads/test.pptx' },
      error: null
    });

    mockSupabase.single.mockResolvedValue({
      data: { id: 'file-id', filename: 'test.pptx' },
      error: null
    });

    const result = await uploadFileAction(null, formData);

    expect(result.success).toBe(true);
    expect(result.file).toBeDefined();
    expect(mockSupabase.storage.upload).toHaveBeenCalled();
  });

  it('大きすぎるファイルを拒否する', async () => {
    const formData = new FormData();
    const largeContent = new Array(101 * 1024 * 1024).join('a'); // 101MB
    const file = new File([largeContent], 'large.pptx');
    formData.append('file', file);

    const result = await uploadFileAction(null, formData);

    expect(result.success).toBe(false);
    expect(result.error).toContain('100MB');
  });
});
```

#### 2.3 E2E Critical Path
```typescript
// e2e/critical-user-journey.spec.ts
import { test, expect } from '@playwright/test';

test.describe('ユーザージャーニー全体フロー', () => {
  test('新規ユーザーの登録から翻訳完了まで', async ({ page }) => {
    // 1. LPページ訪問
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('PowerPointを');
    
    // 2. 登録
    await page.click('text=無料で始める');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'Test123!');
    await page.click('button[type="submit"]');
    
    // 3. ダッシュボード確認
    await expect(page).toHaveURL('/dashboard');
    
    // 4. ファイルアップロード
    await page.click('text=新規アップロード');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('tests/fixtures/sample.pptx');
    await page.click('text=アップロード');
    
    // 5. 翻訳実行
    await page.click('text=翻訳');
    await expect(page.locator('.progress-bar')).toBeVisible();
    
    // 6. 完了確認
    await expect(page.locator('text=翻訳完了')).toBeVisible({ timeout: 30000 });
  });
});
```

### フェーズ3: ビジネスロジックテスト（1週間）

#### 3.1 TranslationManager完全テスト
```typescript
// tests/lib/translation/TranslationManager.test.ts
describe('TranslationManager', () => {
  describe('translateText', () => {
    it('短いテキストを翻訳する', async () => {
      // 実装
    });
    
    it('長いテキストを分割して翻訳する', async () => {
      // 実装
    });
    
    it('専門用語辞書を適用する', async () => {
      // 実装
    });
    
    it('エラー時にリトライする', async () => {
      // 実装
    });
  });
});
```

### フェーズ4: カバレッジ目標達成（2週間）

#### 目標メトリクス
```
Week 1: 20% → 40%
Week 2: 40% → 60%
Week 3: 60% → 75%
Week 4: 75% → 80%
```

#### 優先順位マトリックス
| コンポーネント | 重要度 | 現在 | 目標 | 工数 |
|--------------|--------|------|------|------|
| Server Actions | 🔴高 | 30% | 90% | 3日 |
| Landing Pages | 🔴高 | 0% | 80% | 2日 |
| Upload Flow | 🔴高 | 20% | 90% | 2日 |
| Translation | 🔴高 | 15% | 85% | 3日 |
| Dashboard | 🟡中 | 40% | 80% | 2日 |
| Profile | 🟢低 | 10% | 60% | 1日 |

---

## 🚀 実装スケジュール

### Week 1: 基盤とCritical Path
- [ ] Day 1-2: テスト環境修正、ユーティリティ作成
- [ ] Day 3-4: Landingページテスト実装
- [ ] Day 5: Server Actions (upload, files)テスト

### Week 2: ビジネスロジック
- [ ] Day 1-2: TranslationManagerテスト
- [ ] Day 3-4: CacheManager, FileUploadManagerテスト
- [ ] Day 5: APIクライアントテスト

### Week 3: E2E強化
- [ ] Day 1-2: Critical User Journeyテスト
- [ ] Day 3-4: エラーケース、エッジケース
- [ ] Day 5: パフォーマンステスト

### Week 4: 品質向上
- [ ] Day 1-2: 残りのコンポーネントテスト
- [ ] Day 3: カバレッジギャップ分析
- [ ] Day 4-5: 最終調整、CI/CD統合

---

## 📈 成功指標

### 必須達成項目
1. **カバレッジ80%以上**
2. **Critical Pathの100%カバー**
3. **全Server Actionsのテスト実装**
4. **E2E主要フロー5本以上**

### CI/CD統合
```yaml
# .github/workflows/test.yml
- name: Run tests with coverage
  run: |
    npm test -- --coverage
    npm run test:e2e
    
- name: Coverage Check
  run: |
    npm run coverage:check
    
- name: Upload coverage
  uses: codecov/codecov-action@v3
```

### 監視メトリクス
- テスト実行時間: < 5分
- E2Eテスト安定性: > 95%
- カバレッジトレンド: 週10%向上

---

## 🎯 結論

現在のテストカバレッジ2.13%は危機的レベルです。402個のテストファイルの多くが未実装または不完全な状態。

**緊急対応が必要**:
1. Week 1でCritical Pathの基本テストを実装
2. Week 2-3でビジネスロジックをカバー
3. Week 4で80%カバレッジ達成

この計画により、4週間で本番環境に適したテストカバレッジを実現できます。