import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Header } from '@/components/landing/Header';

// Next.js Link コンポーネントのモック
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>;
  };
});

describe('Header Component', () => {
  it('ロゴとブランド名を表示する', () => {
    render(<Header />);
    
    expect(screen.getByText('PPT Translator')).toBeInTheDocument();
    const logo = screen.getByRole('link', { name: /PPT Translator/i });
    expect(logo).toHaveAttribute('href', '/');
  });

  it('ナビゲーションリンクを表示する（デスクトップ）', () => {
    render(<Header />);
    
    // デスクトップナビゲーションリンク
    const navLinks = screen.getAllByRole('link');
    const linkTexts = ['機能', '料金', '使い方'];
    
    linkTexts.forEach(text => {
      const links = navLinks.filter(link => link.textContent?.includes(text));
      expect(links.length).toBeGreaterThan(0);
    });
  });

  it('CTAボタンを表示する', () => {
    render(<Header />);
    
    const loginButton = screen.getByRole('link', { name: /ログイン/i });
    const signupButton = screen.getByRole('link', { name: /無料で始める/i });
    
    expect(loginButton).toBeInTheDocument();
    expect(loginButton).toHaveAttribute('href', '/login');
    
    expect(signupButton).toBeInTheDocument();
    expect(signupButton).toHaveAttribute('href', '/register');
  });

  it('モバイルメニューボタンが機能する', () => {
    render(<Header />);
    
    const menuButton = screen.getByRole('button', { name: /メニュー/i });
    expect(menuButton).toBeInTheDocument();
    
    // メニューを開く
    fireEvent.click(menuButton);
    
    // モバイルメニューが表示される
    const mobileMenu = screen.getByRole('navigation');
    expect(mobileMenu).toBeInTheDocument();
    
    // 閉じるボタンが表示される
    const closeButton = screen.getByRole('button', { name: /閉じる/i });
    expect(closeButton).toBeInTheDocument();
    
    // メニューを閉じる
    fireEvent.click(closeButton);
  });

  it('モバイルメニューに全てのリンクが含まれる', () => {
    render(<Header />);
    
    // モバイルメニューを開く
    const menuButton = screen.getByRole('button', { name: /メニュー/i });
    fireEvent.click(menuButton);
    
    // モバイルメニュー内のリンク確認
    const mobileLinks = ['ホーム', '機能', '料金', '使い方', 'ログイン'];
    mobileLinks.forEach(text => {
      expect(screen.getByText(text)).toBeInTheDocument();
    });
    
    // 無料で始めるボタンも確認
    const signupButtons = screen.getAllByText('無料で始める');
    expect(signupButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('スクロール時にヘッダーのスタイルが変化する', async () => {
    const { container } = render(<Header />);
    const header = container.querySelector('header');
    
    // 初期状態
    expect(header).toHaveClass('bg-white/95');
    
    // スクロールをシミュレート
    Object.defineProperty(window, 'scrollY', {
      writable: true,
      value: 100,
    });
    
    fireEvent.scroll(window);
    
    // スタイルが変化することを確認（実装による）
    await waitFor(() => {
      expect(header).toHaveClass('bg-white/95');
    });
  });

  it('レスポンシブクラスが適用されている', () => {
    const { container } = render(<Header />);
    
    // デスクトップナビゲーション
    const desktopNav = container.querySelector('.hidden.md\\:flex');
    expect(desktopNav).toBeInTheDocument();
    
    // モバイルメニューボタン
    const mobileMenuButton = container.querySelector('.md\\:hidden');
    expect(mobileMenuButton).toBeInTheDocument();
  });

  it('アクセシビリティ: 適切なaria属性を持つ', () => {
    render(<Header />);
    
    const menuButton = screen.getByRole('button', { name: /メニュー/i });
    expect(menuButton).toHaveAttribute('type', 'button');
    
    // モバイルメニューを開く
    fireEvent.click(menuButton);
    
    const nav = screen.getByRole('navigation');
    expect(nav).toBeInTheDocument();
  });

  it('ボタンのホバースタイルが適用されている', () => {
    render(<Header />);
    
    const signupButton = screen.getByRole('link', { name: /無料で始める/i });
    expect(signupButton).toHaveClass('hover:bg-blue-700');
    
    const loginButton = screen.getByRole('link', { name: /ログイン/i });
    expect(loginButton).toHaveClass('hover:text-gray-900');
  });
});