# PowerPoint 翻訳アプリ

PowerPointファイルをアップロードして翻訳し、編集できるWebアプリケーションです。

## セットアップ

### 前提条件

- Node.js 18以上
- Python 3.8以上
- npm または yarn

### インストール手順

1. **リポジトリをクローン**
```bash
git clone https://github.com/YusukeTsunoda/ppt-trans.git
cd ppt-trans
```

2. **Node.js依存関係をインストール**
```bash
npm install
```

3. **Python仮想環境を作成・有効化**
```bash
# 仮想環境を作成
python3 -m venv venv

# 仮想環境を有効化
# macOS/Linux:
source venv/bin/activate
# Windows:
# venv\Scripts\activate
```

4. **Python依存関係をインストール**
```bash
pip install -r requirements.txt
```

5. **環境変数を設定**
`.env.local`ファイルを作成し、必要な環境変数を設定してください：
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

6. **開発サーバーを起動**
```bash
# デフォルト (ポート3000)
npm run dev

# 複数ポートでの起動も可能
npm run dev:3001  # ポート3001
npm run dev:3002  # ポート3002
```

アプリケーションは以下のURLで利用できます：
- `http://localhost:3000` (デフォルト)
- `http://localhost:3001` (複数ポート対応)
- `http://localhost:3002` (複数ポート対応)

## 開発

### venv環境の管理

- **有効化**: `source venv/bin/activate`
- **無効化**: `deactivate`
- **依存関係の更新**: `pip install -r requirements.txt`
- **新しいパッケージの追加**: `pip install package_name && pip freeze > requirements.txt`

### ファイル構成

```
pptx-translator/
├── app/                    # Next.js 13 App Router
│   ├── api/               # API エンドポイント
│   └── page.tsx           # メインページ
├── lib/                    # ユーティリティ
├── venv/                   # Python仮想環境
├── requirements.txt        # Python依存関係
└── package.json           # Node.js依存関係
```

## 機能

- PowerPointファイルのアップロード
- スライドの画像化（LibreOffice + pdf2image）
- テキスト抽出と翻訳（Claude API）
- 翻訳文の編集
- 翻訳版PowerPointのダウンロード

## 技術スタック

- **フロントエンド**: Next.js 13, TypeScript, Tailwind CSS
- **バックエンド**: Python (Vercel Functions)
- **データベース**: Supabase
- **翻訳**: Anthropic Claude API
- **画像処理**: LibreOffice, pdf2image, Pillow

## ライセンス

MIT License
