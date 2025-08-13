# PPT Translator App - 詳細要件書

## 1. はじめに

### 1.1 文書の目的
本書は、PPT Translator Appの実装に必要な詳細仕様を定義します。開発チームが実装時に参照すべき技術的詳細、データ構造、処理フロー、および実装上の注意点を記載します。

### 1.2 対象読者
- 開発エンジニア
- システムアーキテクト
- QAエンジニア
- プロジェクトマネージャー

### 1.3 関連文書
- 要件定義書（01_requirements_definition.md）
- 機能要件書（02_functional_requirements.md）
- 非機能要件書（03_non_functional_requirements.md）

## 2. システムアーキテクチャ

### 2.1 全体アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                   │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Pages     │  │  Components  │  │    Hooks     │      │
│  └─────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Layer (Next.js API Routes)           │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Auth API  │  │  File API    │  │ Translate API│      │
│  └─────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
┌──────────────────────┐      ┌──────────────────────┐
│   Database (PostgreSQL)│      │  Storage (Supabase)  │
│  ┌──────────────┐    │      │  ┌──────────────┐    │
│  │    Prisma    │    │      │  │     Files    │    │
│  └──────────────┘    │      │  └──────────────┘    │
└──────────────────────┘      └──────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              External Services                              │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Claude API  │  │  Supabase    │  │   Python     │      │
│  │             │  │     Auth     │  │   Scripts    │      │
│  └─────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 技術スタック（MVP構成）

| レイヤー | 技術/フレームワーク | バージョン | 用途 |
|---------|------------------|-----------|------|
| **フロントエンド** | | | |
| | Next.js | 15.4.6 | フルスタックフレームワーク |
| | React | 19.0.0 | UIライブラリ（Server Actions対応） |
| | TypeScript | 5.x | 型安全な開発 |
| | Tailwind CSS | 3.x | スタイリング・ダークモード対応 |
| | shadcn/ui | latest | UIコンポーネント |
| **バックエンド** | | | |
| | Vercel Functions | - | サーバーレスAPI |
| | Next.js Server Actions | 15.4.6 | サーバーアクション（React 19） |
| | Prisma | 6.x | ORM |
| | Python | 3.13+ | PPTX処理（python-pptx使用） |
| | UV | latest | Pythonパッケージマネージャー |
| **データベース** | | | |
| | Supabase Database | - | PostgreSQL（メインDB） |
| | Supabase Realtime | - | リアルタイム同期 |
| **認証・認可** | | | |
| | Supabase Auth | 2.x | 統合認証システム |
| | Row Level Security | - | データアクセス制御 |
| **ストレージ** | | | |
| | Supabase Storage | - | ファイル保存 |
| | Vercel Blob | - | 一時ファイル保存（オプション） |
| **決済** | | | |
| | Stripe | latest | サブスクリプション管理 |
| | Stripe Webhooks | - | 決済イベント処理 |
| **AI/ML** | | | |
| | Claude API | 3.5 | 翻訳エンジン |
| | 言語検出API | - | 自動言語判定 |
| **インフラ** | | | |
| | Vercel | - | ホスティング・デプロイ |
| | Vercel Edge Network | - | グローバルCDN |
| | GitHub Actions | - | CI/CD |

## 3. データベース設計

### 3.1 ERD（Entity Relationship Diagram）

```mermaid
erDiagram
    User ||--o{ File : uploads
    User ||--o{ Translation : requests
    User ||--o{ Subscription : has
    User ||--o{ UsageLog : generates
    User ||--o{ Session : has
    File ||--o{ Translation : has
    Translation ||--o{ TranslatedText : contains
    Translation ||--o{ TranslationHistory : has
    
    User {
        string id PK
        string email UK
        string name
        string avatarUrl
        enum role
        boolean isActive
        json settings
        datetime createdAt
        datetime updatedAt
        datetime lastLoginAt
    }
    
    File {
        string id PK
        string userId FK
        string fileName
        string originalFileUrl
        string translatedFileUrl
        int fileSize
        int totalSlides
        json metadata
        enum status
        datetime createdAt
        datetime updatedAt
    }
    
    Translation {
        string id PK
        string fileId FK
        string userId FK
        string sourceLanguage
        string targetLanguage
        string translationModel
        int totalTexts
        int translatedTexts
        enum status
        json options
        datetime startedAt
        datetime completedAt
    }
    
    TranslatedText {
        string id PK
        string translationId FK
        int slideNumber
        string textId
        text originalText
        text translatedText
        json position
        json style
        datetime createdAt
        datetime updatedAt
    }
```

### 3.2 テーブル定義

#### Users テーブル
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    avatar_url TEXT,
    role VARCHAR(50) DEFAULT 'USER',
    is_active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
```

#### Files テーブル
```sql
CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    original_file_url TEXT,
    translated_file_url TEXT,
    file_size INTEGER,
    total_slides INTEGER,
    metadata JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'UPLOADED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_files_user_id ON files(user_id);
CREATE INDEX idx_files_status ON files(status);
CREATE INDEX idx_files_created_at ON files(created_at DESC);
```

## 4. API詳細仕様

### 4.0 OpenAPI仕様

```yaml
# openapi.yaml
openapi: 3.0.3
info:
  title: PPT Translator API
  version: 1.0.0
  description: PowerPoint翻訳アプリケーションのAPI仕様
  contact:
    email: support@ppttranslator.com

servers:
  - url: https://api.ppttranslator.com/v1
    description: Production
  - url: https://staging-api.ppttranslator.com/v1
    description: Staging

security:
  - BearerAuth: []

