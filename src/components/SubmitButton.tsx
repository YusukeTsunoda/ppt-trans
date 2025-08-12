'use client';

import { useFormStatus } from 'react-dom';

interface SubmitButtonProps {
  text: string;
  pendingText: string;
  disabled?: boolean;
  className?: string;
}

export function SubmitButton({ 
  text, 
  pendingText, 
  disabled = false,
  className = ''
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  
  return (
    <button 
      type="submit" 
      disabled={pending || disabled}
      className={className}
    >
      {pending ? (
        <>
          <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full mr-2"></span>
          {pendingText}
        </>
      ) : (
        text
      )}
    </button>
  );
}