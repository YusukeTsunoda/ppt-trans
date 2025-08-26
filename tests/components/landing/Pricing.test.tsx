import React from 'react';
import { render, screen } from '@testing-library/react';
import { Pricing } from '@/components/landing/Pricing';

// Next.js Link コンポーネントのモック
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>;
  };
});

describe('Pricing Component', () => {
  it('セクションタイトルを表示する', () => {
    render(<Pricing />);
    expect(screen.getByText('料金プラン')).toBeInTheDocument();
    expect(screen.getByText(/ビジネスニーズに合わせた柔軟なプラン/)).toBeInTheDocument();
  });

  it('全ての料金プランを表示する', () => {
    render(<Pricing />);
    
    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByText('Pro')).toBeInTheDocument();
    expect(screen.getByText('Enterprise')).toBeInTheDocument();
  });

  it('各プランの価格を表示する', () => {
    render(<Pricing />);
    
    expect(screen.getByText('¥0')).toBeInTheDocument();
    expect(screen.getByText('¥2,980')).toBeInTheDocument();
    expect(screen.getByText('お問い合わせ')).toBeInTheDocument();
  });

  it('各プランの説明を表示する', () => {
    render(<Pricing />);
    
    expect(screen.getByText('個人利用に最適')).toBeInTheDocument();
    expect(screen.getByText('プロフェッショナル向け')).toBeInTheDocument();
    expect(screen.getByText('大規模組織向け')).toBeInTheDocument();
  });

  it('Freeプランの機能を表示する', () => {
    render(<Pricing />);
    
    expect(screen.getByText('月10ファイルまで')).toBeInTheDocument();
    expect(screen.getByText('最大10MBのファイルサイズ')).toBeInTheDocument();
    expect(screen.getByText('基本的な翻訳機能')).toBeInTheDocument();
    expect(screen.getByText('メールサポート')).toBeInTheDocument();
  });

  it('Proプランの機能を表示する', () => {
    render(<Pricing />);
    
    expect(screen.getByText('月100ファイルまで')).toBeInTheDocument();
    expect(screen.getByText('最大50MBのファイルサイズ')).toBeInTheDocument();
    expect(screen.getByText('高度な翻訳機能')).toBeInTheDocument();
    expect(screen.getByText('優先サポート')).toBeInTheDocument();
    expect(screen.getByText('API アクセス')).toBeInTheDocument();
    expect(screen.getByText('カスタム辞書')).toBeInTheDocument();
  });

  it('Enterpriseプランの機能を表示する', () => {
    render(<Pricing />);
    
    expect(screen.getByText('無制限のファイル数')).toBeInTheDocument();
    expect(screen.getByText('ファイルサイズ制限なし')).toBeInTheDocument();
    expect(screen.getByText('専用サーバー')).toBeInTheDocument();
    expect(screen.getByText('24/7 サポート')).toBeInTheDocument();
    expect(screen.getByText('SLA保証')).toBeInTheDocument();
    expect(screen.getByText('オンプレミス対応')).toBeInTheDocument();
  });

  it('CTAボタンが正しく表示される', () => {
    render(<Pricing />);
    
    const freeButton = screen.getByRole('link', { name: '無料で始める' });
    const proButton = screen.getByRole('link', { name: 'Proを始める' });
    const enterpriseButton = screen.getByRole('link', { name: 'お問い合わせ' });
    
    expect(freeButton).toBeInTheDocument();
    expect(proButton).toBeInTheDocument();
    expect(enterpriseButton).toBeInTheDocument();
  });

  it('CTAボタンが適切なリンク先を持つ', () => {
    render(<Pricing />);
    
    const freeButton = screen.getByRole('link', { name: '無料で始める' });
    const proButton = screen.getByRole('link', { name: 'Proを始める' });
    const enterpriseButton = screen.getByRole('link', { name: 'お問い合わせ' });
    
    expect(freeButton).toHaveAttribute('href', '/register');
    expect(proButton).toHaveAttribute('href', '/register?plan=pro');
    expect(enterpriseButton).toHaveAttribute('href', '/contact');
  });

  it('Proプランがハイライトされている', () => {
    const { container } = render(<Pricing />);
    const proCard = container.querySelector('.ring-2.ring-blue-600');
    
    expect(proCard).toBeInTheDocument();
  });

  it('人気バッジが表示されている', () => {
    render(<Pricing />);
    expect(screen.getByText('人気')).toBeInTheDocument();
  });

  it('グリッドレイアウトが適用されている', () => {
    const { container } = render(<Pricing />);
    const grid = container.querySelector('.grid');
    
    expect(grid).toHaveClass('md:grid-cols-3');
  });

  it('レスポンシブデザインが適用されている', () => {
    const { container } = render(<Pricing />);
    const section = container.querySelector('section');
    
    expect(section).toHaveClass('py-20');
  });

  it('アクセシビリティ属性が正しく設定されている', () => {
    render(<Pricing />);
    const heading = screen.getByRole('heading', { level: 2, name: '料金プラン' });
    
    expect(heading).toBeInTheDocument();
  });

  it('チェックマークアイコンが表示されている', () => {
    const { container } = render(<Pricing />);
    const checkIcons = container.querySelectorAll('svg');
    
    // 各プランに複数の機能があるので、相応の数のチェックマークがあるはず
    expect(checkIcons.length).toBeGreaterThan(10);
  });
});