paths:
  /auth/register:
    post:
      summary: ユーザー登録
      operationId: registerUser
      tags: [Auth]
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/RegisterRequest'
      responses:
        '201':
          description: 登録成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthResponse'
        '400':
          $ref: '#/components/responses/BadRequest'
        '409':
          $ref: '#/components/responses/Conflict'

  /files/upload:
    post:
      summary: PPTXファイルアップロード
      operationId: uploadFile
      tags: [Files]
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                file:
                  type: string
                  format: binary
                  description: PPTXファイル（最大50MB）
                metadata:
                  type: object
                  properties:
                    tags:
                      type: array
                      items:
                        type: string
              required:
                - file
      responses:
        '202':
          description: アップロード受付（非同期処理開始）
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UploadResponse'
        '400':
          $ref: '#/components/responses/BadRequest'
        '413':
          description: ファイルサイズ超過
        '415':
          description: 非対応ファイル形式
        '429':
          $ref: '#/components/responses/TooManyRequests'

  /translations/jobs:
    post:
      summary: 翻訳ジョブ作成
      operationId: createTranslationJob
      tags: [Translations]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/TranslationJobRequest'
      responses:
        '202':
          description: ジョブ作成成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TranslationJob'
        '400':
          $ref: '#/components/responses/BadRequest'
        '402':
          description: 使用量制限超過
        '429':
          $ref: '#/components/responses/TooManyRequests'

  /translations/jobs/{jobId}:
    get:
      summary: ジョブステータス取得
      operationId: getJobStatus
      tags: [Translations]
      parameters:
        - name: jobId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: ジョブ情報
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TranslationJob'
        '404':
          $ref: '#/components/responses/NotFound'

  /translations/jobs/{jobId}/cancel:
    post:
      summary: ジョブキャンセル
      operationId: cancelJob
      tags: [Translations]
      parameters:
        - name: jobId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: キャンセル成功
        '404':
          $ref: '#/components/responses/NotFound'
        '409':
          description: キャンセル不可（既に完了）

  /webhooks/stripe:
    post:
      summary: Stripe Webhook
      operationId: stripeWebhook
      tags: [Webhooks]
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
      responses:
        '200':
          description: Webhook処理成功
        '400':
          description: 署名検証失敗

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    RegisterRequest:
      type: object
      properties:
        email:
          type: string
          format: email
        password:
          type: string
          minLength: 8
        name:
          type: string
        organization:
          type: string
      required:
        - email
        - password

    AuthResponse:
      type: object
      properties:
        user:
          $ref: '#/components/schemas/User'
        session:
          type: object
          properties:
            access_token:
              type: string
            refresh_token:
              type: string
            expires_in:
              type: integer

    User:
      type: object
      properties:
        id:
          type: string
          format: uuid
        email:
          type: string
          format: email
        name:
          type: string
        role:
          type: string
          enum: [USER, ADMIN]
        plan:
          type: string
          enum: [FREE, STARTER, PROFESSIONAL, ENTERPRISE]

    UploadResponse:
      type: object
      properties:
        fileId:
          type: string
          format: uuid
        jobId:
          type: string
          format: uuid
        status:
          type: string
          enum: [queued, processing]
        estimatedTime:
          type: integer
          description: 推定処理時間（秒）

    TranslationJobRequest:
      type: object
      properties:
        fileId:
          type: string
          format: uuid
        sourceLanguage:
          type: string
          description: 自動検出の場合は省略
        targetLanguage:
          type: string
          enum: [ja, en, zh-CN, zh-TW, ko, th, vi, es, pt, de, fr]
        options:
          type: object
          properties:
            model:
              type: string
              enum: [claude-3-haiku, claude-3-sonnet]
            useTM:
              type: boolean
              default: true
            useTB:
              type: boolean
              default: true
            preserveFormatting:
              type: boolean
              default: true
      required:
        - fileId
        - targetLanguage

    TranslationJob:
      type: object
      properties:
        id:
          type: string
          format: uuid
        fileId:
          type: string
          format: uuid
        status:
          type: string
          enum: [queued, processing, completed, failed, cancelled]
        progress:
          type: integer
          minimum: 0
          maximum: 100
        createdAt:
          type: string
          format: date-time
        startedAt:
          type: string
          format: date-time
        completedAt:
          type: string
          format: date-time
        error:
          type: object
          properties:
            code:
              type: string
            message:
              type: string
        statistics:
          type: object
          properties:
            totalSlides:
              type: integer
            totalTexts:
              type: integer
            tmHits:
              type: integer
            tbHits:
              type: integer
            apiCalls:
              type: integer
            tokensUsed:
              type: integer

    Error:
      type: object
      properties:
        code:
          type: string
        message:
          type: string
        details:
          type: object

  responses:
    BadRequest:
      description: 不正なリクエスト
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
    
    Unauthorized:
      description: 認証エラー
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
    
    Forbidden:
      description: アクセス権限なし
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
    
    NotFound:
      description: リソースが見つからない
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
    
    Conflict:
      description: リソースの競合
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
    
    TooManyRequests:
      description: レート制限超過
      headers:
        X-RateLimit-Limit:
          schema:
            type: integer
        X-RateLimit-Remaining:
          schema:
            type: integer
        X-RateLimit-Reset:
          schema:
            type: integer
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'

tags:
  - name: Auth
    description: 認証関連
  - name: Files
    description: ファイル管理
  - name: Translations
    description: 翻訳処理
  - name: Webhooks
    description: Webhook処理
