import React from 'react';
import { render, screen } from '@testing-library/react';
import { useFormStatus } from 'react-dom';
import { SubmitButton } from '../../../src/components/SubmitButton';

// Mock react-dom
jest.mock('react-dom', () => ({
  useFormStatus: jest.fn(),
}));

const mockUseFormStatus = useFormStatus as jest.MockedFunction<typeof useFormStatus>;

describe('SubmitButton', () => {
  beforeEach(() => {
    mockUseFormStatus.mockReset();
  });

  test('renders with default text when not pending', () => {
    mockUseFormStatus.mockReturnValue({ pending: false });
    
    render(
      <SubmitButton 
        text="Submit" 
        pendingText="Submitting..." 
      />
    );
    
    expect(screen.getByRole('button')).toHaveTextContent('Submit');
    expect(screen.getByRole('button')).not.toBeDisabled();
  });

  test('renders with pending text and spinner when pending', () => {
    mockUseFormStatus.mockReturnValue({ pending: true });
    
    render(
      <SubmitButton 
        text="Submit" 
        pendingText="Submitting..." 
      />
    );
    
    expect(screen.getByRole('button')).toHaveTextContent('Submitting...');
    expect(screen.getByRole('button')).toBeDisabled();
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  test('is disabled when disabled prop is true', () => {
    mockUseFormStatus.mockReturnValue({ pending: false });
    
    render(
      <SubmitButton 
        text="Submit" 
        pendingText="Submitting..." 
        disabled={true}
      />
    );
    
    expect(screen.getByRole('button')).toBeDisabled();
  });

  test('applies custom className', () => {
    mockUseFormStatus.mockReturnValue({ pending: false });
    
    render(
      <SubmitButton 
        text="Submit" 
        pendingText="Submitting..." 
        className="custom-class"
      />
    );
    
    expect(screen.getByRole('button')).toHaveClass('custom-class');
  });

  test('is disabled when both pending and disabled are true', () => {
    mockUseFormStatus.mockReturnValue({ pending: true });
    
    render(
      <SubmitButton 
        text="Submit" 
        pendingText="Submitting..." 
        disabled={true}
      />
    );
    
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByRole('button')).toHaveTextContent('Submitting...');
  });
});