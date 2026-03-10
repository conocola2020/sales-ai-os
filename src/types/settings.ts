// -------------------------------------------------------
// 弊社情報 (user_settings)
// -------------------------------------------------------

export interface Product {
  name: string
  description: string
  benefits: string
}

export interface UserSettings {
  id: string
  user_id: string
  company_name: string
  representative: string
  representative_title: string
  company_email: string
  company_phone: string
  company_website: string
  company_location: string
  company_description: string
  products: Product[]
  value_propositions: string[]
  social_proof: string
  cta_text: string
  created_at: string
  updated_at: string
}

export type UserSettingsInsert = Omit<UserSettings, 'id' | 'user_id' | 'created_at' | 'updated_at'>

// -------------------------------------------------------
// メッセージテンプレート (message_templates)
// -------------------------------------------------------

export interface MessageTemplate {
  id: string
  user_id: string
  name: string
  description: string
  structure: string
  is_default: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export type MessageTemplateInsert = Pick<MessageTemplate, 'name' | 'description' | 'structure' | 'is_default' | 'sort_order'>

// -------------------------------------------------------
// デフォルトテンプレート定義
// -------------------------------------------------------

export const DEFAULT_TEMPLATES: Omit<MessageTemplateInsert, 'sort_order'>[] = [
  {
    name: '不の解決型',
    description: 'HPを分析して課題を特定し、解決策を提案する構成',
    structure: [
      '以下の構成で営業メッセージを作成してください：',
      '',
      '1. 【共感・現状認識】相手企業のHP情報から読み取れる特徴や強みに触れ、共感を示す（1〜2文）',
      '2. 【課題の示唆】HPから推測される「不」（不足・不便・不満）をやんわりと指摘する（1〜2文）',
      '3. 【解決策の提案】弊社の商品・サービスがその「不」をどう解決するかを具体的に説明（2〜3文）',
      '4. 【実績・信頼】導入実績や数字で信頼性を裏付ける（1文）',
      '5. 【CTA】次のアクション（資料送付・電話・訪問等）を提案して締める（1文）',
    ].join('\n'),
    is_default: true,
  },
  {
    name: '標準営業型',
    description: '弊社紹介を中心にシンプルに提案する構成',
    structure: [
      '以下の構成で営業メッセージを作成してください：',
      '',
      '1. 【挨拶】丁寧な自己紹介と連絡の趣旨（1〜2文）',
      '2. 【弊社紹介】弊社の事業内容と商品・サービスを簡潔に紹介（2〜3文）',
      '3. 【メリット提示】相手企業にとっての具体的なメリットを提示（2〜3文）',
      '4. 【CTA】次のアクション提案（1文）',
    ].join('\n'),
    is_default: false,
  },
  {
    name: 'コラボ提案型',
    description: '協業・Win-Winの関係を提案する構成',
    structure: [
      '以下の構成で営業メッセージを作成してください：',
      '',
      '1. 【共感】相手企業の事業やコンセプトへの共感を示す（1〜2文）',
      '2. 【協業提案】一緒に取り組めるアイデア（限定コラボ、OEM、共同イベント等）を提案（2〜3文）',
      '3. 【Win-Win】お互いにとってのメリットを説明（1〜2文）',
      '4. 【CTA】カジュアルな面談・電話の提案（1文）',
    ].join('\n'),
    is_default: false,
  },
]

// -------------------------------------------------------
// CONOCOLA デフォルト弊社情報
// -------------------------------------------------------

export const DEFAULT_USER_SETTINGS: UserSettingsInsert = {
  company_name: '株式会社CONOCOLA',
  representative: '河野大地',
  representative_title: '代表取締役',
  company_email: 'conocola2020@gmail.com',
  company_phone: '052-228-4945',
  company_website: 'https://conocola.com',
  company_location: '愛知県名古屋市東区東桜1-1-1 アーバンネット名古屋 ネクスタビルB1F',
  company_description:
    '名古屋発、無添加・無着色・無香料の手作りクラフトコーラとスパイスカレーを製造・販売。10種類以上のスパイスと生薬を使用し、東洋医学の専門家監修のもと開発。サウナ施設向けに「サウナーコーラ」と「サ飯（冷凍スパイスカレー）」を提供し、施設の売上向上と差別化に貢献します。',
  products: [
    {
      name: 'サウナーコーラ',
      description: 'サウナ後の"ととのい"に最適化されたクラフトコーラ。10種類以上のスパイスと生薬を独自ブレンドし、無添加・無着色・無香料で身体に優しい。サウナ後のリフレッシュ感を最大化する一杯。',
      benefits: '設備投資ゼロで導入可能、教育不要で今日入った新人でもすぐ提供できる、施設のドリンクメニュー差別化、客単価向上、SNS映えによる集客効果',
    },
    {
      name: 'サ飯（冷凍スパイスカレー）',
      description: 'サウナ後に食べたくなるスパイスカレー（チキン・キーマ・サバと大根など）の冷凍フードライン。温めるだけで提供可能、調理の手間なし。',
      benefits: 'フードメニュー拡充が調理人員不要でコスト削減、小さなスペースがあればOK、サウナ飯ブームへの対応',
    },
    {
      name: 'OEM/施設オリジナルコーラ',
      description: '施設オリジナルラベルやオリジナルレシピのクラフトコーラをOEM製造。他施設と差別化できるオンリーワンのドリンクを提供可能。',
      benefits: '施設の独自ブランディング、他施設が真似できない差別化、話題性による集客効果',
    },
  ],
  value_propositions: [
    'サウナ施設に特化した商品ラインナップ',
    '設備投資ゼロ・教育不要で即日導入可能',
    '無添加・無着色・無香料で健康志向のお客様にも安心',
    'SNS映えする商品デザインで施設の集客にも貢献',
    '施設オリジナルのOEM製造にも対応',
  ],
  social_proof: '全国約50施設に導入済み、月間最大106万円の追加売上実績あり',
  cta_text: '15分ほどお電話かZoomでご説明させていただけないでしょうか。ご都合の良い日時をお知らせいただけますと幸いです。',
}
