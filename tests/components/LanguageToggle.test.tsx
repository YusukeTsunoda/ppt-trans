import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageToggle } from '../../src/components/LanguageToggle';

// Mock the LanguageContext
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: jest.fn(() => ({
    language: 'ja',
    setLanguage: jest.fn()
  })),
  Language: {
    ja: 'ja',
    en: 'en',
    zh: 'zh',
    ko: 'ko'
  }
}));

describe('LanguageToggle', () => {
  const mockSetLanguage = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    const { useLanguage } = require('@/contexts/LanguageContext');
    useLanguage.mockReturnValue({
      language: 'ja',
      setLanguage: mockSetLanguage
    });
  });
  
  test('renders language toggle with default language', () => {
    render(<LanguageToggle />);
    
    expect(screen.getByLabelText('Select language')).toBeInTheDocument();
  });

  test('renders with custom current language', () => {
    const { useLanguage } = require('@/contexts/LanguageContext');
    useLanguage.mockReturnValue({
      language: 'en',
      setLanguage: mockSetLanguage
    });
    
    render(<LanguageToggle />);
    
    expect(screen.getByText(/English/)).toBeInTheDocument();
  });

  test('opens dropdown when clicked', () => {
    render(<LanguageToggle />);
    
    const button = screen.getByLabelText('Select language');
    fireEvent.click(button);
    
    // Check if language options are visible
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('中文')).toBeInTheDocument();
    expect(screen.getByText('한국어')).toBeInTheDocument();
  });

  test('calls setLanguage when a language is selected', () => {
    render(<LanguageToggle />);
    
    const button = screen.getByLabelText('Select language');
    fireEvent.click(button);
    
    const englishOption = screen.getByText('English');
    fireEvent.click(englishOption);
    
    expect(mockSetLanguage).toHaveBeenCalledWith('en');
  });

  test('closes dropdown when clicking outside', () => {
    render(
      <div>
        <LanguageToggle />
        <button data-testid="outside">Outside</button>
      </div>
    );
    
    // Open dropdown
    const button = screen.getByLabelText('Select language');
    fireEvent.click(button);
    expect(screen.getByText('English')).toBeInTheDocument();
    
    // Click outside
    const outsideButton = screen.getByTestId('outside');
    fireEvent.mouseDown(outsideButton);
    
    // Dropdown should be closed
    expect(screen.queryByText('English')).not.toBeInTheDocument();
  });
});