'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface ProgressStep {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message?: string;
  startedAt?: string;
  completedAt?: string;
}

export default function RealtimeProgress({ fileId }: { fileId: string }) {
  const [steps, setSteps] = useState<ProgressStep[]>([
    { id: 'upload', name: 'ファイルアップロード', status: 'completed', progress: 100 },
    { id: 'extract', name: 'テキスト抽出', status: 'pending', progress: 0 },
    { id: 'translate', name: 'AI翻訳処理', status: 'pending', progress: 0 },
    { id: 'generate', name: 'ファイル生成', status: 'pending', progress: 0 },
  ]);
  const [overallProgress, setOverallProgress] = useState(25);

  useEffect(() => {
    const supabase = createClient();
    
    // Realtimeサブスクリプション
    const channel = supabase
      .channel(`file-progress-${fileId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'files',
          filter: `id=eq.${fileId}`
        },
        (payload) => {
          const { progress_data } = payload.new;
          if (progress_data) {
            updateProgress(progress_data);
          }
        }
      )
      .subscribe();

    // 初期データ取得
    fetchInitialProgress();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fileId]);

  const updateProgress = (progressData: any) => {
    setSteps(progressData.steps || steps);
    setOverallProgress(progressData.overall || 0);
  };

  const fetchInitialProgress = async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('files')
      .select('progress_data')
      .eq('id', fileId)
      .single();
    
    if (data?.progress_data) {
      updateProgress(data.progress_data);
    }
  };

  // Design.md準拠のステータス表示
  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return '✅';
      case 'processing':
        return '⏳';
      case 'failed':
        return '❌';
      default:
        return '⏸️';
    }
  };

  const getStepColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-500'; // Design.md: アクセントカラー
      case 'processing':
        return 'bg-blue-600 animate-pulse'; // Design.md: プライマリカラー + アニメーション
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-slate-300';
    }
  };

  const getStepTextColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-emerald-600';
      case 'processing':
        return 'text-blue-600';
      case 'failed':
        return 'text-red-600';
      default:
        return 'text-slate-500';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h3 className="font-bold text-slate-900 mb-6 flex items-center">
        <span className="text-2xl mr-2">📊</span>
        処理状況
      </h3>
      
      {/* 全体プログレスバー - Design.md準拠のグラデーション */}
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium text-slate-700">全体進捗</span>
          <span className="text-sm font-bold text-slate-900">{overallProgress}%</span>
        </div>
        <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-500 ease-out"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>

      {/* ステップごとの進捗 - Design.md準拠のビジュアルフィードバック */}
      <div className="space-y-4">
        {steps.map((step, index) => (
          <div key={step.id} className="relative">
            {/* 縦線 */}
            {index < steps.length - 1 && (
              <div 
                className={`absolute left-4 top-10 w-0.5 h-12 transition-all duration-300
                  ${step.status === 'completed' ? 'bg-emerald-500' : 'bg-slate-200'}`} 
              />
            )}
            
            <div className="flex items-start space-x-4">
              {/* アイコン */}
              <div className="flex-shrink-0 mt-1 text-2xl">
                {getStepIcon(step.status)}
              </div>
              
              {/* コンテンツ */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h4 className={`font-medium transition-all duration-200 ${getStepTextColor(step.status)}`}>
                    {step.name}
                  </h4>
                  {step.status === 'processing' && (
                    <span className="text-sm text-blue-600 font-medium animate-pulse">
                      {step.progress}%
                    </span>
                  )}
                </div>
                
                {/* プログレスバー（処理中のみ） */}
                {step.status === 'processing' && (
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden mb-2">
                    <div 
                      className={`h-full ${getStepColor(step.status)} transition-all duration-300`}
                      style={{ width: `${step.progress}%` }}
                    />
                  </div>
                )}
                
                {/* メッセージ */}
                {step.message && (
                  <p className="text-sm text-slate-600 italic">{step.message}</p>
                )}
                
                {/* 時刻表示 */}
                {step.completedAt && (
                  <p className="text-xs text-slate-500 mt-1">
                    完了: {new Date(step.completedAt).toLocaleTimeString('ja-JP')}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ローディングインジケーター - Design.md準拠 */}
      {steps.some(s => s.status === 'processing') && (
        <div className="mt-6 flex items-center justify-center">
          <div className="flex space-x-2">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      )}
    </div>
  );
}