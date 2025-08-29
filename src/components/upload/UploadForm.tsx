'use client';

// @ts-ignore - React 19 exports
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { UploadState } from '@/app/actions/upload';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FILE_EXTENSIONS, FILE_SIZE_LIMITS } from '@/constants/mime-types';

function SubmitButton() {
  const { pending } = useFormStatus();
  
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? (
        <>
          <svg className="inline-block mr-2 animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
          アップロード中...
        </>
      ) : (
        'アップロード'
      )}
    </button>
  );
}

interface UploadFormProps {
  action: (prevState: UploadState | null, formData: FormData) => Promise<UploadState>;
}

export default function UploadForm({ action }: UploadFormProps) {
  const [state, formAction] = useActionState(action, null);
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<number>(0);
  const router = useRouter();
  
  // 成功時にダッシュボードへリダイレクト
  useEffect(() => {
    if (state?.success) {
      const timer = setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [state?.success, router]);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      setFileSize(file.size);
    } else {
      setFileName('');
      setFileSize(0);
    }
  };
  
  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">
          ファイルを選択
        </label>
        <input
          type="file"
          name="file"
          accept={FILE_EXTENSIONS.POWERPOINT}
          onChange={handleFileChange}
          disabled={state?.success}
          required
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
        />
        <p className="mt-1 text-sm text-gray-500">
          対応形式: .pptx, .ppt（最大{FILE_SIZE_LIMITS.MAX_FILE_SIZE_LABEL}）
        </p>
      </div>
      
      {fileName && (
        <div className="p-3 bg-gray-100 rounded">
          <p className="text-sm">
            <span className="font-medium">選択されたファイル:</span> {fileName}
          </p>
          <p className="text-sm">
            <span className="font-medium">サイズ:</span> {(fileSize / 1024 / 1024).toFixed(2)} MB
          </p>
        </div>
      )}
      
      {state?.error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded">
          <p className="text-red-700 text-sm">{state.error}</p>
        </div>
      )}
      
      {state?.success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded">
          <p className="text-green-700 text-sm">
            {state.message} ダッシュボードに移動します...
          </p>
        </div>
      )}
      
      <SubmitButton />
    </form>
  );
}