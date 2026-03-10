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
  company_name: 'CONOCOLA',
  representative: '',
  representative_title: '',
  company_email: '',
  company_phone: '',
  company_website: '',
  company_location: '',
  company_description:
    'サウナ施設向けに「サウナ専用コーラ」と「サ飯（冷凍スパイスカレー等）」を提供。サウナーの"ととのい"体験をドリンク・フード面からサポートし、施設の売上向上と差別化に貢献します。',
  products: [
    {
      name: 'サウナー専用コーラ',
      description: 'サウナ後の"ととのい"に最適化されたクラフトコーラ。スパイスとハーブを独自ブレンドし、サウナ後のリフレッシュ感を最大化。',
      benefits: '施設のドリンクメニュー差別化、客単価向上、SNS映えによる集客効果',
    },
    {
      name: 'サ飯（冷凍スパイスカレー等）',
      description: 'サウナ後に食べたくなるスパイスカレーをはじめとした冷凍フードライン。調理の手間なく、温めるだけで提供可能。',
      benefits: 'フードメニュー拡充、調理人員不要でコスト削減、サウナ飯ブームへの対応',
    },
  ],
  value_propositions: [
    'サウナ施設に特化した商品ラインナップ',
    '導入の手軽さ（冷凍・常温保存可能）',
    'SNS映えする商品デザインで施設の集客にも貢献',
  ],
  social_proof: '',
  cta_text: 'まずはサンプルをお送りさせていただければと思います。ご都合の良い日時をお知らせいただけますでしょうか。',
}
