'use client';

import dynamic from 'next/dynamic';
import { ProcessingResult } from '@/types';

const PreviewScreen = dynamic(
  () => import('./PreviewScreen').then(mod => ({ default: mod.PreviewScreen })),
  {
    loading: () => (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">プレビューを読み込み中...</p>
        </div>
      </div>
    ),
  }
);

interface LazyPreviewScreenProps {
  data: ProcessingResult;
  onBack: () => void;
  onDataUpdate?: (updatedData: ProcessingResult) => void;
  historyId?: string | null;
}

export function LazyPreviewScreen(props: LazyPreviewScreenProps) {
  return <PreviewScreen {...props} />;
}