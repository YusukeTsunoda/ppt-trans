import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AuthProvider from '@/components/AuthProvider';

describe('AuthProvider', () => {
  it('正しくレンダリングされる', () => {
    render(
      <AuthProvider>
        <div data-testid="test-child">Test Child</div>
      </AuthProvider>
    );
    expect(screen.getByTestId('AuthProvider')).toBeInTheDocument();
  });
});
