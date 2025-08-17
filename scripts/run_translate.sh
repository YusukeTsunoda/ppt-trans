#!/bin/bash

# Python仮想環境をアクティベート
source "$(dirname "$0")/../venv/bin/activate"

# 翻訳スクリプトを実行
python3 "$(dirname "$0")/translate_pptx.py" "$@"