```

### 4.1 認証API

#### POST /api/auth/register
**リクエスト**
```typescript
interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
  organization?: string;
}
```

**レスポンス**
```typescript
interface RegisterResponse {
  success: boolean;
  data?: {
    user: {
      id: string;
      email: string;
      name?: string;
    };
    session: {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
  };
  error?: {
    code: string;
    message: string;
  };
}
```

**処理フロー**
```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Supabase
    participant Database
    
    Client->>API: POST /api/auth/register
    API->>API: Validate input
    API->>Supabase: Create auth user
    Supabase->>Database: Insert user record
    Database-->>Supabase: User created
    Supabase-->>API: Auth response
    API->>Database: Create user profile
    API-->>Client: Return session
```

### 4.2 ファイルアップロードAPI

#### POST /api/files/upload
**リクエスト**
```typescript
interface UploadRequest {
  file: File; // multipart/form-data
  metadata?: {
    tags?: string[];
    description?: string;
  };
}
```

**処理フロー**
1. **ファイル受信**
   - Multipartデータ解析
   - 一時ファイル保存

2. **検証処理**
   ```typescript
   async function validateFile(file: File): Promise<ValidationResult> {
     // ファイル形式チェック
     if (!file.name.endsWith('.pptx')) {
       throw new Error('Invalid file format');
     }
     
     // サイズチェック（50MB制限）
     if (file.size > 50 * 1024 * 1024) {
       throw new Error('File size exceeds limit');
     }
     
     // ウイルススキャン（ClamAV等）
     const scanResult = await scanForVirus(file);
     if (!scanResult.clean) {
       throw new Error('File contains malware');
     }
     
     return { valid: true };
   }
   ```

3. **Python処理**
   ```python
   # process_pptx.py
   def process_pptx(file_path: str, temp_id: str):
       # PPTXファイル読み込み
       presentation = Presentation(file_path)
       
       # PDFに変換（LibreOffice使用）
       pdf_path = convert_to_pdf(file_path)
       
       # PDF to Images
       images = convert_pdf_to_images(pdf_path)
       
       # テキスト抽出
       slides_data = []
       for slide, image in zip(presentation.slides, images):
           texts = extract_texts(slide)
           image_url = upload_image(image, f"{temp_id}_slide_{i}.jpg")
           slides_data.append({
               "pageNumber": i,
               "imageUrl": image_url,
               "texts": texts
           })
       
       return {"slides": slides_data}
   ```

### 4.3 翻訳API

#### POST /api/translate/batch
**リクエスト**
```typescript
interface TranslateRequest {
  fileId: string;
  sourceLanguage?: string; // auto-detect if not provided
  targetLanguage: string;
  options?: {
    model: 'claude-3-haiku' | 'claude-3-sonnet' | 'claude-3-opus';
    glossary?: Record<string, string>;
    style?: 'formal' | 'casual' | 'technical';
    preserveFormatting?: boolean;
  };
}
```

**バッチ処理実装**
```typescript
async function batchTranslate(texts: string[], options: TranslateOptions) {
  const BATCH_SIZE = 20;
  const MAX_TOKENS_PER_BATCH = 4000;
  
  // テキストをバッチに分割
  const batches = [];
  let currentBatch = [];
  let currentTokens = 0;
  
  for (const text of texts) {
    const tokens = estimateTokens(text);
    
    if (currentBatch.length >= BATCH_SIZE || 
        currentTokens + tokens > MAX_TOKENS_PER_BATCH) {
      batches.push(currentBatch);
      currentBatch = [text];
      currentTokens = tokens;
    } else {
      currentBatch.push(text);
      currentTokens += tokens;
    }
  }
  
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }
  
  // 並列処理（同時実行数制限付き）
  const results = await pLimit(3)(
    batches.map(batch => () => translateBatch(batch, options))
  );
  
  return results.flat();
}
```

## 5. フロントエンド実装詳細

### 5.1 コンポーネント構成（React 19対応）

```
src/
├── app/                      # Next.js 15 App Router
│   ├── (auth)/
│   │   ├── login/
│   │   ├── register/
│   │   └── forgot-password/
│   ├── (dashboard)/
│   │   ├── files/
│   │   ├── profile/         # Claude APIモデル選択（Haiku/Sonnet）
│   │   └── admin/
│   ├── actions/              # Server Actions (React 19)
│   │   ├── upload.ts        # ファイルアップロード（CSRF保護自動適用）
│   │   ├── translate.ts     # 翻訳処理（バッチ処理対応）
│   │   └── edit.ts          # テキスト編集（リアルタイム更新）
│   └── api/                  # API Routes (Stripe webhookのみ)
│       └── stripe/
├── components/
│   ├── ui/                   # shadcn/ui components
│   ├── common/               # 共通コンポーネント
│   │   ├── ThemeProvider.tsx # ダーク/ライトモード切替
│   │   └── LanguageSelector.tsx # 11言語対応セレクター
│   ├── features/             # 機能別コンポーネント
│   │   ├── upload/
│   │   │   └── FileUpload.tsx # useActionState使用
│   │   ├── preview/          # インタラクティブプレビュー
│   │   │   ├── SlidePreview.tsx # テキストハイライト連動
│   │   │   └── TextHighlight.tsx # 座標ベースのオーバーレイ
│   │   └── editor/           # ツインパネルエディター
│   │       ├── TranslationWorkspace.tsx # 左右分割レイアウト
│   │       └── TextPairEditor.tsx # 原文・翻訳文並列表示
│   └── layouts/              # レイアウトコンポーネント
├── hooks/                    # カスタムフック
│   ├── useTheme.ts          # テーマ管理フック
│   └── useHighlight.ts      # テキストハイライト管理
├── lib/                      # ユーティリティ
│   ├── python/              # Python連携
│   │   ├── pptx-processor.ts # python-pptx連携
│   │   └── uv-manager.ts    # UV環境管理
│   └── themes/              # テーマ設定
│       └── tailwind-config.ts # カラーパレット定義
├── types/                    # TypeScript型定義
└── styles/                   # グローバルスタイル
    └── globals.css          # Tailwind ディレクティブ
