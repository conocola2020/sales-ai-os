export interface CompanyAnalysis {
  id: string
  user_id: string
  lead_id: string | null
  url: string
  company_name: string | null
  industry: string | null
  scale: string | null
  business_summary: string | null
  challenges: string[]
  proposal_points: string[]
  keywords: string[]
  raw_analysis: Record<string, unknown> | null
  created_at: string
  lead?: {
    company_name: string
    contact_name: string | null
  } | null
}

export interface AnalysisResult {
  company_name: string
  industry: string
  scale: string
  business_summary: string
  challenges: string[]
  proposal_points: string[]
  keywords: string[]
}

export const SCALE_OPTIONS = [
  '1〜10名',
  '11〜50名',
  '51〜100名',
  '101〜300名',
  '301〜1000名',
  '1000名以上',
  '不明',
] as const

export type Scale = (typeof SCALE_OPTIONS)[number]

export const INDUSTRY_OPTIONS = [
  'IT・ソフトウェア',
  'EC・小売',
  '製造業',
  '金融・保険',
  '医療・ヘルスケア',
  '不動産',
  '教育',
  'コンサルティング',
  '広告・マーケティング',
  '飲食・サービス',
  '物流・運輸',
  'メディア・エンタメ',
  'その他',
] as const

export type Industry = (typeof INDUSTRY_OPTIONS)[number]
