#!/usr/bin/env python3
"""PowerPointファイルに翻訳文を適用するスクリプト"""

import json
import sys
import os
from pptx import Presentation
from typing import Dict, List, Any

def apply_translations_to_pptx(input_path: str, output_path: str, translations_json: str) -> Dict[str, Any]:
    """
    PowerPointファイルに翻訳文を適用
    
    Args:
        input_path: 入力PPTXファイルのパス
        output_path: 出力PPTXファイルのパス
        translations_json: 翻訳データのJSON文字列
        
    Returns:
        処理結果を含む辞書
    """
    try:
        # 翻訳データをパース
        translations_data = json.loads(translations_json)
        
        # PowerPointファイルを開く
        prs = Presentation(input_path)
        
        applied_count = 0
        
        # 各スライドの処理
        for slide_data in translations_data.get('slides', []):
            slide_number = slide_data.get('slide_number', 0)
            
            # スライド番号は1から始まるが、インデックスは0から
            if slide_number <= 0 or slide_number > len(prs.slides):
                continue
                
            slide = prs.slides[slide_number - 1]
            translations = slide_data.get('translations', [])
            
            # シェイプとテキストのマッピングを作成
            shape_text_map = []
            for shape in slide.shapes:
                if hasattr(shape, 'text_frame') and shape.has_text_frame and shape.text.strip():
                    shape_text_map.append({
                        'shape': shape,
                        'original_text': shape.text.strip(),
                        'type': 'text'
                    })
                elif shape.has_table:
                    # テーブルの内容を文字列化して比較用に保存
                    table_content = []
                    for row in shape.table.rows:
                        row_content = [cell.text.strip() for cell in row.cells]
                        table_content.append(row_content)
                    shape_text_map.append({
                        'shape': shape,
                        'table_content': table_content,
                        'type': 'table'
                    })
            
            # 各翻訳を適用
            for translation in translations:
                original_text = translation.get('original', '').strip()
                translated_text = translation.get('translated', '').strip()
                
                if not translated_text or not original_text:
                    continue
                
                # 一致するシェイプを探す
                for shape_info in shape_text_map:
                    if shape_info['type'] == 'text':
                        # テキストが一致する場合
                        if shape_info['original_text'] == original_text:
                            shape = shape_info['shape']
                            # フォーマットを保持するため、最初の段落のフォーマットを維持
                            if shape.text_frame.paragraphs:
                                # 元のフォーマットを保存
                                first_paragraph = shape.text_frame.paragraphs[0]
                                if first_paragraph.runs:
                                    # フォント設定を保存
                                    font_name = first_paragraph.runs[0].font.name
                                    font_size = first_paragraph.runs[0].font.size
                                    font_bold = first_paragraph.runs[0].font.bold
                                    font_italic = first_paragraph.runs[0].font.italic
                                    
                                    # テキストを置換
                                    shape.text = translated_text
                                    
                                    # フォーマットを復元（可能な場合）
                                    if shape.text_frame.paragraphs[0].runs:
                                        run = shape.text_frame.paragraphs[0].runs[0]
                                        if font_name:
                                            run.font.name = font_name
                                        if font_size:
                                            run.font.size = font_size
                                        if font_bold is not None:
                                            run.font.bold = font_bold
                                        if font_italic is not None:
                                            run.font.italic = font_italic
                                else:
                                    # 単純に置換
                                    shape.text = translated_text
                            else:
                                shape.text = translated_text
                            
                            applied_count += 1
                            break
                    
                    elif shape_info['type'] == 'table' and translation.get('isTable'):
                        # テーブルの場合（タブと改行で区切られた文字列として比較）
                        table_text = '\n'.join(['\t'.join(row) for row in shape_info['table_content']])
                        if table_text == original_text:
                            # 翻訳文をテーブル形式に変換
                            shape = shape_info['shape']
                            translated_rows = translated_text.split('\n')
                            for row_idx, row in enumerate(shape.table.rows):
                                if row_idx < len(translated_rows):
                                    translated_cells = translated_rows[row_idx].split('\t')
                                    for col_idx, cell in enumerate(row.cells):
                                        if col_idx < len(translated_cells):
                                            cell.text = translated_cells[col_idx]
                                            applied_count += 1
                            break
        
        # ファイルを保存
        prs.save(output_path)
        
        return {
            "success": True,
            "applied_count": applied_count,
            "output_path": output_path,
            "message": f"翻訳を{applied_count}箇所に適用しました"
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "message": f"翻訳の適用中にエラーが発生しました: {str(e)}"
        }

def main():
    if len(sys.argv) != 4:
        print(json.dumps({
            "success": False,
            "error": "Usage: python apply_translations.py <input_pptx> <output_pptx> <translations_json>"
        }))
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    translations_json = sys.argv[3]
    
    result = apply_translations_to_pptx(input_path, output_path, translations_json)
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()