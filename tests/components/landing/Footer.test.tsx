import React from 'react';
import { render, screen } from '@testing-library/react';
import { Footer } from '@/components/landing/Footer';

// Next.js Link コンポーネントのモック
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>;
  };
});

describe('Footer Component', () => {
  it('会社情報セクションを表示する', () => {
    render(<Footer />);
    
    expect(screen.getByText('PPT Translator')).toBeInTheDocument();
    expect(screen.getByText(/AIを活用した高品質な/)).toBeInTheDocument();
  });

  it('プロダクトリンクを表示する', () => {
    render(<Footer />);
    
    const productHeading = screen.getByRole('heading', { level: 3, name: 'プロダクト' });
    expect(productHeading).toBeInTheDocument();
    
    const productLinks = ['機能', '料金', 'API', 'ダウンロード'];
    productLinks.forEach(link => {
      expect(screen.getByText(link)).toBeInTheDocument();
    });
  });

  it('サポートリンクを表示する', () => {
    render(<Footer />);
    
    const supportHeading = screen.getByRole('heading', { level: 3, name: 'サポート' });
    expect(supportHeading).toBeInTheDocument();
    
    const supportLinks = ['ヘルプセンター', 'お問い合わせ', 'ステータス', 'ブログ'];
    supportLinks.forEach(link => {
      expect(screen.getByText(link)).toBeInTheDocument();
    });
  });

  it('会社リンクを表示する', () => {
    render(<Footer />);
    
    const companyHeading = screen.getByRole('heading', { level: 3, name: '会社' });
    expect(companyHeading).toBeInTheDocument();
    
    const companyLinks = ['会社概要', '採用情報', 'プレス', 'パートナー'];
    companyLinks.forEach(link => {
      expect(screen.getByText(link)).toBeInTheDocument();
    });
  });

  it('法的情報リンクを表示する', () => {
    render(<Footer />);
    
    const legalHeading = screen.getByRole('heading', { level: 3, name: '法的情報' });
    expect(legalHeading).toBeInTheDocument();
    
    const legalLinks = ['プライバシー', '利用規約', '特定商取引法', 'クッキー'];
    legalLinks.forEach(link => {
      expect(screen.getByText(link)).toBeInTheDocument();
    });
  });

  it('著作権表示を含む', () => {
    render(<Footer />);
    
    const currentYear = new Date().getFullYear();
    const copyrightText = screen.getByText(new RegExp(`© ${currentYear}`));
    expect(copyrightText).toBeInTheDocument();
    expect(copyrightText).toHaveTextContent('PPT Translator');
  });

  it('正しいリンク先を持つ', () => {
    render(<Footer />);
    
    // サンプルリンクの確認
    const featuresLink = screen.getByRole('link', { name: '機能' });
    expect(featuresLink).toHaveAttribute('href', '/features');
    
    const pricingLink = screen.getByRole('link', { name: '料金' });
    expect(pricingLink).toHaveAttribute('href', '/pricing');
    
    const privacyLink = screen.getByRole('link', { name: 'プライバシー' });
    expect(privacyLink).toHaveAttribute('href', '/privacy');
    
    const termsLink = screen.getByRole('link', { name: '利用規約' });
    expect(termsLink).toHaveAttribute('href', '/terms');
  });

  it('レスポンシブグリッドレイアウトを使用する', () => {
    const { container } = render(<Footer />);
    
    const grid = container.querySelector('.grid');
    expect(grid).toHaveClass('grid-cols-2', 'md:grid-cols-4', 'lg:grid-cols-5');
    expect(grid).toHaveClass('gap-8');
  });

  it('適切な背景色とボーダーを持つ', () => {
    const { container } = render(<Footer />);
    
    const footer = container.querySelector('footer');
    expect(footer).toHaveClass('bg-gray-50', 'dark:bg-gray-900');
    expect(footer).toHaveClass('border-t', 'border-gray-200', 'dark:border-gray-800');
  });

  it('リンクにホバースタイルが適用されている', () => {
    render(<Footer />);
    
    const links = screen.getAllByRole('link');
    const navigationLinks = links.filter(link => 
      !link.textContent?.includes('PPT Translator') &&
      !link.textContent?.includes('©')
    );
    
    navigationLinks.forEach(link => {
      expect(link).toHaveClass('hover:text-gray-900', 'dark:hover:text-white');
    });
  });

  it('セクションヘッダーが正しいスタイリングを持つ', () => {
    render(<Footer />);
    
    const headings = screen.getAllByRole('heading', { level: 3 });
    headings.forEach(heading => {
      expect(heading).toHaveClass('text-sm', 'font-semibold', 'text-gray-900', 'dark:text-white');
    });
  });

  it('モバイルで適切に折り返される', () => {
    const { container } = render(<Footer />);
    
    const gridContainer = container.querySelector('.grid');
    expect(gridContainer).toHaveClass('grid-cols-2');
    
    // タブレット以上では4列
    expect(gridContainer).toHaveClass('md:grid-cols-4');
    
    // デスクトップでは5列
    expect(gridContainer).toHaveClass('lg:grid-cols-5');
  });
});