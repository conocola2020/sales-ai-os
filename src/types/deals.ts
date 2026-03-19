export type DealStage = '初回接触' | 'ヒアリング' | '提案' | '交渉' | '成約' | '失注'

export const DEAL_STAGES: DealStage[] = [
  '初回接触', 'ヒアリング', '提案', '交渉', '成約', '失注',
]

// Stages that represent an active (open) deal
export const ACTIVE_STAGES: DealStage[] = ['初回接触', 'ヒアリング', '提案', '交渉']

export const STAGE_CONFIG: Record<
  DealStage,
  {
    label: string
    emoji: string
    color: string
    bg: string
    border: string
    dot: string
  }
> = {
  '初回接触': {
    label: '初回接触',
    emoji: '👋',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    dot: 'bg-blue-400',
  },
  'ヒアリング': {
    label: 'ヒアリング',
    emoji: '👂',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
    dot: 'bg-violet-400',
  },
  '提案': {
    label: '提案',
    emoji: '📋',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    dot: 'bg-amber-400',
  },
  '交渉': {
    label: '交渉',
    emoji: '🤝',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    dot: 'bg-orange-400',
  },
  '成約': {
    label: '成約',
    emoji: '🎉',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    dot: 'bg-emerald-400',
  },
  '失注': {
    label: '失注',
    emoji: '🚫',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    dot: 'bg-red-400',
  },
}

export interface DealActivity {
  date: string
  type: 'stage_change' | 'meeting' | 'note' | 'email'
  description: string
  from?: string
  to?: string
}

export interface Deal {
  id: string
  user_id: string
  lead_id: string | null
  company_name: string
  contact_name: string | null
  stage: DealStage
  amount: number | null
  probability: number | null
  next_action: string | null
  next_action_date: string | null // YYYY-MM-DD
  meeting_date: string | null     // ISO datetime for next meeting
  meeting_url: string | null      // TimeRex or other booking URL
  activity_log: DealActivity[] | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type DealInsert = {
  lead_id?: string | null
  company_name: string
  contact_name?: string | null
  stage?: DealStage
  amount?: number | null
  probability?: number | null
  next_action?: string | null
  next_action_date?: string | null
  meeting_date?: string | null
  meeting_url?: string | null
  notes?: string | null
}

export type DealUpdate = {
  lead_id?: string | null
  company_name?: string
  contact_name?: string | null
  stage?: DealStage
  amount?: number | null
  probability?: number | null
  next_action?: string | null
  next_action_date?: string | null
  meeting_date?: string | null
  meeting_url?: string | null
  notes?: string | null
}

export interface DealStats {
  total: number
  active: number
  won: number
  lost: number
  pipelineAmount: number
  weightedAmount: number
  winRate: number | null
}
