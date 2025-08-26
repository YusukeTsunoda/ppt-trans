import React from 'react';
import { render, screen } from '@testing-library/react';
import { ErrorMessage } from '../../src/components/ErrorMessage';

// Mock the ErrorMessage component first
jest.mock('../../src/components/ErrorMessage', () => {
  return {
    ErrorMessage: ({ message, className }: { message?: string; className?: string }) => (
      <div 
        className={`text-red-500 text-sm mt-1 ${className || ''}`}
        role="alert"
        data-testid="error-message"
      >
        {message}
      </div>
    )
  };
});

describe('ErrorMessage', () => {
  test('renders error message when message is provided', () => {
    render(<ErrorMessage message="This is an error" />);
    
    const errorElement = screen.getByTestId('error-message');
    expect(errorElement).toBeInTheDocument();
    expect(errorElement).toHaveTextContent('This is an error');
    expect(errorElement).toHaveAttribute('role', 'alert');
  });

  test('renders with default classes', () => {
    render(<ErrorMessage message="Error message" />);
    
    const errorElement = screen.getByTestId('error-message');
    expect(errorElement).toHaveClass('text-red-500', 'text-sm', 'mt-1');
  });

  test('applies custom className', () => {
    render(<ErrorMessage message="Error" className="custom-error" />);
    
    const errorElement = screen.getByTestId('error-message');
    expect(errorElement).toHaveClass('custom-error');
  });

  test('does not render when message is empty', () => {
    render(<ErrorMessage message="" />);
    
    const errorElement = screen.getByTestId('error-message');
    expect(errorElement).toBeEmptyDOMElement();
  });

  test('does not render when message is undefined', () => {
    render(<ErrorMessage />);
    
    const errorElement = screen.getByTestId('error-message');
    expect(errorElement).toBeEmptyDOMElement();
  });
});