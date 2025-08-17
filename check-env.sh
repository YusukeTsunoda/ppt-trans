#!/bin/bash
# check-env.sh - このスクリプトを実行して全てOKになるまで先に進まない

echo "=== 環境チェック開始 ==="

# Node.jsチェック
NODE_VERSION=$(node -v 2>/dev/null)
if [[ $NODE_VERSION == v18* ]] || [[ $NODE_VERSION == v20* ]] || [[ $NODE_VERSION == v22* ]]; then
    echo "✅ Node.js: $NODE_VERSION"
else
    echo "❌ Node.js 18.x or 20.x が必要です"
    echo "   インストール: brew install node@18"
    exit 1
fi

# npmチェック
NPM_VERSION=$(npm -v 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "✅ npm: $NPM_VERSION"
else
    echo "❌ npm が見つかりません"
    exit 1
fi

# Dockerチェック
if docker --version &>/dev/null; then
    echo "✅ Docker: $(docker --version)"
    
    # Docker起動チェック
    if docker ps &>/dev/null; then
        echo "✅ Docker daemon: 起動中"
        
        # メモリチェック
        DOCKER_MEM=$(docker system info 2>/dev/null | grep "Total Memory" | awk '{print $3}')
        echo "   Memory: $DOCKER_MEM"
    else
        echo "❌ Docker Desktop を起動してください"
        exit 1
    fi
else
    echo "❌ Docker Desktop をインストールしてください"
    echo "   https://www.docker.com/products/docker-desktop"
    exit 1
fi

# Gitチェック
if git --version &>/dev/null; then
    echo "✅ Git: $(git --version)"
else
    echo "❌ Git をインストールしてください"
    exit 1
fi

# ポートチェック
for PORT in 3000 54321 54322 54323; do
    if lsof -i :$PORT &>/dev/null; then
        echo "⚠️  ポート $PORT が使用中です"
        echo "   lsof -i :$PORT で確認して、必要ならプロセスを停止してください"
    else
        echo "✅ ポート $PORT: 利用可能"
    fi
done

echo ""
echo "=== 環境チェック完了 ==="