#!/usr/bin/env python3
"""PowerPointファイルに翻訳文を適用するスクリプト（フォント属性完全保持版）"""

import json
import sys
import os
from pptx import Presentation
from pptx.util import Pt
from pptx.dml.color import RGBColor
from typing import Dict, List, Any, Optional

def preserve_run_format(source_run, target_run):
    """
    ソースのrunからターゲットのrunにすべてのフォーマット属性をコピー
    
    Args:
        source_run: コピー元のrun
        target_run: コピー先のrun
    """
    try:
        # フォント名
        if source_run.font.name:
            target_run.font.name = source_run.font.name
        
        # フォントサイズ
        if source_run.font.size:
            target_run.font.size = source_run.font.size
        
        # 太字
        if source_run.font.bold is not None:
            target_run.font.bold = source_run.font.bold
        
        # 斜体
        if source_run.font.italic is not None:
            target_run.font.italic = source_run.font.italic
        
        # 下線
        if source_run.font.underline is not None:
            target_run.font.underline = source_run.font.underline
        
        # 取り消し線
        try:
            if hasattr(source_run.font, 'strike') and source_run.font.strike is not None:
                target_run.font.strike = source_run.font.strike
        except:
            pass
        
        # フォント色
        try:
            if source_run.font.color and hasattr(source_run.font.color, 'rgb') and source_run.font.color.rgb:
                target_run.font.color.rgb = source_run.font.color.rgb
        except:
            pass
        
        # ハイライト色
        try:
            if hasattr(source_run.font, 'highlight_color') and source_run.font.highlight_color:
                target_run.font.highlight_color = source_run.font.highlight_color
        except:
            pass
            
    except Exception as e:
        # エラーが発生してもスキップして続行
        pass

def preserve_paragraph_format(source_paragraph, target_paragraph):
    """
    段落レベルのフォーマットを保持
    
    Args:
        source_paragraph: コピー元の段落
        target_paragraph: コピー先の段落
    """
    try:
        # 段落の配置
        if source_paragraph.alignment is not None:
            target_paragraph.alignment = source_paragraph.alignment
        
        # 段落のレベル（インデント）
        if source_paragraph.level is not None:
            target_paragraph.level = source_paragraph.level
        
        # 行間
        if source_paragraph.line_spacing is not None:
            target_paragraph.line_spacing = source_paragraph.line_spacing
        
        # 段落前後のスペース
        if source_paragraph.space_before is not None:
            target_paragraph.space_before = source_paragraph.space_before
        if source_paragraph.space_after is not None:
            target_paragraph.space_after = source_paragraph.space_after
            
    except Exception as e:
        pass

