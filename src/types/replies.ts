export type Sentiment = '興味あり' | '検討中' | 'お断り' | '質問' | 'その他'

export interface Reply {
  id: string
  user_id: string
  lead_id: string | null
  content: string
  sentiment: Sentiment
  is_read: boolean
  ai_response: string | null
  created_at: string
  updated_at: string
  // joined
  lead?: {
    company_name: string
    contact_name: string | null
    email: string | null
    website_url: string | null
    industry: string | null
    status: string
  } | null
}

export type ReplyInsert = {
  lead_id?: string | null
  content: string
  sentiment?: Sentiment
  ai_response?: string | null
}

export const SENTIMENTS: Sentiment[] = ['興味あり', '検討中', 'お断り', '質問', 'その他']

export const SENTIMENT_CONFIG: Record<
  Sentiment,
  {
    label: string
    emoji: string
    color: string
    bg: string
    border: string
    dot: string
    description: string
  }
> = {
  興味あり: {
    label: '興味あり',
    emoji: '🔥',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    dot: 'bg-emerald-400',
    description: '積極的な関心・商談意欲あり',
  },
  検討中: {
    label: '検討中',
    emoji: '🤔',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    dot: 'bg-amber-400',
    description: '検討・情報収集の段階',
  },
  お断り: {
    label: 'お断り',
    emoji: '🚫',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    dot: 'bg-red-400',
    description: '不要・拒否の意思表示',
  },
  質問: {
    label: '質問',
    emoji: '❓',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
    dot: 'bg-violet-400',
    description: '詳細・条件についての問い合わせ',
  },
  その他: {
    label: 'その他',
    emoji: '💬',
    color: 'text-gray-400',
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/20',
    dot: 'bg-gray-400',
    description: '上記以外の返信',
  },
}

export interface ReplyStats {
  total: number
  unread: number
  interested: number  // 興味あり
  considering: number // 検討中
  declined: number    // お断り
  questions: number   // 質問
  other: number       // その他
}
