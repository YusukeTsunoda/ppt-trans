import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ToastProvider } from '@/components/Toast';

describe('ToastProvider', () => {
  it('正しくレンダリングされる', () => {
    render(
      <ToastProvider>
        <div data-testid="test-child">Test Child</div>
      </ToastProvider>
    );
    // ToastProviderはchildrenをレンダリングする
    expect(screen.getByTestId('test-child')).toBeInTheDocument();
    expect(screen.getByText('Test Child')).toBeInTheDocument();
  });
});
