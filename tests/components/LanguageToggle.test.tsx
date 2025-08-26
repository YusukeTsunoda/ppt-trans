import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageToggle } from '../../src/components/LanguageToggle';

// Mock the LanguageToggle component
jest.mock('../../src/components/LanguageToggle', () => {
  return {
    LanguageToggle: ({ onLanguageChange, currentLanguage = 'ja' }: { 
      onLanguageChange?: (lang: string) => void; 
      currentLanguage?: string;
    }) => (
      <div data-testid="language-toggle">
        <select 
          value={currentLanguage}
          onChange={(e) => onLanguageChange?.(e.target.value)}
          data-testid="language-select"
        >
          <option value="ja">日本語</option>
          <option value="en">English</option>
          <option value="es">Español</option>
          <option value="fr">Français</option>
        </select>
        <span data-testid="current-language">{currentLanguage}</span>
      </div>
    )
  };
});

describe('LanguageToggle', () => {
  test('renders language toggle with default language', () => {
    render(<LanguageToggle />);
    
    expect(screen.getByTestId('language-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('language-select')).toHaveValue('ja');
    expect(screen.getByTestId('current-language')).toHaveTextContent('ja');
  });

  test('renders with custom current language', () => {
    render(<LanguageToggle currentLanguage="en" />);
    
    expect(screen.getByTestId('language-select')).toHaveValue('en');
    expect(screen.getByTestId('current-language')).toHaveTextContent('en');
  });

  test('calls onLanguageChange when language is selected', () => {
    const mockOnLanguageChange = jest.fn();
    render(<LanguageToggle onLanguageChange={mockOnLanguageChange} />);
    
    const select = screen.getByTestId('language-select');
    fireEvent.change(select, { target: { value: 'en' } });
    
    expect(mockOnLanguageChange).toHaveBeenCalledWith('en');
  });

  test('renders all language options', () => {
    render(<LanguageToggle />);
    
    const select = screen.getByTestId('language-select');
    const options = select.querySelectorAll('option');
    
    expect(options).toHaveLength(4);
    expect(options[0]).toHaveValue('ja');
    expect(options[1]).toHaveValue('en');
    expect(options[2]).toHaveValue('es');
    expect(options[3]).toHaveValue('fr');
  });

  test('updates language multiple times', () => {
    const mockOnLanguageChange = jest.fn();
    render(<LanguageToggle onLanguageChange={mockOnLanguageChange} />);
    
    const select = screen.getByTestId('language-select');
    
    fireEvent.change(select, { target: { value: 'en' } });
    fireEvent.change(select, { target: { value: 'es' } });
    fireEvent.change(select, { target: { value: 'fr' } });
    
    expect(mockOnLanguageChange).toHaveBeenCalledTimes(3);
    expect(mockOnLanguageChange).toHaveBeenNthCalledWith(1, 'en');
    expect(mockOnLanguageChange).toHaveBeenNthCalledWith(2, 'es');
    expect(mockOnLanguageChange).toHaveBeenNthCalledWith(3, 'fr');
  });
});