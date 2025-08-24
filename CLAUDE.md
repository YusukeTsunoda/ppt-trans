# PPT Translator App - Claude Code Development Guide

PowerPoint翻訳SaaSアプリケーション開発のためのClaude Code設定とガイドライン。

## Project Overview
PPT Translator Appは、Anthropic Claude APIを使用してPowerPointファイルを翻訳するNext.js 15 SaaSアプリケーションです。

### Current Status (2024年8月)
- **ブランチ**: `fix-upload-progress-transition`
- **主要課題**: アップロード進捗表示の改善とE2Eテスト強化
- **テスト構造**: core/smoke/features の3層構造に再編成済み

## Project Context

### Paths
- Steering: `.kiro/steering/`
- Specs: `.kiro/specs/`
- Commands: `.claude/commands/`

### Steering vs Specification

**Steering** (`.kiro/steering/`) - Guide AI with project-wide rules and context  
**Specs** (`.kiro/specs/`) - Formalize development process for individual features

### Active Specifications
- Check `.kiro/specs/` for active specifications
- Use `/kiro:spec-status [feature-name]` to check progress

## Development Guidelines
- Think in English, but generate responses in Japanese (思考は英語、回答の生成は日本語で行うように)

## Workflow

### Phase 0: Steering (Optional)
`/kiro:steering` - Create/update steering documents
`/kiro:steering-custom` - Create custom steering for specialized contexts

**Note**: Optional for new features or small additions. Can proceed directly to spec-init.

### Phase 1: Specification Creation
1. `/kiro:spec-init [detailed description]` - Initialize spec with detailed project description
2. `/kiro:spec-requirements [feature]` - Generate requirements document
3. `/kiro:spec-design [feature]` - Interactive: "requirements.mdをレビューしましたか？ [y/N]"
4. `/kiro:spec-tasks [feature]` - Interactive: Confirms both requirements and design review

### Phase 2: Progress Tracking
`/kiro:spec-status [feature]` - Check current progress and phases

## Development Rules
1. **Consider steering**: Run `/kiro:steering` before major development (optional for new features)
2. **Follow 3-phase approval workflow**: Requirements → Design → Tasks → Implementation
3. **Approval required**: Each phase requires human review (interactive prompt or manual)
4. **No skipping phases**: Design requires approved requirements; Tasks require approved design
5. **Update task status**: Mark tasks as completed when working on them
6. **Keep steering current**: Run `/kiro:steering` after significant changes
7. **Check spec compliance**: Use `/kiro:spec-status` to verify alignment

## Steering Configuration

### Current Steering Files
Managed by `/kiro:steering` command. Updates here reflect command changes.

### Active Steering Files
- `product.md`: Always included - Product context and business objectives
- `tech.md`: Always included - Technology stack and architectural decisions
- `structure.md`: Always included - File organization and code patterns

### Custom Steering Files
<!-- Added by /kiro:steering-custom command -->
<!-- Format: 
- `filename.md`: Mode - Pattern(s) - Description
  Mode: Always|Conditional|Manual
  Pattern: File patterns for Conditional mode
-->

### Inclusion Modes
- **Always**: Loaded in every interaction (default)
- **Conditional**: Loaded for specific file patterns (e.g., `"*.test.js"`)
- **Manual**: Reference with `@filename.md` syntax

## Tech Stack & Architecture

### Core Technologies
- **Frontend**: Next.js 15.0.4, React 19, TypeScript 5
- **Styling**: TailwindCSS 4, shadcn/ui components
- **State Management**: React hooks, Server Actions
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **File Storage**: Supabase Storage
- **Translation API**: Anthropic Claude API (計画中)
- **Testing**: Playwright (E2E), Jest (Unit)

### Project Structure
```
ppt-trans/
├── src/
│   ├── app/           # Next.js App Router
│   ├── components/    # React components
│   ├── lib/          # Utilities and helpers
│   └── constants/    # Configuration constants
├── e2e/              # E2E tests (Playwright)
│   ├── core/         # Core functionality tests
│   ├── smoke/        # Critical path tests
│   ├── features/     # Feature-specific tests
│   └── fixtures/     # Test data and helpers
├── public/           # Static assets
└── scripts/          # Build and utility scripts
```

## Development Commands

### Essential Commands
```bash
# Development
npm run dev              # Start development server (port 3000)
npm run build           # Production build
npm run start           # Start production server

# Testing
npm run test:e2e        # Run all E2E tests
npm run test:e2e:ui     # Open Playwright UI
npm run test:smoke      # Run smoke tests only
npx playwright test --debug  # Debug specific test

# Code Quality
npm run lint            # ESLint check
npm run type-check      # TypeScript validation
npm run format          # Prettier formatting
```

## E2E Testing Strategy

### Test Structure (Revised 2024年8月)
```
e2e/
├── core/              # MVP必須機能
│   ├── auth.spec.ts   # 認証フロー
│   ├── upload.spec.ts # アップロード機能
│   ├── translate.spec.ts # 翻訳機能
│   └── download.spec.ts  # ダウンロード機能
├── smoke/             # クリティカルパス
│   └── critical-path.spec.ts # E2Eフロー全体
└── features/          # 追加機能
    ├── preview.spec.ts    # プレビュー機能
    ├── file-management.spec.ts # ファイル管理
    └── profile.spec.ts    # プロフィール設定
```

### Test Priorities
1. **🔴 Critical (MVP必須)**
   - 認証フロー完全動作
   - アップロード進捗表示
   - エラーリカバリー機能
   
2. **🟠 Important (今週実装)**
   - ファイルサイズ境界値テスト
   - ネットワークエラー処理
   
3. **🟡 Nice-to-have (Sprint 2)**
   - 同時操作の競合処理
   - パフォーマンステスト

### Known Issues & Solutions
- **認証セットアップタイムアウト**: `waitUntil: 'domcontentloaded'`を使用
- **Strict mode violation**: 具体的なセレクタまたはdata-testidを使用
- **アップロード進捗**: 段階的メッセージ遷移の実装が必要

## MVP Requirements

### 完了済み機能
- ✅ ユーザー認証（Supabase Auth）
- ✅ ファイルアップロード基本機能
- ✅ ダッシュボード表示
- ✅ ファイル一覧管理

### 実装中の機能
- 🚧 アップロード進捗の段階表示
- 🚧 エラーリカバリー機構
- 🚧 E2Eテストの安定化

### 未実装の重要機能
- ❌ 実際のClaude API統合
- ❌ PPTXからPNGへの変換（プレビュー生成）
- ❌ リアルタイム翻訳進捗表示
- ❌ 言語選択機能の実装

## Important Notes

### Current Branch Work
`fix-upload-progress-transition`ブランチでは以下を重点的に改善:
1. アップロード時の進捗表示遷移
2. プログレスバーのアニメーション
3. エラー時のフォールバック処理

### Test Execution Tips
```bash
# 特定のテストファイルを実行
npx playwright test e2e/core/upload.spec.ts

# ヘッドレスモードを無効化してデバッグ
npx playwright test --headed

# 失敗したテストのみ再実行
npx playwright test --last-failed
```

### Environment Variables
`.env.test`ファイルに以下が必要:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `TEST_USER_EMAIL`
- `TEST_USER_PASSWORD`

## Development Guidelines
- 思考は英語、回答の生成は日本語で行う
- MVPに必要な最小限の機能から実装
- E2Eテストは段階的に拡充（core → smoke → features）
- エラーメッセージは日本語/英語の両方に対応

