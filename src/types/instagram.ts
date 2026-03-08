export type InstagramStatus =
  | '未対応'
  | 'アプローチ中'
  | 'DM送信済み'
  | '返信あり'
  | '成約'
  | 'NG'

export const INSTAGRAM_STATUSES: InstagramStatus[] = [
  '未対応',
  'アプローチ中',
  'DM送信済み',
  '返信あり',
  '成約',
  'NG',
]

export const STATUS_CONFIG: Record<
  InstagramStatus,
  {
    label: string
    color: string
    bg: string
    border: string
    dot: string
    emoji: string
  }
> = {
  '未対応': {
    label: '未対応',
    emoji: '⏳',
    color: 'text-gray-400',
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/20',
    dot: 'bg-gray-400',
  },
  'アプローチ中': {
    label: 'アプローチ中',
    emoji: '👋',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    dot: 'bg-blue-400',
  },
  'DM送信済み': {
    label: 'DM送信済み',
    emoji: '💬',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
    dot: 'bg-violet-400',
  },
  '返信あり': {
    label: '返信あり',
    emoji: '💌',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    dot: 'bg-amber-400',
  },
  '成約': {
    label: '成約',
    emoji: '🎉',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    dot: 'bg-emerald-400',
  },
  'NG': {
    label: 'NG',
    emoji: '🚫',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    dot: 'bg-red-400',
  },
}

export interface InstagramTarget {
  id: string
  user_id: string
  username: string
  display_name: string | null
  bio: string | null
  industry: string | null
  follower_count: number | null
  engagement_rate: number | null
  following: boolean
  liked: boolean
  dm_sent: boolean
  dm_content: string | null
  dm_replied: boolean
  liked_back: boolean
  followed_back: boolean
  status: InstagramStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export type InstagramTargetInsert = {
  username: string
  display_name?: string | null
  bio?: string | null
  industry?: string | null
  follower_count?: number | null
  engagement_rate?: number | null
  following?: boolean
  liked?: boolean
  dm_sent?: boolean
  dm_content?: string | null
  dm_replied?: boolean
  liked_back?: boolean
  followed_back?: boolean
  status?: InstagramStatus
  notes?: string | null
}

export type InstagramTargetUpdate = Partial<InstagramTargetInsert>

export interface InstagramStats {
  total: number
  approached: number  // liked or following
  dmSent: number
  replied: number
  converted: number
  replyRate: number | null
}
