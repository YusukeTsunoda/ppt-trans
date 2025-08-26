import React from 'react';
import { render, screen } from '@testing-library/react';
import { Hero } from '@/components/landing/Hero';

// Next.js Link コンポーネントのモック
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>;
  };
});

describe('Hero Component', () => {
  it('メインタイトルを表示する', () => {
    render(<Hero />);
    expect(screen.getByText(/PowerPointを/)).toBeInTheDocument();
    expect(screen.getByText(/瞬時に翻訳/)).toBeInTheDocument();
  });

  it('サブタイトルを表示する', () => {
    render(<Hero />);
    expect(screen.getByText(/AI技術を活用して、PowerPointプレゼンテーションを/)).toBeInTheDocument();
  });

  it('CTAボタンが正しく表示される', () => {
    render(<Hero />);
    const freeStartButton = screen.getByRole('link', { name: /無料で始める/i });
    const uploadButton = screen.getByRole('link', { name: /今すぐアップロード/i });
    
    expect(freeStartButton).toBeInTheDocument();
    expect(uploadButton).toBeInTheDocument();
  });

  it('適切なリンク先を持つ', () => {
    render(<Hero />);
    const registerLink = screen.getByRole('link', { name: /無料で始める/i });
    const uploadLink = screen.getByRole('link', { name: /今すぐアップロード/i });
    
    expect(registerLink).toHaveAttribute('href', '/register');
    expect(uploadLink).toHaveAttribute('href', '/dashboard');
  });

  it('適切なCSSクラスが適用されている', () => {
    render(<Hero />);
    const freeStartButton = screen.getByRole('link', { name: /無料で始める/i });
    const uploadButton = screen.getByRole('link', { name: /今すぐアップロード/i });
    
    // ボタン要素自体はbutton要素内にあるため、親要素をチェック
    const freeStartBtn = freeStartButton.querySelector('button');
    const uploadBtn = uploadButton.querySelector('button');
    
    // Primary button styles
    expect(freeStartBtn).toHaveClass('bg-blue-600');
    // Secondary button styles  
    expect(uploadBtn).toHaveClass('border');
  });

  it('レスポンシブデザインが適用されている', () => {
    const { container } = render(<Hero />);
    const section = container.querySelector('section');
    
    expect(section).toHaveClass('py-24', 'sm:py-32');
  });

  it('アクセシビリティ属性が正しく設定されている', () => {
    render(<Hero />);
    const heading = screen.getByRole('heading', { level: 1 });
    
    expect(heading).toBeInTheDocument();
    expect(heading.textContent).toContain('PowerPoint');
  });
});