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
    expect(screen.getByTestId('ErrorBoundary')).toBeInTheDocument();
  });
});
