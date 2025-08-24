#!/usr/bin/env python3
"""
テストユーザーを作成するスクリプト
"""
import os
from supabase import create_client, Client
from dotenv import load_dotenv

# .env.testファイルを読み込む
load_dotenv('.env.test')

# Supabaseクライアントを作成
url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321")
service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not service_key:
    print("エラー: SUPABASE_SERVICE_ROLE_KEYが設定されていません")
    exit(1)

supabase: Client = create_client(url, service_key)

# テストユーザー情報
test_email = os.environ.get("TEST_USER_EMAIL", "test@example.com")
test_password = os.environ.get("TEST_USER_PASSWORD", "Test123!@#")

try:
    # ユーザーを作成
    print(f"テストユーザーを作成中: {test_email}")
    
    # 既存ユーザーを削除（存在する場合）
    try:
        # Admin APIを使用してユーザーを検索
        existing_users = supabase.auth.admin.list_users()
        for user in existing_users:
            if user.email == test_email:
                print(f"既存ユーザーを削除中: {user.id}")
                supabase.auth.admin.delete_user(user.id)
                break
    except Exception as e:
        print(f"既存ユーザーの削除をスキップ: {e}")
    
    # 新規ユーザーを作成
    result = supabase.auth.admin.create_user({
        "email": test_email,
        "password": test_password,
        "email_confirm": True,  # メール確認済みとして作成
        "user_metadata": {
            "email": test_email,
            "email_verified": True,
            "phone_verified": False
        }
    })
    
    print(f"✅ テストユーザーが作成されました: {test_email}")
    print(f"   ID: {result.user.id}")
    
except Exception as e:
    print(f"❌ エラーが発生しました: {e}")
    exit(1)