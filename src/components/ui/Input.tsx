import React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, icon, id, ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
    
    return (
      <div className="w-full">
        {label && (
          <label 
            htmlFor={inputId} 
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            {label}
          </label>
        )}
        
        <div className="relative">
          {icon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-slate-500">{icon}</span>
            </div>
          )}
          
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full border rounded-xl px-4 py-3 transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
              'bg-white dark:bg-slate-800',
              'border-slate-200 dark:border-slate-600',
              'text-slate-900 dark:text-white',
              'placeholder-slate-400 dark:placeholder-slate-500',
              icon && 'pl-11',
              error && 'border-red-500 focus:ring-red-500 focus:border-red-500',
              className
            )}
            {...props}
          />
        </div>
        
        {hint && !error && (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{hint}</p>
        )}
        
        {error && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400 animate-fadeIn">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;