export const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  role: 'user',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

export const mockFile = {
  id: 'file-id',
  filename: 'test.pptx',
  original_name: 'presentation.pptx',
  file_size: 1024000,
  status: 'uploaded',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  user_id: 'test-user-id',
  source_lang: 'en',
  target_lang: 'ja',
};

export const mockTranslation = {
  id: 'translation-id',
  file_id: 'file-id',
  status: 'completed',
  progress: 100,
  slide_count: 10,
  translated_slide_count: 10,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

export const mockPricingTiers = [
  {
    name: 'Free',
    price: '¥0',
    description: '個人利用に最適',
    features: [
      '月10ファイルまで',
      '最大10MBのファイルサイズ',
      '基本的な翻訳機能',
      'メールサポート',
    ],
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '¥2,980',
    description: 'プロフェッショナル向け',
    features: [
      '月100ファイルまで',
      '最大50MBのファイルサイズ',
      '高度な翻訳機能',
      '優先サポート',
      'API アクセス',
      'カスタム辞書',
    ],
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'お問い合わせ',
    description: '大規模組織向け',
    features: [
      '無制限のファイル数',
      'ファイルサイズ制限なし',
      '専用サーバー',
      '24/7 サポート',
      'SLA保証',
      'オンプレミス対応',
    ],
    highlighted: false,
  },
];