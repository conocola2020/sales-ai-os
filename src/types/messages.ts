export interface Message {
  id: string
  user_id: string
  lead_id: string | null
  subject: string | null
  content: string
  tone: string
  created_at: string
  // joined from leads table
  lead?: {
    company_name: string
    contact_name: string | null
  } | null
}

export type MessageInsert = {
  lead_id?: string | null
  subject?: string | null
  content: string
  tone: string
}

export const TONES = ['丁寧', '簡潔', 'フレンドリー'] as const
export type Tone = (typeof TONES)[number]

export const TONE_CONFIG: Record<
  Tone,
  { label: string; description: string; emoji: string; color: string; bg: string; border: string; dot: string }
> = {
  '丁寧': {
    label: '丁寧',
    description: 'フォーマルで信頼感のある文体',
    emoji: '🤝',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    dot: 'bg-blue-400',
  },
  '簡潔': {
    label: '簡潔',
    description: '要点を絞ったスピーディな文体',
    emoji: '⚡',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    dot: 'bg-amber-400',
  },
  'フレンドリー': {
    label: 'フレンドリー',
    description: '親しみやすいカジュアルな文体',
    emoji: '😊',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    dot: 'bg-emerald-400',
  },
}
