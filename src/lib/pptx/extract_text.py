#!/usr/bin/env python3
"""PowerPointファイルからテキストを抽出するスクリプト"""

import json
import sys
from pptx import Presentation
from typing import List, Dict, Any

def extract_text_from_pptx(file_path: str) -> Dict[str, Any]:
    """
    PowerPointファイルからテキストを抽出
    
    Args:
        file_path: PPTXファイルのパス
        
    Returns:
        スライドごとのテキスト情報を含む辞書
    """
    try:
        prs = Presentation(file_path)
        slides_data = []
        
        for slide_num, slide in enumerate(prs.slides, 1):
            slide_texts = []
            
            # スライド内のすべてのシェイプからテキストを抽出
            for shape in slide.shapes:
                if hasattr(shape, "text") and shape.text.strip():
                    text_data = {
                        "shape_type": shape.shape_type.name if hasattr(shape, 'shape_type') else "unknown",
                        "text": shape.text.strip()
                    }
                    
                    # タイトルかどうかの判定
                    if shape == slide.shapes.title:
                        text_data["is_title"] = True
                    
                    slide_texts.append(text_data)
                    
                # テーブルの場合
                elif shape.has_table:
                    table_data = []
                    for row in shape.table.rows:
                        row_data = []
                        for cell in row.cells:
                            row_data.append(cell.text.strip())
                        table_data.append(row_data)
                    
                    if table_data:
                        slide_texts.append({
                            "shape_type": "TABLE",
                            "table": table_data
                        })
            
            if slide_texts:
                slides_data.append({
                    "slide_number": slide_num,
                    "texts": slide_texts
                })
        
        return {
            "success": True,
            "total_slides": len(prs.slides),
            "slides": slides_data
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

def main():
    if len(sys.argv) != 2:
        print(json.dumps({
            "success": False,
            "error": "Usage: python extract_text.py <pptx_file_path>"
        }))
        sys.exit(1)
    
    file_path = sys.argv[1]
    result = extract_text_from_pptx(file_path)
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()