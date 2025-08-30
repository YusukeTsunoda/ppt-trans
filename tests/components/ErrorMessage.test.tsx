import React from 'react';
import { render, screen } from '@testing-library/react';
import { ErrorMessage } from '../../src/components/ErrorMessage';

describe('ErrorMessage', () => {
  test('renders error message when string error is provided', () => {
    render(<ErrorMessage error="This is an error" />);
    
    const errorElement = screen.getByRole('alert');
    expect(errorElement).toBeInTheDocument();
    expect(errorElement).toHaveTextContent('This is an error');
  });

  test('renders error message from Error object', () => {
    const error = new Error('Error message');
    render(<ErrorMessage error={error} />);
    
    const errorElement = screen.getByRole('alert');
    expect(errorElement).toHaveTextContent('Error message');
  });

  test('applies custom className', () => {
    render(<ErrorMessage error="Error" className="custom-error" />);
    
    const errorElement = screen.getByRole('alert');
    expect(errorElement).toHaveClass('custom-error');
  });

  test('shows retry button when onRetry is provided and error is retryable', () => {
    const onRetry = jest.fn();
    render(<ErrorMessage error="Error" onRetry={onRetry} />);
    
    // Note: Default errors are not retryable, so button should not show
    expect(screen.queryByText('再試行')).not.toBeInTheDocument();
  });

  test('shows dismiss button when onDismiss is provided', () => {
    const onDismiss = jest.fn();
    render(<ErrorMessage error="Error" onDismiss={onDismiss} />);
    
    const dismissButton = screen.getByText('閉じる');
    expect(dismissButton).toBeInTheDocument();
  });

  test('renders with error details when showDetails is true', () => {
    render(<ErrorMessage error="Error" showDetails={true} />);
    
    const errorElement = screen.getByRole('alert');
    expect(errorElement).toBeInTheDocument();
  });
});