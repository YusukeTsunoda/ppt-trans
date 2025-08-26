import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ErrorBoundary from '@/components/ErrorBoundary';

describe('ErrorBoundary', () => {
  it('正しくレンダリングされる', () => {
    render(<ErrorBoundary />);
    expect(screen.getByTestId('ErrorBoundary')).toBeInTheDocument();
  });
});
