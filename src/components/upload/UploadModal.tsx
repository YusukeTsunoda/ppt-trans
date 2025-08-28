'use client';

import { useState, useRef } from 'react';
import { X, Upload, FileText } from 'lucide-react';
import { fetchWithCSRF } from '@/hooks/useCSRF';
// Removed Server Action import - will use API Routes instead

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (file: any) => void;
}

export function UploadModal({ isOpen, onClose, onSuccess }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    validateAndSetFile(droppedFile);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      validateAndSetFile(selectedFile);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    if (selectedFile.type !== 'application/vnd.openxmlformats-officedocument.presentationml.presentation' &&
        !selectedFile.name.endsWith('.pptx')) {
      setError('PowerPoint (.pptx) ファイルを選択してください。');
      setFile(null);
    } else if (selectedFile.size > 100 * 1024 * 1024) { // 100MB
      setError('ファイルサイズは100MB以下にしてください。');
      setFile(null);
    } else {
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setIsUploading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      // API Routeを使用
      const response = await fetchWithCSRF('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const result = await response.json();
        onSuccess(result.file);
        onClose();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'アップロードに失敗しました');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'アップロード中にエラーが発生しました');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-lg max-w-xl w-full max-h-[90vh] overflow-hidden shadow-xl">
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              ファイルをアップロード
            </h2>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        <div className="p-6">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm font-semibold text-foreground mb-2">
              ファイルをドラッグ&ドロップ
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              または
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              ファイルを選択
            </button>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              className="hidden"
            />
            <p className="mt-4 text-xs text-muted-foreground">
              対応形式: PowerPoint (.pptx) / 最大サイズ: 100MB
            </p>
          </div>
          
          {file && (
            <div className="mt-4 p-4 bg-muted rounded-lg flex items-center justify-between">
              <div className="flex items-center">
                <FileText className="h-5 w-5 text-primary mr-2" />
                <span className="text-sm text-foreground">{file.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                </span>
              </div>
              <button
                onClick={() => setFile(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          
          {error && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </div>
        
        <div className="p-6 border-t border-border flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isUploading}
            className="px-4 py-2 text-sm font-medium text-foreground bg-background border border-border rounded-md hover:bg-muted transition-colors disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || isUploading}
            className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isUploading ? 'アップロード中...' : 'アップロード'}
          </button>
        </div>
      </div>
    </div>
  );
}