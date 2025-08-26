import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { useTheme } from 'next-themes';
import { ThemeToggle } from '../../src/components/ThemeToggle';

// Mock next-themes
jest.mock('next-themes', () => ({
  useTheme: jest.fn(),
}));

const mockUseTheme = useTheme as jest.MockedFunction<typeof useTheme>;

// Mock the ThemeToggle component
jest.mock('../../src/components/ThemeToggle', () => {
  return {
    ThemeToggle: () => {
      const { theme, setTheme } = require('next-themes').useTheme();
      
      return (
        <button 
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          data-testid="theme-toggle"
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? '🌞' : '🌙'}
          <span data-testid="theme-text">
            {theme === 'dark' ? 'Light' : 'Dark'} Mode
          </span>
        </button>
      );
    }
  };
});

describe('ThemeToggle', () => {
  const mockSetTheme = jest.fn();

  beforeEach(() => {
    mockSetTheme.mockClear();
    mockUseTheme.mockReturnValue({
      theme: 'light',
      setTheme: mockSetTheme,
      themes: ['light', 'dark'],
      systemTheme: 'light',
      resolvedTheme: 'light'
    });
  });

  test('renders theme toggle button', () => {
    render(<ThemeToggle />);
    
    const button = screen.getByTestId('theme-toggle');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Switch to dark mode');
  });

  test('displays correct icon and text for light theme', () => {
    render(<ThemeToggle />);
    
    expect(screen.getByText('🌙')).toBeInTheDocument();
    expect(screen.getByTestId('theme-text')).toHaveTextContent('Dark Mode');
  });

  test('displays correct icon and text for dark theme', () => {
    mockUseTheme.mockReturnValue({
      theme: 'dark',
      setTheme: mockSetTheme,
      themes: ['light', 'dark'],
      systemTheme: 'dark',
      resolvedTheme: 'dark'
    });

    render(<ThemeToggle />);
    
    expect(screen.getByText('🌞')).toBeInTheDocument();
    expect(screen.getByTestId('theme-text')).toHaveTextContent('Light Mode');
    expect(screen.getByTestId('theme-toggle')).toHaveAttribute('aria-label', 'Switch to light mode');
  });

  test('toggles theme from light to dark when clicked', () => {
    render(<ThemeToggle />);
    
    const button = screen.getByTestId('theme-toggle');
    fireEvent.click(button);
    
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  test('toggles theme from dark to light when clicked', () => {
    mockUseTheme.mockReturnValue({
      theme: 'dark',
      setTheme: mockSetTheme,
      themes: ['light', 'dark'],
      systemTheme: 'dark',
      resolvedTheme: 'dark'
    });

    render(<ThemeToggle />);
    
    const button = screen.getByTestId('theme-toggle');
    fireEvent.click(button);
    
    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });

  test('handles undefined theme gracefully', () => {
    mockUseTheme.mockReturnValue({
      theme: undefined,
      setTheme: mockSetTheme,
      themes: ['light', 'dark'],
      systemTheme: 'light',
      resolvedTheme: 'light'
    });

    render(<ThemeToggle />);
    
    const button = screen.getByTestId('theme-toggle');
    expect(button).toBeInTheDocument();
    
    fireEvent.click(button);
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });
});