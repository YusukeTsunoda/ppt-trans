import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import LazyImage from '@/components/LazyImage';

describe('LazyImage', () => {
  it('正しくレンダリングされる', () => {
    render(<LazyImage src="/test-image.jpg" alt="Test Image" />);
    expect(screen.getByTestId('LazyImage')).toBeInTheDocument();
  });
});
