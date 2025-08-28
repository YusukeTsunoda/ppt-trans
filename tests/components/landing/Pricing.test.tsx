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
    expect(screen.getByText('シンプルな料金プラン')).toBeInTheDocument();
    expect(screen.getByText('ニーズに合わせて最適なプランをお選びください')).toBeInTheDocument();
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
    // 「お問い合わせ」は複数あるので、最初の1つを取得
    const contactElements = screen.getAllByText('お問い合わせ');
    expect(contactElements.length).toBeGreaterThan(0);
  });

  it('各プランの説明を表示する', () => {
    render(<Pricing />);
    
    expect(screen.getByText('個人利用や試用に最適')).toBeInTheDocument();
    expect(screen.getByText('ビジネス利用に最適')).toBeInTheDocument();
    expect(screen.getByText('大規模な組織向け')).toBeInTheDocument();
  });

  it('Freeプランの機能を表示する', () => {
    render(<Pricing />);
    
    expect(screen.getByText('月5ファイルまで')).toBeInTheDocument();
    expect(screen.getByText('最大10スライド/ファイル')).toBeInTheDocument();
    expect(screen.getByText('基本的な言語対応')).toBeInTheDocument();
    expect(screen.getByText('メールサポート')).toBeInTheDocument();
  });

  it('Proプランの機能を表示する', () => {
    render(<Pricing />);
    
    expect(screen.getByText('月50ファイルまで')).toBeInTheDocument();
    expect(screen.getByText('最大100スライド/ファイル')).toBeInTheDocument();
    expect(screen.getByText('全言語対応')).toBeInTheDocument();
    expect(screen.getByText('優先サポート')).toBeInTheDocument();
    expect(screen.getByText('高速処理')).toBeInTheDocument();
    expect(screen.getByText('API アクセス')).toBeInTheDocument();
  });

  it('Enterpriseプランの機能を表示する', () => {
    render(<Pricing />);
    
    expect(screen.getByText('無制限のファイル数')).toBeInTheDocument();
    expect(screen.getByText('無制限のスライド数')).toBeInTheDocument();
    expect(screen.getByText('全言語対応')).toBeInTheDocument();
    expect(screen.getByText('専任サポート')).toBeInTheDocument();
    expect(screen.getByText('最優先処理')).toBeInTheDocument();
    expect(screen.getByText('カスタムAPI')).toBeInTheDocument();
    expect(screen.getByText('SLA保証')).toBeInTheDocument();
  });

  it('CTAボタンが正しく表示される', () => {
    render(<Pricing />);
    
    const freeButton = screen.getByRole('link', { name: '無料で始める' });
    const proButton = screen.getByRole('link', { name: 'Pro版を始める' });
    // お問い合わせは複数あるのでgetAllByRoleを使用
    const enterpriseButtons = screen.getAllByRole('link', { name: 'お問い合わせ' });
    
    expect(freeButton).toBeInTheDocument();
    expect(proButton).toBeInTheDocument();
    expect(enterpriseButtons.length).toBeGreaterThan(0);
  });

  it('CTAボタンが適切なリンク先を持つ', () => {
    render(<Pricing />);
    
    const freeButton = screen.getByRole('link', { name: '無料で始める' });
    const proButton = screen.getByRole('link', { name: 'Pro版を始める' });
    const enterpriseButtons = screen.getAllByRole('link', { name: 'お問い合わせ' });
    
    expect(freeButton).toHaveAttribute('href', '/register');
    expect(proButton).toHaveAttribute('href', '/register');
    expect(enterpriseButtons[0]).toHaveAttribute('href', '/contact');
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
    const heading = screen.getByRole('heading', { level: 2 });
    
    expect(heading).toHaveTextContent('シンプルな料金プラン');
  });

  it('チェックマークアイコンが表示されている', () => {
    const { container } = render(<Pricing />);
    const checkIcons = container.querySelectorAll('svg');
    
    // 各プランに複数の機能があるので、相応の数のチェックマークがあるはず
    expect(checkIcons.length).toBeGreaterThan(10);
  });
});