```

### 5.2 状態管理

#### グローバル状態（Zustand）
```typescript
interface AppState {
  // User
  user: User | null;
  setUser: (user: User | null) => void;
  
  // Files
  files: File[];
  addFile: (file: File) => void;
  updateFile: (id: string, updates: Partial<File>) => void;
  deleteFile: (id: string) => void;
  
  // Translation
  currentTranslation: Translation | null;
  setCurrentTranslation: (translation: Translation | null) => void;
  
  // UI
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

const useAppStore = create<AppState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  
  files: [],
  addFile: (file) => set((state) => ({ 
    files: [...state.files, file] 
  })),
  // ... other methods
}));
```

### 5.3 UI/UX実装詳細

#### ツインパネルレイアウト
```typescript
// 翻訳対比UI - 左側プレビュー、右側テキストペア
export function TranslationWorkspace() {
  const [highlightedText, setHighlightedText] = useState<string | null>(null);
  const [selectedSlide, setSelectedSlide] = useState(0);
  const { theme } = useTheme(); // ダークモード対応
  
  return (
    <div className="grid grid-cols-2 gap-4 h-screen bg-slate-50 dark:bg-slate-900">
      {/* 左パネル: スライドプレビュー（インタラクティブ） */}
      <div className="relative overflow-hidden bg-white dark:bg-slate-800 rounded-lg shadow-sm">
        <SlidePreview
          slide={slides[selectedSlide]}
          onTextHover={setHighlightedText}
          highlightedId={highlightedText}
          theme={theme}
        />
      </div>
      
      {/* 右パネル: テキストペアリスト（スクロール同期） */}
      <div className="overflow-y-auto">
        <TextPairList
          texts={slides[selectedSlide].texts}
          onTextSelect={setHighlightedText}
          selectedId={highlightedText}
          onEdit={handleTextEdit} // Server Action呼び出し
        />
      </div>
    </div>
  );
}
```

#### テキストハイライト実装
```typescript
// インタラクティブハイライト機能（座標マッピング対応）
const TextHighlight: React.FC<{
  text: TextData;
  isHighlighted: boolean;
  onClick: () => void;
  slideSize: { width: number; height: number };
}> = ({ text, isHighlighted, onClick, slideSize }) => {
  // python-pptxから取得した座標を画面座標に変換
  const position = {
    left: (text.position.left / slideSize.width) * 100,
    top: (text.position.top / slideSize.height) * 100,
    width: (text.position.width / slideSize.width) * 100,
    height: (text.position.height / slideSize.height) * 100,
  };
  
  return (
    <div
      className={`
        absolute transition-all duration-200 cursor-pointer rounded
        ${isHighlighted 
          ? 'ring-2 ring-blue-500 bg-blue-500/20 shadow-lg z-10' 
          : 'hover:ring-1 hover:ring-blue-300 hover:bg-blue-300/10'
        }
      `}
      style={{
        left: `${position.left}%`,
        top: `${position.top}%`,
        width: `${position.width}%`,
        height: `${position.height}%`,
      }}
      onClick={onClick}
      role="button"
      aria-label={`Text: ${text.original.substring(0, 30)}...`}
    />
  );
};
```

#### 仮想スクロール
```typescript
// 大量スライドの効率的表示
import { FixedSizeList } from 'react-window';

const SlideList: React.FC<{ slides: Slide[] }> = ({ slides }) => {
  const Row = ({ index, style }) => (
    <div style={style}>
      <SlideItem slide={slides[index]} />
    </div>
  );
  
  return (
    <FixedSizeList
      height={600}
      itemCount={slides.length}
      itemSize={200}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
};
```

## 6. セキュリティ実装

### 6.1 認証・認可

#### JWT検証ミドルウェア
```typescript
export async function validateToken(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  
  if (!token) {
    throw new UnauthorizedError('No token provided');
  }
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      throw new UnauthorizedError('Invalid token');
    }
    
    // ユーザー権限確認
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id }
    });
    
    if (!dbUser?.isActive) {
      throw new ForbiddenError('Account is not active');
    }
    
    return dbUser;
  } catch (error) {
    throw new UnauthorizedError('Token validation failed');
  }
}
```

### 6.2 入力検証

#### Zodスキーマ定義
```typescript
import { z } from 'zod';

// ファイル形式の厳密な検証
async function validateFileFormat(file: File): Promise<boolean> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  
  // PPTXのマジックナンバー（PKZip形式）を確認
  const isPKZip = bytes[0] === 0x50 && bytes[1] === 0x4B && 
                  (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07) &&
                  (bytes[3] === 0x04 || bytes[3] === 0x06 || bytes[3] === 0x08);
  
  if (!isPKZip) return false;
  
  // Content Typesの存在確認（PPTX特有）
  const decoder = new TextDecoder();
  const content = decoder.decode(bytes.slice(0, 1000));
  return content.includes('[Content_Types].xml');
}

const uploadSchema = z.object({
  file: z.instanceof(File)
    .refine(file => file.size <= 50 * 1024 * 1024, 'File too large')
    .refine(file => file.name.endsWith('.pptx'), 'Invalid file extension')
    .refine(async file => await validateFileFormat(file), 'Invalid file format'),
  metadata: z.object({
    tags: z.array(z.string()).optional(),
    description: z.string().max(500).optional()
  }).optional()
});

