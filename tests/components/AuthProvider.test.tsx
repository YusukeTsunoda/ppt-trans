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
    // AuthProviderはchildrenをレンダリングする
    expect(screen.getByTestId('test-child')).toBeInTheDocument();
    expect(screen.getByText('Test Child')).toBeInTheDocument();
  });
});
