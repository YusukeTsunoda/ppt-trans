import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import GenerationProgress from '@/components/GenerationProgress';

describe('GenerationProgress', () => {
  it('正しくレンダリングされる', () => {
    render(<GenerationProgress />);
    expect(screen.getByTestId('GenerationProgress')).toBeInTheDocument();
  });
});
