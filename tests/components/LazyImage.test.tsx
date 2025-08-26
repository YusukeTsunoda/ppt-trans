import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import LazyImage from '@/components/LazyImage';

describe('LazyImage', () => {
  it('正しくレンダリングされる', () => {
    render(<LazyImage />);
    expect(screen.getByTestId('LazyImage')).toBeInTheDocument();
  });
});
