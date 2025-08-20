import React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  variant?: 'default' | 'bordered' | 'elevated';
  interactive?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ 
    className, 
    title, 
    description, 
    icon,
    action,
    variant = 'default',
    interactive = false,
    children, 
    ...props 
  }, ref) => {
    const variants = {
      default: 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-soft',
      bordered: 'bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-600',
      elevated: 'bg-white dark:bg-slate-800 shadow-lg hover:shadow-xl'
    };
    
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-2xl p-8 transition-all duration-200',
          variants[variant],
          interactive && 'hover:shadow-lg cursor-pointer hover:-translate-y-1 transform',
          'animate-fadeIn',
          className
        )}
        {...props}
      >
        {(title || description || icon || action) && (
          <div className="mb-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                {icon && (
                  <div className="flex-shrink-0 text-blue-600 dark:text-blue-400">
                    {icon}
                  </div>
                )}
                <div>
                  {title && (
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                      {title}
                    </h3>
                  )}
                  {description && (
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      {description}
                    </p>
                  )}
                </div>
              </div>
              {action && (
                <div className="flex-shrink-0 ml-4">
                  {action}
                </div>
              )}
            </div>
          </div>
        )}
        
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export default Card;