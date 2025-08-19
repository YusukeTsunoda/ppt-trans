#!/usr/bin/env python3
"""Test script for table cell translation functionality"""

import json
import sys
import os
import tempfile
from pathlib import Path

# Add the parent directory to the path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.lib.pptx.extract_text import extract_text_from_pptx
from src.lib.pptx.apply_translations import apply_translations_to_pptx

def test_table_translation():
    """Test table cell extraction and translation application"""
    
    # Test file path
    test_file = "e2e/fixtures/test-presentation.pptx"
    
    print("=== Step 1: Extract text from PowerPoint ===")
    extraction_result = extract_text_from_pptx(test_file)
    
    if not extraction_result["success"]:
        print(f"Error extracting text: {extraction_result.get('error')}")
        return False
    
    print(f"Successfully extracted text from {extraction_result['total_slides']} slides")
    
    # Find slide with table
    table_slide = None
    for slide in extraction_result["slides"]:
        for text_item in slide["texts"]:
            if text_item.get("shape_type") == "TABLE" and text_item.get("cells"):
                table_slide = slide
                break
        if table_slide:
            break
    
    if not table_slide:
        print("No table found in test file")
        return False
    
    print(f"\n=== Step 2: Found table on slide {table_slide['slide_number']} ===")
    
    # Display table cells
    table_text_item = next(t for t in table_slide["texts"] if t.get("cells"))
    print(f"Table has {table_text_item['table_info']['rows']} rows and {table_text_item['table_info']['cols']} columns")
    print("\nTable cells:")
    for cell in table_text_item["cells"]:
        print(f"  [{cell['row']},{cell['col']}]: {cell['text']}")
    
    print("\n=== Step 3: Create translations for each cell ===")
    
    # Create mock translations for each cell
    translations_data = {
        "slides": [
            {
                "slide_number": table_slide["slide_number"],
                "translations": []
            }
        ]
    }
    
    # Add translations for each cell
    for cell in table_text_item["cells"]:
        translations_data["slides"][0]["translations"].append({
            "original": cell["text"],
            "translated": f"[翻訳済み] {cell['text']}"
        })
    
    print("Created translations:")
    for trans in translations_data["slides"][0]["translations"]:
        print(f"  {trans['original']} -> {trans['translated']}")
    
    print("\n=== Step 4: Apply translations to PowerPoint ===")
    
    # Create output file
    output_file = tempfile.mktemp(suffix=".pptx")
    
    result = apply_translations_to_pptx(
        test_file,
        output_file,
        json.dumps(translations_data, ensure_ascii=False)
    )
    
    if not result["success"]:
        print(f"Error applying translations: {result.get('error')}")
        return False
    
    print(f"Successfully applied {result['applied_count']} translations")
    print(f"Output file: {output_file}")
    
    # Verify the output by extracting text again
    print("\n=== Step 5: Verify translations in output file ===")
    verification_result = extract_text_from_pptx(output_file)
    
    if verification_result["success"]:
        # Find the table slide again
        for slide in verification_result["slides"]:
            if slide["slide_number"] == table_slide["slide_number"]:
                for text_item in slide["texts"]:
                    if text_item.get("cells"):
                        print("Table cells after translation:")
                        for cell in text_item["cells"]:
                            print(f"  [{cell['row']},{cell['col']}]: {cell['text']}")
                        break
                break
    
    # Clean up
    if os.path.exists(output_file):
        os.remove(output_file)
    
    return True

if __name__ == "__main__":
    success = test_table_translation()
    sys.exit(0 if success else 1)