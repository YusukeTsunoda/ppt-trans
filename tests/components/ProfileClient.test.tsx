import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProfileClient from '@/components/ProfileClient';

describe('ProfileClient', () => {
  it('正しくレンダリングされる', () => {
    render(<ProfileClient />);
    expect(screen.getByTestId('ProfileClient')).toBeInTheDocument();
  });
});
