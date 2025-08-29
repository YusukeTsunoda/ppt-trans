import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ErrorBoundary from '@/components/ErrorBoundary';

describe('ErrorBoundary', () => {
  it('正しくレンダリングされる', () => {
    render(
      <ErrorBoundary>
        <div data-testid="test-child">Test Child</div>
      </ErrorBoundary>
    );
    // ErrorBoundaryはエラーがない場合、childrenをそのままレンダリングする
    expect(screen.getByTestId('test-child')).toBeInTheDocument();
    expect(screen.getByText('Test Child')).toBeInTheDocument();
  });
});
