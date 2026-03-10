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
  company_name: '株式会社コーノコーラ',
  representative: '河野大地',
  representative_title: '代表取締役',
  company_email: 'conocola2020@gmail.com',
  company_phone: '052-228-4945',
  company_website: 'https://conocola.com',
  company_location: '愛知県名古屋市東区東桜1-1-1 アーバンネット名古屋 ネクスタビルB1F',
  company_description:
    '世界初のサウナに特化したサウナ専用コーラを開発・販売する名古屋発の会社。2025年1月の発売から1年間で全国約54施設に導入拡大。名古屋でスパイスカレー専門店「コーノスパイス」も運営しており、そのスパイスカレーを真空冷凍パックにしてサウナ施設様へ卸売り。差別化したい店舗様には施設オリジナルのクラフトコーラのOEM製造も対応。',
  products: [
    {
      name: 'サウナーコーラ（サウナ専用コーラ）',
      description: '世界初のサウナに特化したクラフトコーラ。10種類以上のスパイスと生薬を独自ブレンドし、無添加・無着色・無香料で身体に優しい。2025年1月発売、1年で全国約54施設に導入。飲んだ人の満足度が非常に高く、リピート率が高い。1年以上継続して取り扱っている施設がほとんど。老若男女幅広く受け入れられている。',
      benefits: '設備投資ゼロで導入可能、教育不要で今日入った新人でもすぐ提供できる、ドリンクメニューの差別化、客単価向上、SNS映えによる集客効果、高いリピート率で安定した売上',
    },
    {
      name: 'サ飯（冷凍スパイスカレー）',
      description: '名古屋のスパイスカレー専門店「コーノスパイス」が作る本格スパイスカレーを真空冷凍パックにしてサウナ施設様へ卸売り。チキン・キーマ・サバと大根など複数種類。温めるだけで本格的なスパイスカレーが提供可能。',
      benefits: 'キッチンが狭く設備投資ができない店舗でもOK、調理人員不要でコスト削減、温めるだけで本格的な味を提供、小さなスペースから大きな施設まで対応、サウナ飯ブームへの対応',
    },
    {
      name: 'OEM/施設オリジナルクラフトコーラ',
      description: '差別化したい店舗様向けに、施設オリジナルラベルやオリジナルレシピのクラフトコーラをOEM製造。球場関係、国民的アニメIPコラボ、有名外資高級ホテル、話題の時代劇ドラマコラボ商品など幅広い実績あり。小ロットから大ロットまで柔軟に対応可能で、フットワーク軽く小回りがきくのが強み。',
      benefits: '施設の独自ブランディング、他施設との明確な差別化、話題性による集客効果、オリジナル商品としての販売で利益率向上、小ロットから対応可能でリスクが低い',
    },
  ],
  value_propositions: [
    '世界初のサウナ専用コーラ — 他にない唯一無二の商品',
    '設備投資ゼロ・教育不要で即日導入可能',
    '飲んだ人の満足度・リピート率が非常に高い',
    '1年以上継続取扱いの施設がほとんど — 安定した売上に貢献',
    '無添加・無着色・無香料で健康志向のお客様にも安心',
    'OEM製造は小ロット〜大ロットまで対応、フットワーク軽く小回りがきく',
    'OEM実績: 球場関係、国民的アニメIP、有名外資高級ホテル、時代劇ドラマコラボ等',
  ],
  social_proof: '2025年1月発売、1年間で全国約54施設に導入。1年以上継続して取り扱っていただいている施設がほとんどで、リピート率の高さが実証済み。月間最大106万円の追加売上実績あり。OEM実績は球場・アニメIP・外資高級ホテル・時代劇ドラマなど多数。',
  cta_text: '15分ほどお電話かZoomでご説明させていただけないでしょうか。ご都合の良い日時をお知らせいただけますと幸いです。',
}
