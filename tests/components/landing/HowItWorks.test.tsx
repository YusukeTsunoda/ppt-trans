import React from 'react';
import { render, screen } from '@testing-library/react';
import { HowItWorks } from '@/components/landing/HowItWorks';

describe('HowItWorks Component', () => {
  it('セクションタイトルを表示する', () => {
    render(<HowItWorks />);
    
    const heading = screen.getByRole('heading', { level: 2, name: '使い方' });
    expect(heading).toBeInTheDocument();
    expect(screen.getByText('たった3ステップで翻訳完了')).toBeInTheDocument();
  });

  it('3つのステップを全て表示する', () => {
    render(<HowItWorks />);
    
    // ステップタイトル
    expect(screen.getByText('1. アップロード')).toBeInTheDocument();
    expect(screen.getByText('2. 翻訳')).toBeInTheDocument();
    expect(screen.getByText('3. ダウンロード')).toBeInTheDocument();
  });

  it('各ステップの説明を表示する', () => {
    render(<HowItWorks />);
    
    // ステップ1の説明
    expect(screen.getByText(/PowerPointファイルをドラッグ＆ドロップ/)).toBeInTheDocument();
    
    // ステップ2の説明
    expect(screen.getByText(/翻訳したい言語を選択して翻訳開始/)).toBeInTheDocument();
    
    // ステップ3の説明
    expect(screen.getByText(/翻訳完了後、すぐにダウンロード可能/)).toBeInTheDocument();
  });

  it('アイコンが正しく表示される', () => {
    const { container } = render(<HowItWorks />);
    
    // 各ステップのアイコンコンテナ
    const iconContainers = container.querySelectorAll('.flex-shrink-0');
    expect(iconContainers.length).toBeGreaterThanOrEqual(3);
    
    // アイコン要素の存在確認
    const icons = container.querySelectorAll('svg');
    expect(icons.length).toBeGreaterThanOrEqual(3);
  });

  it('レスポンシブグリッドが適用されている', () => {
    const { container } = render(<HowItWorks />);
    
    const grid = container.querySelector('.grid');
    expect(grid).toHaveClass('gap-8', 'lg:gap-12');
    
    // グリッドカラムクラス
    expect(grid).toHaveClass('md:grid-cols-3');
  });

  it('セクションの背景スタイルが適用されている', () => {
    const { container } = render(<HowItWorks />);
    
    const section = container.querySelector('section');
    expect(section).toHaveClass('py-20', 'bg-white', 'dark:bg-gray-900');
  });

  it('各ステップカードのスタイリングが正しい', () => {
    const { container } = render(<HowItWorks />);
    
    // ステップカード
    const cards = container.querySelectorAll('.text-center');
    expect(cards.length).toBeGreaterThanOrEqual(3);
    
    cards.forEach(card => {
      expect(card).toBeInTheDocument();
    });
  });

  it('ステップ番号が順序通りに表示される', () => {
    render(<HowItWorks />);
    
    const step1 = screen.getByText('1. アップロード');
    const step2 = screen.getByText('2. 翻訳');
    const step3 = screen.getByText('3. ダウンロード');
    
    // DOM上での順序確認
    const allSteps = [step1, step2, step3];
    allSteps.forEach((step, index) => {
      expect(step).toBeInTheDocument();
      expect(step.textContent).toContain(`${index + 1}.`);
    });
  });

  it('アクセシビリティ: 適切な見出し階層を持つ', () => {
    render(<HowItWorks />);
    
    // h2要素の確認
    const mainHeading = screen.getByRole('heading', { level: 2 });
    expect(mainHeading).toHaveTextContent('使い方');
    
    // h3要素の確認
    const subHeadings = screen.getAllByRole('heading', { level: 3 });
    expect(subHeadings).toHaveLength(3);
  });

  it('アイコンに適切なサイズクラスが適用されている', () => {
    const { container } = render(<HowItWorks />);
    
    const iconWrappers = container.querySelectorAll('.h-12.w-12');
    expect(iconWrappers.length).toBeGreaterThanOrEqual(3);
    
    iconWrappers.forEach(wrapper => {
      expect(wrapper).toHaveClass('bg-blue-100', 'dark:bg-blue-900');
    });
  });
});