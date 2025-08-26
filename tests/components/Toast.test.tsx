import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Toast from '@/components/Toast';

describe('Toast', () => {
  it('正しくレンダリングされる', () => {
    render(<Toast />);
    expect(screen.getByTestId('Toast')).toBeInTheDocument();
  });
});
