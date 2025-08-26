import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AuthProvider from '@/components/AuthProvider';

describe('AuthProvider', () => {
  it('正しくレンダリングされる', () => {
    render(<AuthProvider />);
    expect(screen.getByTestId('AuthProvider')).toBeInTheDocument();
  });
});
