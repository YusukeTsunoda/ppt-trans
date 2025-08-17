#!/usr/bin/env python3
"""翻訳されたテキストでPowerPointファイルを更新するスクリプト"""

import json
import sys
from pptx import Presentation
from typing import Dict, List, Any

def update_pptx_with_translations(
    input_path: str, 
    output_path: str, 
    translations: Dict[int, List[Dict[str, str]]]
) -> Dict[str, Any]:
    """
    翻訳されたテキストでPowerPointファイルを更新
    
    Args:
        input_path: 元のPPTXファイルのパス
        output_path: 出力PPTXファイルのパス
        translations: スライド番号をキーとした翻訳データ
        
    Returns:
        処理結果を含む辞書
    """
    try:
        prs = Presentation(input_path)
        updated_count = 0
        
        for slide_num, slide in enumerate(prs.slides, 1):
            if slide_num not in translations:
                continue
                
            slide_translations = translations[slide_num]
            shape_index = 0
            
            for shape in slide.shapes:
                if hasattr(shape, "text") and shape.text.strip():
                    # 対応する翻訳を探す
                    if shape_index < len(slide_translations):
                        translation = slide_translations[shape_index]
                        if "translated_text" in translation:
                            shape.text = translation["translated_text"]
                            updated_count += 1
                    shape_index += 1
                    
                # テーブルの場合
                elif shape.has_table:
                    if shape_index < len(slide_translations):
                        translation = slide_translations[shape_index]
                        if "translated_table" in translation:
                            translated_table = translation["translated_table"]
                            for row_idx, row in enumerate(shape.table.rows):
                                if row_idx < len(translated_table):
                                    for cell_idx, cell in enumerate(row.cells):
                                        if cell_idx < len(translated_table[row_idx]):
                                            cell.text = translated_table[row_idx][cell_idx]
                                            updated_count += 1
                    shape_index += 1
        
        # ファイルを保存
        prs.save(output_path)
        
        return {
            "success": True,
            "updated_count": updated_count,
            "output_path": output_path
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

def main():
    if len(sys.argv) != 4:
        print(json.dumps({
            "success": False,
            "error": "Usage: python update_pptx.py <input_pptx> <output_pptx> <translations_json>"
        }))
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    translations_json = sys.argv[3]
    
    try:
        translations = json.loads(translations_json)
    except json.JSONDecodeError as e:
        print(json.dumps({
            "success": False,
            "error": f"Invalid JSON: {str(e)}"
        }))
        sys.exit(1)
    
    result = update_pptx_with_translations(input_path, output_path, translations)
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()