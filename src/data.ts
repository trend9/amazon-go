import { CategorySpec, AmazonProductArticle } from './types';

export const AMAZON_CATEGORIES: CategorySpec[] = [
  {
    id: 'gadgets',
    name: '家電・カメラ',
    slug: 'gadgets',
    icon: 'Tv',
    description: '最先端のガジェット、スマート家電、ノイズキャンセリングヘッドホンなど'
  },
  {
    id: 'pc',
    name: 'パソコン・周辺機器',
    slug: 'pc',
    icon: 'Laptop',
    description: '爆速SSD、快適エルゴノミクスキーボード、高画質モニターなど'
  },
  {
    id: 'kitchen',
    name: 'ホーム＆キッチン',
    slug: 'kitchen',
    icon: 'ChefHat',
    description: '時短を叶える全自動電気調理器、感動の直火風トースター、水拭きロボット掃除機'
  },
  {
    id: 'beauty',
    name: 'ビューティー',
    slug: 'beauty',
    icon: 'Sparkles',
    description: '肌質を科学する高浸透ドライヤー、自宅サロン級美顔器、オーガニックセラム'
  },
  {
    id: 'fashion',
    name: 'ファッション',
    slug: 'fashion',
    icon: 'Shirt',
    description: '撥水＆超軽量多機能ビジネスバックパック、快適な履き心地のスニーカー'
  },
  {
    id: 'books-games',
    name: '本・ゲーム',
    slug: 'books-games',
    icon: 'Gamepad2',
    description: '年間ベストセラービジネス書、没入型最新RPGゲーム、知育パズル'
  }
];

export const INITIAL_ARTICLES: AmazonProductArticle[] = [
  {
    id: 'art-headphones-sony',
    title: '【徹底レビュー】ソニー WH-1000XM5は本当に買い？静寂と感動音が織りなす「究極の没入感」を徹底検証',
    originalUrl: 'https://www.amazon.co.jp/dp/B0D2XBV7FZ',
    asin: 'B0D2XBV7FZ',
    category: 'gadgets',
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=600',
    starRating: 4.8,
    introText: '「一瞬でカフェが個室オフィスに変わる。」WH-1000XM5の圧倒的なアクティブノイズキャンセリング。周囲の雑音を極限まで打ち消し、あなたの好きな音楽や大事なリモート会議だけに集中できます。',
    features: [
      '業界最高クラスのノイズキャンセリング性能（マルチノイズセンサーテクノロジー）',
      '専用設計30mmドライバーによる圧倒的な高音質とハイレゾ対応',
      '超軽量で耳に吸い付くような抜群のフィット感と、最長30時間駆動のタフバッテリー'
    ],
    pros: [
      '前モデルを遥かに凌駕する高周波帯の騒音カット力',
      'ビームフォーミングマイクによる極めてクリアな通話性能',
      '3分充電で約5時間再生可能な驚異の急速充電対応'
    ],
    cons: [
      '折りたたみ機構がなくなったため、持ち運びに少し大きめのケースが必要',
      '価格が高価なため、エントリーユーザーにはやや敷居が高い'
    ],
    reviewBody: `### ソニー WH-1000XM5：ワイヤレスヘッドホンの「完成形」がここにある。

仕事中や移動中の**「騒音」**に悩まされていませんか？ 
ソニーの最高峰ノイズキャンセリングヘッドホン「WH-1000XM5」は、装着した瞬間に静寂を生み出し、音楽の細部までをありのままに描き出すモンスターマシンです。

#### 1. 異次元の静寂を創り出す、オートNCオプティマイザー
電車の走行音、オフィスの雑談、道路の喧騒。これらすべてのノイズが嘘のように消え去ります。WH-1000XM5では、周囲の状況やユーザーの装着状況に合わせてノイズキャンセリングレベルを自動調整。常に最適な静寂が保証されます。

#### 2. 「ハイレゾワイヤレス」がもたらす極上の音場
まるでアーティストが目の前で演奏しているかのような立体的なサウンド。細かな息遣いや、普段聴き流していた微細なギターのアルペジオまでクリアに聴き取ることができます。

#### 3. テレワークを支える最強のマイク
AI技術を用いた通話補正アルゴリズムにより、騒がしいスターバックスの中からでも「静かでクリアな声」をクライアントへ届けます。`,
    ctaTitle: '＼ 限定ポイント還元あり！Amazonで現在の最安値と口コミをチェックする ／',
    affiliateLink: 'https://amzn.to/4fZYn2T',
    createdAt: '2026-06-05 02:00:22',
    estimatedPV: 0,
    clicks: 0,
    earnings: 0,
    aiModelUsed: 'Gemini 3.5 Flash'
  }
];
