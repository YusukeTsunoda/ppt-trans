'use client';

import UploadForm from '@/components/upload/UploadForm';
import Link from 'next/link';
import { useTranslation } from '@/hooks/useTranslation';

export default function UploadPage() {
  const { t } = useTranslation();
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">{t('uploadTitle')}</h1>
          
          <UploadForm />
          
          <div className="mt-6">
            <Link 
              href="/dashboard"
              className="inline-block px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500"
            >
              {t('backToDashboard')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}