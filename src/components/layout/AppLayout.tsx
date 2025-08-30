'use client';

import React from 'react';
import AppHeader from './AppHeader';

interface AppLayoutProps {
  children: React.ReactNode;
  userEmail: string;
  onUploadClick?: () => void;
  showUploadButton?: boolean;
}

export default function AppLayout({ 
  children, 
  userEmail, 
  onUploadClick, 
  showUploadButton = true 
}: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <AppHeader 
        userEmail={userEmail} 
        onUploadClick={onUploadClick}
        showUploadButton={showUploadButton}
      />
      {children}
    </div>
  );
}