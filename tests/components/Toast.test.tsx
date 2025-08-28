import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Toast from '@/components/Toast';

describe('Toast', () => {
  it('正しくレンダリングされる', () => {
    render(
      <Toast>
        <div data-testid="test-child">Test Child</div>
      </Toast>
    );
    expect(screen.getByTestId('Toast')).toBeInTheDocument();
  });
});
