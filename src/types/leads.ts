export type LeadStatus = '未着手' | '送信済み' | '返信あり' | '商談中' | '成約' | 'NG'

export interface Lead {
  id: string
  user_id: string
  company_name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  website_url: string | null
  company_url: string | null
  industry: string | null
  status: LeadStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export type LeadInsert = Pick<Lead, 'company_name' | 'status'> & Partial<Omit<Lead, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'company_name' | 'status'>>
export type LeadUpdate = Partial<LeadInsert>

export const LEAD_STATUSES: LeadStatus[] = [
  '未着手', '送信済み', '返信あり', '商談中', '成約', 'NG'
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
}