const translateSchema = z.object({
  fileId: z.string().uuid(),
  sourceLanguage: z.string().optional(),
  targetLanguage: z.string().min(2).max(10),
  options: z.object({
    model: z.enum(['claude-3-haiku', 'claude-3-sonnet', 'claude-3-opus']),
    glossary: z.record(z.string()).optional(),
    style: z.enum(['formal', 'casual', 'technical']).optional(),
    preserveFormatting: z.boolean().optional()
  }).optional()
});
```

### 6.3 Rate Limiting

```typescript
const rateLimiter = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(userId: string, limit: number = 10, window: number = 60000) {
  const now = Date.now();
  const userLimit = rateLimiter.get(userId);
  
  if (!userLimit || userLimit.resetTime < now) {
    rateLimiter.set(userId, { count: 1, resetTime: now + window });
    return true;
  }
  
  if (userLimit.count >= limit) {
    throw new TooManyRequestsError('Rate limit exceeded');
  }
  
  userLimit.count++;
  return true;
}
```

## 7. パフォーマンス最適化

### 7.1 キャッシュ戦略

#### Redisキャッシュ実装
```typescript
class CacheService {
  private redis: Redis;
  
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      password: process.env.REDIS_PASSWORD
    });
  }
  
  async get<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }
  
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const data = JSON.stringify(value);
    if (ttl) {
      await this.redis.setex(key, ttl, data);
    } else {
      await this.redis.set(key, data);
    }
  }
  
  async invalidate(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
```

### 7.2 データベース最適化

#### インデックス戦略
```sql
-- 頻繁に使用されるクエリ用インデックス
CREATE INDEX idx_files_user_status ON files(user_id, status);
CREATE INDEX idx_translations_file_status ON translations(file_id, status);
CREATE INDEX idx_translated_texts_translation_slide 
  ON translated_texts(translation_id, slide_number);

-- 全文検索用インデックス
CREATE INDEX idx_translated_texts_search 
  ON translated_texts USING gin(to_tsvector('english', translated_text));
```

## 8. エラー処理

### 8.1 エラークラス定義

```typescript
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}
```

### 8.2 エラーハンドリング

```typescript
export function errorHandler(error: unknown): NextResponse {
  console.error('Error:', error);
  
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      },
      { status: error.statusCode }
    );
  }
  
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: error.errors
        }
      },
      { status: 400 }
    );
  }
  
  // デフォルトエラー
  return NextResponse.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred'
      }
    },
    { status: 500 }
  );
}
```

## 9. テスト仕様

### 9.1 単体テスト

```typescript
// __tests__/api/translate.test.ts
describe('Translation API', () => {
  describe('POST /api/translate/batch', () => {
    it('should translate texts successfully', async () => {
      const mockTexts = ['Hello', 'World'];
      const mockTranslations = ['こんにちは', '世界'];
      
      // Claude APIをモック
      jest.spyOn(claudeApi, 'translate')
        .mockResolvedValue(mockTranslations);
      
      const response = await request(app)
        .post('/api/translate/batch')
        .send({
          texts: mockTexts,
          targetLanguage: 'ja'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.data.translations).toEqual(mockTranslations);
    });
    
    it('should handle rate limiting', async () => {
      // Rate limitを超えるリクエストをシミュレート
      const requests = Array(11).fill(null).map(() =>
        request(app)
          .post('/api/translate/batch')
          .send({ texts: ['test'], targetLanguage: 'ja' })
      );
      
      const responses = await Promise.all(requests);
      const tooManyRequests = responses.filter(r => r.status === 429);
      
      expect(tooManyRequests.length).toBeGreaterThan(0);
    });
  });
});
```

### 9.2 統合テスト

```typescript
// __tests__/integration/file-upload-flow.test.ts
describe('File Upload Flow', () => {
  it('should complete full upload and translation flow', async () => {
    // 1. ファイルアップロード
    const file = createMockPPTXFile();
    const uploadResponse = await uploadFile(file);
    expect(uploadResponse.success).toBe(true);
    
    const fileId = uploadResponse.data.fileId;
    
    // 2. 翻訳実行
    const translateResponse = await translateFile(fileId, 'ja');
    expect(translateResponse.success).toBe(true);
    
    const jobId = translateResponse.data.jobId;
    
    // 3. 進捗確認（ポーリング）
    let status;
    do {
      await sleep(1000);
      status = await checkTranslationStatus(jobId);
    } while (status.status !== 'completed');
    
    // 4. 結果確認
    expect(status.translatedTexts).toBeDefined();
    expect(status.translatedTexts.length).toBeGreaterThan(0);
  });
});
```

## 10. PPTX処理制約と実装詳細

### 10.1 PPTX形式の技術制約

#### ファイル構造制約
```yaml
# PPTXファイル内部構造
pptx_structure:
  format: "Open XML (ZIP)"
  max_size: 50MB  # Vercel制限考慮
  components:
    - "[Content_Types].xml"  # 必須
    - "docProps/"           # メタデータ
    - "ppt/"                # プレゼンテーション本体
      - "slides/"           # 各スライド
      - "slideLayouts/"     # レイアウト定義
      - "slideMasters/"     # マスター定義
      - "media/"            # 画像/動画
      - "theme/"            # テーマ定義
    - "_rels/"              # リレーション定義
```

#### 処理可能要素と制限
| 要素タイプ | 処理可否 | 制約事項 |
|-----------|----------|----------|
| **テキストボックス** | ✅ 完全対応 | 位置・サイズ・書式保持 |
| **表（Table）** | ✅ 対応 | セル結合対応、ヘッダー識別 |
| **箇条書き** | ✅ 対応 | インデント・番号形式保持 |
| **タイトル/本文** | ✅ 対応 | プレースホルダー認識 |
| **SmartArt** | ⚠️ 部分対応 | テキスト抽出のみ、レイアウト再現不可 |
| **グラフ** | ⚠️ 部分対応 | ラベルのみ翻訳、データ保持 |
| **図形内テキスト** | ⚠️ 制限付き | 単純図形のみ対応 |
| **ワードアート** | ❌ 非対応 | 画像として扱われる |
| **数式** | ❌ 非対応 | MathMLは処理対象外 |
| **マスター編集** | ❌ 非対応 | スライドマスター変更不可 |
| **アニメーション** | ➖ 保持のみ | 編集・追加不可 |
| **トランジション** | ➖ 保持のみ | 変更不可 |
| **音声/動画** | ➖ 保持のみ | メディアファイル変更不可 |
| **VBAマクロ** | ❌ 削除 | セキュリティリスク |

### 10.2 Python処理実装の詳細制約

```python
# pptx_constraints.py
from typing import Dict, List, Any
from dataclasses import dataclass
import re

@dataclass
class PPTXConstraints:
    """PPTX処理の制約定義"""
    
    # ファイルサイズ制限
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
    MAX_SLIDES = 500                   # 最大スライド数
    MAX_TEXTS_PER_SLIDE = 100         # スライドあたり最大テキスト数
    MAX_TEXT_LENGTH = 10000            # 単一テキストの最大文字数
    
    # 処理タイムアウト（Vercel制限対応）
    PROCESSING_TIMEOUT = 9  # 9秒（10秒制限の90%）
    
    # テキスト抽出制約
    MIN_FONT_SIZE = 8                 # 最小フォントサイズ
    MAX_FONT_SIZE = 96                # 最大フォントサイズ
    IGNORE_HIDDEN_SLIDES = True       # 非表示スライドをスキップ
    
    # サポートする文字エンコーディング
    SUPPORTED_ENCODINGS = ['utf-8', 'utf-16', 'shift-jis', 'euc-jp']
    
    # 除外パターン（翻訳対象外）
    EXCLUSION_PATTERNS = [
        r'^\d+$',                      # 数字のみ
        r'^[A-Z]{1,3}\d{1,4}$',       # セル参照（A1, B12等）
        r'^\W+$',                      # 記号のみ
        r'^https?://',                 # URL
        r'^[a-zA-Z0-9._%+-]+@',       # メールアドレス
    ]
    
    @classmethod
    def should_translate(cls, text: str) -> bool:
        """翻訳対象かどうか判定"""
        text = text.strip()
        
        # 空文字や短すぎるテキストは除外
        if len(text) < 2:
            return False
        
        # 除外パターンチェック
        for pattern in cls.EXCLUSION_PATTERNS:
            if re.match(pattern, text):
                return False
        
        return True

class PPTXProcessor:
    """制約を考慮したPPTX処理クラス"""
    
    def __init__(self, file_path: str):
        self.constraints = PPTXConstraints()
        self.file_path = file_path
        self._validate_file()
    
    def _validate_file(self):
        """ファイル検証（制約チェック）"""
        import os
        from pptx import Presentation
        
        # ファイルサイズチェック
        file_size = os.path.getsize(self.file_path)
        if file_size > self.constraints.MAX_FILE_SIZE:
            raise ValueError(f"File too large: {file_size} bytes")
        
        # PPTXファイル形式チェック
        try:
            prs = Presentation(self.file_path)
        except Exception as e:
            raise ValueError(f"Invalid PPTX file: {e}")
        
        # スライド数チェック
        if len(prs.slides) > self.constraints.MAX_SLIDES:
            raise ValueError(f"Too many slides: {len(prs.slides)}")
        
        # 破損チェック（ZIP構造検証）
        import zipfile
        try:
            with zipfile.ZipFile(self.file_path, 'r') as z:
                # 必須ファイルの存在確認
                required_files = [
                    '[Content_Types].xml',
                    'ppt/presentation.xml'
                ]
                for req_file in required_files:
                    if req_file not in z.namelist():
                        raise ValueError(f"Missing required file: {req_file}")
                
                # Zip bomb対策（圧縮率チェック）
                total_compressed = sum(zinfo.compress_size for zinfo in z.filelist)
                total_uncompressed = sum(zinfo.file_size for zinfo in z.filelist)
                compression_ratio = total_uncompressed / total_compressed if total_compressed > 0 else 1
                
                if compression_ratio > 100:  # 圧縮率100倍以上は怪しい
                    raise ValueError(f"Suspicious compression ratio: {compression_ratio}")
        except zipfile.BadZipFile:
            raise ValueError("Corrupted PPTX file")
    
    def extract_translatable_texts(self) -> List[Dict[str, Any]]:
        """翻訳可能なテキストを抽出（制約適用）"""
        from pptx import Presentation
        from pptx.enum.shapes import MSO_SHAPE_TYPE
        import time
        
        start_time = time.time()
        prs = Presentation(self.file_path)
        texts = []
        
        for slide_idx, slide in enumerate(prs.slides):
            # タイムアウトチェック
            if time.time() - start_time > self.constraints.PROCESSING_TIMEOUT:
                raise TimeoutError("Processing timeout")
            
            # 非表示スライドのスキップ
            if self.constraints.IGNORE_HIDDEN_SLIDES and self._is_hidden_slide(slide):
                continue
            
            slide_texts = []
            
            # すべてのシェイプを処理
            for shape in slide.shapes:
                # テキストフレームがある場合
                if shape.has_text_frame:
                    text_data = self._extract_text_frame(shape, slide_idx)
                    if text_data:
                        slide_texts.extend(text_data)
                
                # 表の場合
                elif shape.has_table:
                    table_data = self._extract_table_texts(shape.table, slide_idx)
                    slide_texts.extend(table_data)
                
                # グループシェイプの場合（再帰処理）
                elif shape.shape_type == MSO_SHAPE_TYPE.GROUP:
                    group_texts = self._extract_group_texts(shape, slide_idx)
                    slide_texts.extend(group_texts)
            
            # スライドあたりのテキスト数制限
            if len(slide_texts) > self.constraints.MAX_TEXTS_PER_SLIDE:
                slide_texts = slide_texts[:self.constraints.MAX_TEXTS_PER_SLIDE]
            
            texts.extend(slide_texts)
        
        return texts
    
    def _extract_text_frame(self, shape, slide_idx: int) -> List[Dict[str, Any]]:
        """テキストフレームからテキスト抽出"""
        texts = []
        
        for para_idx, paragraph in enumerate(shape.text_frame.paragraphs):
            text = paragraph.text.strip()
            
            # 制約チェック
            if not self.constraints.should_translate(text):
                continue
            
            if len(text) > self.constraints.MAX_TEXT_LENGTH:
                text = text[:self.constraints.MAX_TEXT_LENGTH]
            
            # フォントサイズ取得（制約チェック）
            font_size = self._get_font_size(paragraph)
            if font_size and (font_size < self.constraints.MIN_FONT_SIZE or 
                             font_size > self.constraints.MAX_FONT_SIZE):
                continue
            
            texts.append({
                'id': f'text_{slide_idx}_{shape.shape_id}_{para_idx}',
                'slide_index': slide_idx,
                'shape_id': shape.shape_id,
                'shape_type': str(shape.shape_type),
                'text': text,
                'is_title': shape == shape.slide.shapes.title,
                'font_size': font_size,
                'position': self._get_shape_position(shape),
                'formatting': self._get_text_formatting(paragraph)
            })
        
        return texts
    
    def _extract_table_texts(self, table, slide_idx: int) -> List[Dict[str, Any]]:
        """表からテキスト抽出（セル結合対応）"""
        texts = []
        processed_cells = set()  # 処理済みセルを記録
        
        for row_idx, row in enumerate(table.rows):
            for col_idx, cell in enumerate(row.cells):
                # セル結合の処理
                cell_key = id(cell)  # セルの一意識別子
                if cell_key in processed_cells:
                    continue
                processed_cells.add(cell_key)
                
                if cell.text_frame:
                    text = cell.text.strip()
                    if self.constraints.should_translate(text):
                        texts.append({
                            'id': f'table_{slide_idx}_{row_idx}_{col_idx}',
                            'slide_index': slide_idx,
                            'text': text,
                            'is_table_cell': True,
                            'is_header': row_idx == 0,  # 最初の行をヘッダーと仮定
                            'table_position': {
                                'row': row_idx,
                                'col': col_idx,
                                'rowspan': self._get_cell_span(cell, 'row'),
                                'colspan': self._get_cell_span(cell, 'col')
                            }
                        })
        
        return texts
    
    def _get_cell_span(self, cell, direction: str) -> int:
        """セルのスパン数を取得"""
        # python-pptxの制限により、正確なspan情報が取得できない場合がある
        # ここでは簡易的な実装
        return 1  # デフォルト値
    
    def _extract_group_texts(self, group_shape, slide_idx: int) -> List[Dict[str, Any]]:
        """グループシェイプから再帰的にテキスト抽出"""
        texts = []
        for shape in group_shape.shapes:
            if shape.has_text_frame:
                texts.extend(self._extract_text_frame(shape, slide_idx))
            elif hasattr(shape, 'shapes'):  # ネストされたグループ
                texts.extend(self._extract_group_texts(shape, slide_idx))
        return texts
    
    def _is_hidden_slide(self, slide) -> bool:
        """スライドが非表示かどうか判定"""
        # python-pptxでは直接取得できないため、XML解析が必要
        # ここでは簡易実装
        return False
    
    def _get_font_size(self, paragraph) -> Optional[float]:
        """フォントサイズ取得（pt単位）"""
        try:
            if paragraph.font.size:
                return paragraph.font.size.pt
            # デフォルトサイズ
            return 12.0
        except:
            return None
    
    def _get_shape_position(self, shape) -> Dict[str, float]:
        """シェイプの位置情報取得"""
        return {
            'left': shape.left.pt if shape.left else 0,
            'top': shape.top.pt if shape.top else 0,
            'width': shape.width.pt if shape.width else 0,
            'height': shape.height.pt if shape.height else 0
        }
    
    def _get_text_formatting(self, paragraph) -> Dict[str, Any]:
        """テキストの書式情報取得"""
        font = paragraph.font
        return {
            'bold': font.bold if font.bold is not None else False,
            'italic': font.italic if font.italic is not None else False,
            'underline': font.underline if font.underline is not None else False,
            'color': str(font.color.rgb) if font.color and font.color.rgb else None,
            'font_name': font.name if font.name else 'Arial'
        }
```

### 10.3 Dockerサンドボックス設定

```dockerfile
# python-processor.dockerfile
FROM python:3.13-slim

# セキュリティ: 非rootユーザー作成
RUN useradd -m -u 1000 -s /bin/bash processor && \
    mkdir -p /app /tmp/processing && \
    chown -R processor:processor /app /tmp/processing

# 必要な依存関係のインストール（最小限）
RUN apt-get update && apt-get install -y \
    --no-install-recommends \
    libreoffice \
    poppler-utils \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

# Python依存関係
WORKDIR /app
COPY --chown=processor:processor requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# アプリケーションコード
COPY --chown=processor:processor python_backend/ ./python_backend/

# セキュリティ制限
USER processor

# 読み取り専用ファイルシステム
# ネットワーク制限（docker-compose.ymlで設定）
# CPU/メモリ制限（docker-compose.ymlで設定）

ENTRYPOINT ["python", "-m", "python_backend.processor"]
```

```yaml
# docker-compose.yml (Python処理用)
version: '3.8'

services:
  python-processor:
    build:
      context: .
      dockerfile: python-processor.dockerfile
    security_opt:
      - no-new-privileges:true
      - seccomp:unconfined
    cap_drop:
      - ALL
    cap_add:
      - DAC_OVERRIDE  # ファイル読み取りに必要
    read_only: true
    tmpfs:
      - /tmp:noexec,nosuid,size=100M
    networks:
      - isolated
    mem_limit: 512m
    memswap_limit: 512m
    cpu_shares: 512
    pids_limit: 50
    ulimits:
      nproc: 50
      nofile:
        soft: 100
        hard: 200
    environment:
      - PYTHONDONTWRITEBYTECODE=1
      - PYTHONUNBUFFERED=1

networks:
  isolated:
    driver: bridge
    internal: true  # 外部ネットワークへのアクセスを遮断
```

## 11. デプロイメント

### 11.1 環境変数設定

```bash
# .env.production
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://app.ppttranslator.com

# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# Claude API（モデル選択対応）
ANTHROPIC_API_KEY=xxx
ANTHROPIC_MODEL_DEFAULT=claude-3-haiku-20240307
ANTHROPIC_MODEL_PREMIUM=claude-3-5-sonnet-20241022  # Coming Soon

# Redis
REDIS_URL=redis://xxx:6379

# Monitoring
SENTRY_DSN=https://xxx@sentry.io/xxx
NEW_RELIC_LICENSE_KEY=xxx
```

### 10.2 Docker構成

```dockerfile
# Dockerfile (マルチステージビルド)
# Node.js アプリケーション
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]

