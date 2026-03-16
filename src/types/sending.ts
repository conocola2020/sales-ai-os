export type SendStatus = '待機中' | '確認待ち' | '送信済み' | '失敗' | 'form_not_found'
export type SendMethod = 'email' | 'form'

export interface SendQueueItem {
  id: string
  user_id: string
  lead_id: string
  message_content: string
  subject: string | null
  send_method: SendMethod
  status: SendStatus
  form_url: string | null
  screenshot_url: string | null
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
    company_url: string | null
    industry: string | null
    status: string
  } | null
}

export type SendQueueInsert = Pick<SendQueueItem, 'lead_id' | 'message_content'> &
  Partial<Pick<SendQueueItem, 'subject' | 'scheduled_at' | 'send_method'>>

export const SEND_STATUSES: SendStatus[] = ['待機中', '確認待ち', '送信済み', '失敗', 'form_not_found']

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
  form_not_found: {
    label: 'フォーム未検出',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    dot: 'bg-orange-400',
  },
}

export const SEND_METHOD_CONFIG: Record<
  SendMethod,
  { label: string; color: string; bg: string; border: string }
> = {
  email: {
    label: 'メール',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
  form: {
    label: 'フォーム',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
  },
}

export interface SendStats {
  total: number
  pending: number    // 待機中
  reviewing: number  // 確認待ち
  sent: number       // 送信済み
  failed: number     // 失敗
}
