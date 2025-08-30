import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixFilesTable() {
  console.log('=========================================');
  console.log('filesテーブルの修正');
  console.log('=========================================\n');

  try {
    // 1. 現在のテーブル構造を確認
    console.log('📊 現在のfilesテーブル構造:');
    const { data: currentColumns, error: columnsError } = await supabase.rpc('get_columns_info', {
      p_table_name: 'files'
    }).single();

    if (!columnsError && currentColumns) {
      console.log(currentColumns);
    }

    // 2. カラム名の修正
    console.log('\n🔧 カラム名の修正を実行中...');
    
    // original_name -> original_filename
    try {
      await supabase.rpc('rename_column_if_exists', {
        p_table_name: 'files',
        p_old_column: 'original_name',
        p_new_column: 'original_filename'
      });
      console.log('✅ original_name -> original_filename');
    } catch (e) {
      console.log('⚠️  original_name カラムが見つからないか、既に変更済み');
    }

    // file_path -> storage_path
    try {
      await supabase.rpc('rename_column_if_exists', {
        p_table_name: 'files',
        p_old_column: 'file_path',
        p_new_column: 'storage_path'
      });
      console.log('✅ file_path -> storage_path');
    } catch (e) {
      console.log('⚠️  file_path カラムが見つからないか、既に変更済み');
    }

    // 3. statusカラムの制約を更新
    console.log('\n🔧 status制約の更新...');
    try {
      await supabase.rpc('update_status_constraint');
      console.log('✅ status制約を更新しました（uploadedを追加）');
    } catch (e) {
      console.log('⚠️  status制約の更新に失敗（既に更新済みの可能性）');
    }

    // 4. 更新後のテーブル構造を確認
    console.log('\n📊 更新後のfilesテーブル構造:');
    const { data: updatedColumns, error: updatedError } = await supabase.rpc('get_columns_info', {
      p_table_name: 'files'
    }).single();

    if (!updatedError && updatedColumns) {
      console.log(updatedColumns);
    }

    console.log('\n✅ filesテーブルの修正が完了しました');

  } catch (error) {
    console.error('エラーが発生しました:', error);
  }
}

// 必要な関数を作成
async function createHelperFunctions() {
  console.log('ヘルパー関数を作成中...');
  
  const functions = [
    {
      name: 'get_columns_info',
      sql: `
        CREATE OR REPLACE FUNCTION get_columns_info(p_table_name text)
        RETURNS json AS $$
        BEGIN
          RETURN (
            SELECT json_agg(
              json_build_object(
                'column_name', column_name,
                'data_type', data_type,
                'is_nullable', is_nullable
              ) ORDER BY ordinal_position
            )
            FROM information_schema.columns
            WHERE table_schema = 'public' 
            AND table_name = p_table_name
          );
        END;
        $$ LANGUAGE plpgsql;
      `
    },
    {
      name: 'rename_column_if_exists',
      sql: `
        CREATE OR REPLACE FUNCTION rename_column_if_exists(
          p_table_name text,
          p_old_column text,
          p_new_column text
        )
        RETURNS void AS $$
        BEGIN
          IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = p_table_name 
            AND column_name = p_old_column 
            AND table_schema = 'public'
          ) THEN
            EXECUTE format('ALTER TABLE public.%I RENAME COLUMN %I TO %I',
              p_table_name, p_old_column, p_new_column);
          END IF;
        END;
        $$ LANGUAGE plpgsql;
      `
    },
    {
      name: 'update_status_constraint',
      sql: `
        CREATE OR REPLACE FUNCTION update_status_constraint()
        RETURNS void AS $$
        BEGIN
          ALTER TABLE public.files DROP CONSTRAINT IF EXISTS files_status_check;
          ALTER TABLE public.files ADD CONSTRAINT files_status_check 
            CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'uploaded'));
        END;
        $$ LANGUAGE plpgsql;
      `
    }
  ];

  for (const func of functions) {
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: func.sql });
      if (!error) {
        console.log(`✅ ${func.name} 関数を作成しました`);
      }
    } catch (e) {
      // エラーを無視（関数が既に存在する場合など）
    }
  }
}

// メイン実行
async function main() {
  await createHelperFunctions();
  await fixFilesTable();
}

main().catch(console.error);