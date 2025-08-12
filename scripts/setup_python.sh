#!/bin/bash

# Python環境のセットアップスクリプト

echo "Python環境をセットアップしています..."

# uvがインストールされているか確認
if ! command -v uv &> /dev/null; then
    echo "uvをインストールしています..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
fi

# Python依存関係をインストール
echo "Python依存関係をインストールしています..."
uv pip install python-pptx Pillow requests pdf2image supabase

# LibreOfficeがインストールされているか確認
if [ ! -d "/Applications/LibreOffice.app" ]; then
    echo "⚠️ LibreOfficeがインストールされていません。"
    echo "以下のコマンドでインストールしてください："
    echo "brew install --cask libreoffice"
fi

# poppler-utilsがインストールされているか確認（pdf2imageに必要）
if ! command -v pdftoppm &> /dev/null; then
    echo "poppler-utilsをインストールしています..."
    brew install poppler
fi

echo "✅ Python環境のセットアップが完了しました"