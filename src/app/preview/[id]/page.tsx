'use server';

import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { DynamicPreviewView } from '@/lib/optimization/dynamic-components';

interface PreviewPageProps {
  params: Promise<{ id: string }>;
}

// Loading component for the preview page
function PreviewPageSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 animate-pulse">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header skeleton */}
        <div className="bg-white rounded-xl shadow-sm mb-6 p-5 border border-slate-200">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="h-4 bg-slate-200 rounded w-32"></div>
              <div className="h-6 bg-slate-200 rounded w-48"></div>
            </div>
            <div className="flex gap-2">
              <div className="h-8 bg-slate-200 rounded w-24"></div>
              <div className="h-8 bg-slate-200 rounded w-32"></div>
              <div className="h-8 bg-slate-200 rounded w-28"></div>
            </div>
          </div>
        </div>
        
        {/* Main content skeleton */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-slate-200">
          <div className="h-64 bg-slate-200 rounded"></div>
        </div>
        
        {/* Text content skeleton */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="h-6 bg-slate-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="border rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                    <div className="h-12 bg-slate-200 rounded"></div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                    <div className="h-12 bg-slate-200 rounded"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function PreviewPage({ params }: PreviewPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  
  const { data: file, error } = await supabase
    .from('files')
    .select(`
      id,
      filename,
      original_name,
      file_size,
      status,
      file_path,
      extracted_data,
      created_at
    `)
    .eq('id', id)
    .single();

  if (error || !file) {
    notFound();
  }

  // Use Suspense boundary for dynamic import with proper fallback
  return (
    <Suspense fallback={<PreviewPageSkeleton />}>
      <DynamicPreviewView file={file} />
    </Suspense>
  );
}

// Add metadata for better SEO
export async function generateMetadata({ params }: PreviewPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  
  const { data: file } = await supabase
    .from('files')
    .select('original_name')
    .eq('id', id)
    .single();

  return {
    title: file?.original_name ? `プレビュー: ${file.original_name}` : 'ファイルプレビュー',
    description: 'PowerPointファイルの内容をプレビューし、翻訳を実行できます。',
  };
}