export type LeadStatus = '未着手' | '送信済み' | '返信あり' | '商談中' | '成約' | 'NG' | 'お断り'

export interface Lead {
  id: string
  user_id: string
  company_name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  website_url: string | null
  company_url: string | null
  instagram_url?: string | null
  contact_method?: 'form' | 'email' | 'instagram' | 'manual' | 'none' | null
  industry: string | null
  prefecture: string | null
  status: LeadStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export const PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
] as const

export type LeadInsert = Pick<Lead, 'company_name' | 'status'> & Partial<Omit<Lead, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'company_name' | 'status'>>

// ドロップダウン・紐付け用の軽量型
export type LeadOption = Pick<Lead, 'id' | 'company_name' | 'contact_name' | 'status' | 'industry' | 'notes' | 'website_url' | 'company_url' | 'email' | 'contact_method'>
export type LeadUpdate = Partial<LeadInsert>

export const LEAD_STATUSES: LeadStatus[] = [
  '未着手', '送信済み', '返信あり', '商談中', '成約', 'NG', 'お断り'
]

export const INDUSTRIES = [
  'IT・ソフトウェア', 'SaaS・クラウド', 'EC・小売', '製造業',
  '建設・不動産', '金融・保険', '医療・ヘルスケア', '教育',
  'メディア・広告', '飲食・食品', '物流・運輸', 'コンサルティング',
  'その他',
]

export const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bg: string; border: string; dot: string }> = {
  '未着手': {
    label: '未着手',
    color: 'text-gray-400',
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/20',
    dot: 'bg-gray-400',
  },
  '送信済み': {
    label: '送信済み',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    dot: 'bg-blue-400',
  },
  '返信あり': {
    label: '返信あり',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
    dot: 'bg-violet-400',
  },
  '商談中': {
    label: '商談中',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    dot: 'bg-amber-400',
  },
  '成約': {
    label: '成約',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    dot: 'bg-emerald-400',
  },
  'NG': {
    label: 'NG',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    dot: 'bg-red-400',
  },
  'お断り': {
    label: 'お断り',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    dot: 'bg-red-400',
  },
}
