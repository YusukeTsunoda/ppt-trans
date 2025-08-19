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
                    
                    # 位置情報を追加（EMUからピクセルに変換）
                    # PowerPointのEMU (English Metric Units) を ピクセルに変換
                    # 1インチ = 914400 EMU = 96ピクセル
                    if hasattr(shape, 'left') and hasattr(shape, 'top') and hasattr(shape, 'width') and hasattr(shape, 'height'):
                        text_data["position"] = {
                            "x": int(shape.left * 96 / 914400) if shape.left else 0,
                            "y": int(shape.top * 96 / 914400) if shape.top else 0,
                            "width": int(shape.width * 96 / 914400) if shape.width else 0,
                            "height": int(shape.height * 96 / 914400) if shape.height else 0
                        }
                    
                    # タイトルかどうかの判定
                    if shape == slide.shapes.title:
                        text_data["is_title"] = True
                    
                    slide_texts.append(text_data)
                    
                # テーブルの場合
                elif shape.has_table:
                    table = shape.table
                    rows_count = len(table.rows)
                    cols_count = len(table.columns)
                    
                    # テーブル全体の位置情報
                    table_x = int(shape.left * 96 / 914400) if shape.left else 0
                    table_y = int(shape.top * 96 / 914400) if shape.top else 0
                    table_width = int(shape.width * 96 / 914400) if shape.width else 0
                    table_height = int(shape.height * 96 / 914400) if shape.height else 0
                    
                    # 各セルの幅と高さを計算（均等割りで簡易計算）
                    cell_width = table_width // cols_count if cols_count > 0 else 0
                    cell_height = table_height // rows_count if rows_count > 0 else 0
                    
                    # セルごとのデータを構築
                    cells_data = []
                    for row_idx, row in enumerate(table.rows):
                        for col_idx, cell in enumerate(row.cells):
                            cell_text = cell.text.strip()
                            if cell_text:  # 空のセルはスキップ
                                cell_data = {
                                    "text": cell_text,
                                    "row": row_idx,
                                    "col": col_idx,
                                    "position": {
                                        "x": table_x + (col_idx * cell_width),
                                        "y": table_y + (row_idx * cell_height),
                                        "width": cell_width,
                                        "height": cell_height
                                    }
                                }
                                cells_data.append(cell_data)
                    
                    if cells_data:
                        table_text_data = {
                            "shape_type": "TABLE",
                            "table_info": {
                                "rows": rows_count,
                                "cols": cols_count,
                                "position": {
                                    "x": table_x,
                                    "y": table_y,
                                    "width": table_width,
                                    "height": table_height
                                }
                            },
                            "cells": cells_data  # 各セルの個別データ
                        }
                        
                        slide_texts.append(table_text_data)
            
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