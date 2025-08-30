import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SettingsScreen from '@/components/SettingsScreen';

describe('SettingsScreen', () => {
  it('正しくレンダリングされる', () => {
    render(<SettingsScreen />);
    expect(screen.getByTestId('SettingsScreen')).toBeInTheDocument();
  });
});