# Python処理用コンテナ（UV + Python 3.13）
FROM python:3.13-slim AS python-processor

# UV インストール
RUN pip install uv

WORKDIR /app

# 依存関係のコピーとインストール
COPY pyproject.toml .
RUN uv pip install --system python-pptx pillow pdf2image httpx pydantic

# Pythonスクリプトのコピー
COPY python_backend/ ./python_backend/

CMD ["python", "-m", "python_backend.main"]
```

### 10.3 CI/CDパイプライン

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm test
      - run: npm run test:e2e

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Vercel
        uses: vercel/action@v1
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

## 11. 監視・ログ

### 11.1 ログ実装

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'ppt-translator' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    }),
    new winston.transports.File({
      filename: 'error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: 'combined.log'
    })
  ]
});

// 詳細アクセスログ実装
interface AccessLog {
  timestamp: Date;
  userId: string;
  userRole: string;
  action: string;
  resourceType: string;
  resourceId: string;
  ipAddress: string;
  userAgent: string;
  result: 'success' | 'failure';
  errorDetails?: any;
  metadata?: Record<string, any>;
}

export async function logAccess(log: AccessLog) {
  // 管理者操作は必ず記録
  if (log.userRole === 'ADMIN') {
    await prisma.auditLog.create({
      data: {
        ...log,
        priority: 'HIGH',
        retention: '3_YEARS' // 管理者ログは3年保持
      }
    });
  }
  
  // 機密ファイルアクセスの記録
  if (log.metadata?.sensitive) {
    await prisma.sensitiveAccessLog.create({
      data: {
        ...log,
        reviewed: false,
        alertSent: false
      }
    });
  }
  
  // 通常アクセスログ
  logger.info('ACCESS_LOG', log);
}

// 本番環境ではCloudWatch/Datadogに送信
if (process.env.NODE_ENV === 'production') {
  logger.add(new CloudWatchTransport({
    logGroupName: 'ppt-translator',
    logStreamName: `${process.env.NODE_ENV}-${new Date().toISOString()}`
  }));
}
```

### 11.2 メトリクス収集

```typescript
import { StatsD } from 'node-statsd';

const metrics = new StatsD({
  host: process.env.STATSD_HOST,
  port: 8125,
  prefix: 'ppt_translator.'
});

// 使用例
export function trackTranslation(language: string, duration: number) {
  metrics.increment(`translation.count.${language}`);
  metrics.timing(`translation.duration.${language}`, duration);
}

export function trackAPICall(endpoint: string, statusCode: number) {
  metrics.increment(`api.${endpoint}.${statusCode}`);
}
```

## 12. 今後の拡張計画

### 12.1 Phase 2機能
- リアルタイム共同編集（WebSocket/WebRTC）
- 音声ナレーション翻訳
- PDFエクスポート機能
- APIキー管理（開発者向け）
- Webhook通知
- Claude 3.5 Sonnetモデルの完全統合
- カスタムテーマエディター

### 12.2 Phase 3機能
- AI による文脈理解強化
- カスタム翻訳モデル学習
- 他のOffice形式サポート（Word, Excel）
- プラグイン/拡張機能システム
- マルチテナント対応
- 翻訳メモリ機能（TM）
- 用語集の自動学習・提案

---
*ドキュメントバージョン: 1.0*  
*最終更新日: 2025年1月*