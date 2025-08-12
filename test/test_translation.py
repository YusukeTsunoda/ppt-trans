#!/usr/bin/env python3
"""
翻訳機能のテストスクリプト
generate_pptx.pyの動作確認
"""

import json
import sys
import os
import tempfile

# パスを追加
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'python_backend'))

from generate_pptx import generate_translated_pptx

def test_translation():
    """翻訳機能をテスト"""
    
    # テスト用の翻訳データ
    test_translations = [
        {
            "pageNumber": 1,
            "texts": [
                {
                    "id": "slide1_text1",
                    "original": "Test Presentation for Translation",
                    "translated": "翻訳テスト用プレゼンテーション"
                },
                {
                    "id": "slide1_text2",
                    "original": "This is a test PowerPoint file with various text elements",
                    "translated": "これは様々なテキスト要素を含むテスト用PowerPointファイルです"
                }
            ]
        },
        {
            "pageNumber": 2,
            "texts": [
                {
                    "id": "slide2_text1",
                    "original": "Key Features",
                    "translated": "主な機能"
                },
                {
                    "id": "slide2_text2",
                    "original": "First bullet point with important information",
                    "translated": "重要な情報を含む最初の箇条書き"
                },
                {
                    "id": "slide2_text3",
                    "original": "Second bullet point with additional details",
                    "translated": "追加の詳細を含む2番目の箇条書き"
                },
                {
                    "id": "slide2_text4",
                    "original": "Sub-point under second bullet",
                    "translated": "2番目の箇条書きのサブポイント"
                },
                {
                    "id": "slide2_text5",
                    "original": "Third main bullet point",
                    "translated": "3番目のメイン箇条書き"
                }
            ]
        },
        {
            "pageNumber": 3,
            "texts": [
                {
                    "id": "slide3_text1",
                    "original": "Data Table Example",
                    "translated": "データテーブルの例"
                },
                {
                    "id": "slide3_text2",
                    "original": "Category",
                    "translated": "カテゴリー"
                },
                {
                    "id": "slide3_text3",
                    "original": "Value",
                    "translated": "値"
                },
                {
                    "id": "slide3_text4",
                    "original": "Status",
                    "translated": "ステータス"
                },
                {
                    "id": "slide3_text5",
                    "original": "Revenue",
                    "translated": "収益"
                },
                {
                    "id": "slide3_text6",
                    "original": "Achieved",
                    "translated": "達成済み"
                },
                {
                    "id": "slide3_text7",
                    "original": "Profit",
                    "translated": "利益"
                },
                {
                    "id": "slide3_text8",
                    "original": "In Progress",
                    "translated": "進行中"
                }
            ]
        },
        {
            "pageNumber": 4,
            "texts": [
                {
                    "id": "slide4_text1",
                    "original": "Multiple Text Elements",
                    "translated": "複数のテキスト要素"
                },
                {
                    "id": "slide4_text2",
                    "original": "Left side content",
                    "translated": "左側のコンテンツ"
                },
                {
                    "id": "slide4_text3",
                    "original": "This is important information that needs to be translated accurately.",
                    "translated": "これは正確に翻訳される必要がある重要な情報です。"
                },
                {
                    "id": "slide4_text4",
                    "original": "Right side content",
                    "translated": "右側のコンテンツ"
                },
                {
                    "id": "slide4_text5",
                    "original": "Additional details and context for better understanding.",
                    "translated": "より良い理解のための追加の詳細とコンテキスト。"
                }
            ]
        },
        {
            "pageNumber": 5,
            "texts": [
                {
                    "id": "slide5_text1",
                    "original": "Font Styles Test",
                    "translated": "フォントスタイルテスト"
                },
                {
                    "id": "slide5_text2",
                    "original": "Normal text style",
                    "translated": "通常のテキストスタイル"
                },
                {
                    "id": "slide5_text3",
                    "original": "Bold text style",
                    "translated": "太字のテキストスタイル"
                },
                {
                    "id": "slide5_text4",
                    "original": "Italic text style",
                    "translated": "イタリック体のテキストスタイル"
                },
                {
                    "id": "slide5_text5",
                    "original": "Underlined text style",
                    "translated": "下線付きテキストスタイル"
                },
                {
                    "id": "slide5_text6",
                    "original": "Colored text style",
                    "translated": "色付きテキストスタイル"
                }
            ]
        }
    ]
    
    # 入力ファイルと出力ファイルのパス
    input_file = "test_presentation.pptx"
    output_file = "test_presentation_translated.pptx"
    
    if not os.path.exists(input_file):
        print(f"❌ エラー: 入力ファイル '{input_file}' が見つかりません")
        print("   test/create_test_pptx.py を実行してテストファイルを作成してください")
        return False
    
    print(f"📁 入力ファイル: {input_file}")
    print(f"📁 出力ファイル: {output_file}")
    print(f"📝 翻訳テキスト数: {sum(len(slide['texts']) for slide in test_translations)}")
    print("")
    
    try:
        # 翻訳を実行
        print("🔄 翻訳処理を開始...")
        result = generate_translated_pptx(
            original_file_path=input_file,
            edited_slides_data=test_translations,
            output_path=output_file
        )
        
        print("")
        print("=== 結果 ===")
        print(json.dumps(result, ensure_ascii=False, indent=2))
        
        if result["success"]:
            print("")
            print(f"✅ 翻訳が成功しました！")
            print(f"   置換されたテキスト数: {result['replacements']}")
            if "file_size" in result:
                print(f"   出力ファイルサイズ: {result['file_size']:,} bytes")
            print(f"   出力ファイル: {output_file}")
            
            # ファイルが実際に作成されたか確認
            if os.path.exists(output_file):
                print("")
                print("📊 ファイル確認:")
                print(f"   ✅ 出力ファイルが正常に作成されました")
                
                # PowerPointで開くためのコマンドを表示
                print("")
                print("💡 ファイルを開くには:")
                print(f"   open {output_file}")
                return True
            else:
                print("   ❌ 出力ファイルが見つかりません")
                return False
        else:
            print("")
            print("❌ 翻訳に失敗しました")
            if "errors" in result:
                print("エラー:")
                for error in result["errors"]:
                    print(f"  - {error}")
            return False
            
    except Exception as e:
        print(f"❌ エラーが発生しました: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_translation()
    sys.exit(0 if success else 1)