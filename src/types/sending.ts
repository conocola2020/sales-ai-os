export type SendStatus = '待機中' | '確認待ち' | '送信済み' | '失敗'

export interface SendQueueItem {
  id: string
  user_id: string
  lead_id: string
  message_content: string
  status: SendStatus
  scheduled_at: string | null
  sent_at: string | null
  error_message: string | null
  retry_count: number
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

export type SendQueueInsert = Pick<SendQueueItem, 'lead_id' | 'message_content'> &
  Partial<Pick<SendQueueItem, 'scheduled_at'>>

export const SEND_STATUSES: SendStatus[] = ['待機中', '確認待ち', '送信済み', '失敗']

export const SEND_STATUS_CONFIG: Record<
  SendStatus,
  { label: string; color: string; bg: string; border: string; dot: string }
> = {
  待機中: {
    label: '待機中',
    color: 'text-gray-400',
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/20',
    dot: 'bg-gray-400',
  },
  確認待ち: {
    label: '確認待ち',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    dot: 'bg-amber-400',
  },
  送信済み: {
    label: '送信済み',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    dot: 'bg-emerald-400',
  },
  失敗: {
    label: '失敗',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    dot: 'bg-red-400',
  },
}

export interface SendStats {
  total: number
  pending: number    // 待機中
  reviewing: number  // 確認待ち
  sent: number       // 送信済み
  failed: number     // 失敗
}