def apply_translations_to_pptx(input_path: str, output_path: str, translations_json: str) -> Dict[str, Any]:
    """
    PowerPointファイルに翻訳文を適用（フォーマット完全保持版）
    
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
            
            # 各翻訳を適用
            for translation in translations:
                original_text = translation.get('original', '').strip()
                translated_text = translation.get('translated', '').strip()
                
                if not translated_text or not original_text:
                    continue
                
                # すべてのシェイプを検索
                for shape in slide.shapes:
                    # テキストフレームを持つシェイプの処理
                    if hasattr(shape, 'text_frame') and shape.has_text_frame:
                        if shape.text.strip() == original_text:
                            # フォーマットを完全に保持して置換
                            text_frame = shape.text_frame
                            
                            # 元のフォーマット情報を保存
                            original_paragraphs_format = []
                            for para in text_frame.paragraphs:
                                para_format = {
                                    'alignment': para.alignment,
                                    'level': para.level,
                                    'line_spacing': para.line_spacing,
                                    'space_before': para.space_before,
                                    'space_after': para.space_after,
                                    'runs': []
                                }
                                
                                for run in para.runs:
                                    run_format = {
                                        'font_name': run.font.name,
                                        'font_size': run.font.size,
                                        'font_bold': run.font.bold,
                                        'font_italic': run.font.italic,
                                        'font_underline': run.font.underline,
                                        'font_color_rgb': None
                                    }
                                    
                                    # フォント色を安全に取得
                                    try:
                                        if run.font.color and hasattr(run.font.color, 'rgb') and run.font.color.rgb:
                                            run_format['font_color_rgb'] = run.font.color.rgb
                                    except:
                                        pass
                                    
                                    para_format['runs'].append(run_format)
                                
                                original_paragraphs_format.append(para_format)
                            
                            # テキストをクリアして新しいテキストを設定
                            text_frame.clear()
                            
                            # 翻訳されたテキストを段落に分割
                            translated_lines = translated_text.split('\n')
                            
                            for i, line in enumerate(translated_lines):
                                if i == 0 and text_frame.paragraphs:
                                    # 最初の段落は既に存在する
                                    p = text_frame.paragraphs[0]
                                else:
                                    # 新しい段落を追加
                                    p = text_frame.add_paragraph()
                                
                                # 元のフォーマットを適用
                                if i < len(original_paragraphs_format):
                                    para_format = original_paragraphs_format[i]
                                    
                                    # 段落のフォーマットを復元
                                    if para_format['alignment'] is not None:
                                        p.alignment = para_format['alignment']
                                    if para_format['level'] is not None:
                                        p.level = para_format['level']
                                    if para_format['line_spacing'] is not None:
                                        p.line_spacing = para_format['line_spacing']
                                    if para_format['space_before'] is not None:
                                        p.space_before = para_format['space_before']
                                    if para_format['space_after'] is not None:
                                        p.space_after = para_format['space_after']
                                    
                                    # runを追加してフォーマットを適用
                                    run = p.add_run()
                                    run.text = line
                                    
                                    # 最初のrunのフォーマットを適用
                                    if para_format['runs']:
                                        run_format = para_format['runs'][0]
                                        if run_format['font_name']:
                                            run.font.name = run_format['font_name']
                                        if run_format['font_size']:
                                            run.font.size = run_format['font_size']
                                        if run_format['font_bold'] is not None:
                                            run.font.bold = run_format['font_bold']
                                        if run_format['font_italic'] is not None:
                                            run.font.italic = run_format['font_italic']
                                        if run_format['font_underline'] is not None:
                                            run.font.underline = run_format['font_underline']
                                        if run_format['font_color_rgb']:
                                            try:
                                                run.font.color.rgb = run_format['font_color_rgb']
                                            except:
                                                pass
                                else:
                                    # デフォルトでテキストを追加
                                    p.text = line
                            
                            applied_count += 1
                    
                    # テーブルの処理
                    elif shape.has_table:
                        for row in shape.table.rows:
                            for cell in row.cells:
                                if cell.text.strip() == original_text:
                                    # セルのフォーマットを保持
                                    text_frame = cell.text_frame
                                    
                                    # 元のフォーマット情報を保存
                                    original_format = None
                                    if text_frame.paragraphs and text_frame.paragraphs[0].runs:
                                        first_run = text_frame.paragraphs[0].runs[0]
                                        original_format = {
                                            'font_name': first_run.font.name,
                                            'font_size': first_run.font.size,
                                            'font_bold': first_run.font.bold,
                                            'font_italic': first_run.font.italic,
                                            'font_underline': first_run.font.underline,
                                            'font_color_rgb': None,
                                            'alignment': text_frame.paragraphs[0].alignment
                                        }
                                        
                                        # フォント色を安全に取得
                                        try:
                                            if first_run.font.color and hasattr(first_run.font.color, 'rgb'):
                                                original_format['font_color_rgb'] = first_run.font.color.rgb
                                        except:
                                            pass
                                    
                                    # テキストをクリアして新しいテキストを設定
                                    text_frame.clear()
                                    p = text_frame.paragraphs[0]
                                    
                                    # フォーマットを復元
                                    if original_format:
                                        if original_format['alignment'] is not None:
                                            p.alignment = original_format['alignment']
                                        
                                        run = p.add_run()
                                        run.text = translated_text
                                        
                                        if original_format['font_name']:
                                            run.font.name = original_format['font_name']
                                        if original_format['font_size']:
                                            run.font.size = original_format['font_size']
                                        if original_format['font_bold'] is not None:
                                            run.font.bold = original_format['font_bold']
                                        if original_format['font_italic'] is not None:
                                            run.font.italic = original_format['font_italic']
                                        if original_format['font_underline'] is not None:
                                            run.font.underline = original_format['font_underline']
                                        if original_format['font_color_rgb']:
                                            try:
                                                run.font.color.rgb = original_format['font_color_rgb']
                                            except:
                                                pass
                                    else:
                                        p.text = translated_text
                                    
                                    applied_count += 1
        
        # ファイルを保存
        prs.save(output_path)
        
        return {
            "success": True,
            "applied_count": applied_count,
            "output_path": output_path,
            "message": f"翻訳を{applied_count}箇所に適用しました（フォーマット保持）"
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
            "error": "Usage: python apply_translations_v2.py <input_pptx> <output_pptx> <translations_json>"
        }))
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    translations_json = sys.argv[3]
    
    result = apply_translations_to_pptx(input_path, output_path, translations_json)
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()