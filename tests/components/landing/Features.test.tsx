import React from 'react';
import { render, screen } from '@testing-library/react';
import { Features } from '@/components/landing/Features';
import { Globe, Zap, Shield, Users, Clock, CheckCircle } from 'lucide-react';

describe('Features Component', () => {
  it('セクションタイトルを表示する', () => {
    render(<Features />);
    expect(screen.getByText('主な機能')).toBeInTheDocument();
    expect(screen.getByText(/選ばれる理由/)).toBeInTheDocument();
  });

  it('全ての機能項目を表示する', () => {
    render(<Features />);
    
    // 各機能タイトルを確認
    expect(screen.getByText('多言語対応')).toBeInTheDocument();
    expect(screen.getByText('高速処理')).toBeInTheDocument();
    expect(screen.getByText('セキュア')).toBeInTheDocument();
    expect(screen.getByText('チーム共有')).toBeInTheDocument();
    expect(screen.getByText('24時間サポート')).toBeInTheDocument();
    expect(screen.getByText('高精度翻訳')).toBeInTheDocument();
  });

  it('各機能の説明を表示する', () => {
    render(<Features />);
    
    expect(screen.getByText(/100以上の言語に対応/)).toBeInTheDocument();
    expect(screen.getByText(/AIによる数秒での翻訳/)).toBeInTheDocument();
    expect(screen.getByText(/エンタープライズグレードのセキュリティ/)).toBeInTheDocument();
    expect(screen.getByText(/チームメンバーと簡単共有/)).toBeInTheDocument();
    expect(screen.getByText(/専門スタッフによる充実サポート/)).toBeInTheDocument();
    expect(screen.getByText(/業界最高水準の翻訳品質/)).toBeInTheDocument();
  });

  it('適切なアイコンが表示されている', () => {
    const { container } = render(<Features />);
    
    // アイコンコンポーネントの存在を確認
    const icons = container.querySelectorAll('svg');
    expect(icons.length).toBe(6);
  });

  it('グリッドレイアウトが適用されている', () => {
    const { container } = render(<Features />);
    const grid = container.querySelector('.grid');
    
    expect(grid).toHaveClass('md:grid-cols-2', 'lg:grid-cols-3');
  });

  it('各機能カードにホバー効果が適用されている', () => {
    const { container } = render(<Features />);
    const cards = container.querySelectorAll('.group');
    
    expect(cards.length).toBe(6);
    cards.forEach(card => {
      expect(card).toHaveClass('hover:shadow-lg');
    });
  });

  it('レスポンシブパディングが適用されている', () => {
    const { container } = render(<Features />);
    const section = container.querySelector('section');
    
    expect(section).toHaveClass('py-20', 'bg-gray-50');
  });

  it('アクセシビリティ属性が正しく設定されている', () => {
    render(<Features />);
    const heading = screen.getByRole('heading', { level: 2, name: '主な機能' });
    
    expect(heading).toBeInTheDocument();
  });

  it('機能カードが適切な構造を持つ', () => {
    const { container } = render(<Features />);
    const firstCard = container.querySelector('.p-6');
    
    // カード内の要素確認
    expect(firstCard).toBeInTheDocument();
    expect(firstCard?.querySelector('svg')).toBeInTheDocument();
    expect(firstCard?.querySelector('h3')).toBeInTheDocument();
    expect(firstCard?.querySelector('p')).toBeInTheDocument();
  });
});