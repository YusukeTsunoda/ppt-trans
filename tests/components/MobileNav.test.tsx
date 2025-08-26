import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import MobileNav from '@/components/MobileNav';

describe('MobileNav', () => {
  it('正しくレンダリングされる', () => {
    render(<MobileNav />);
    expect(screen.getByTestId('MobileNav')).toBeInTheDocument();
  });
});
