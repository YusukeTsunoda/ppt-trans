import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ThemeProvider from '@/components/ThemeProvider';

describe('ThemeProvider', () => {
  it('正しくレンダリングされる', () => {
    render(<ThemeProvider />);
    expect(screen.getByTestId('ThemeProvider')).toBeInTheDocument();
  });
});
