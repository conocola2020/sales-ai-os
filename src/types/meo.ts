// MEO/AIO対策モジュールの型定義

export type ReviewReplyStatus = '未返信' | '下書き' | '返信済み' | '自動返信済' | '返信不要'
export type CitationKind = 'ai' | 'voice' | 'platform'
export type CitationStatus = '同期済み' | '送信済み' | '未連携' | 'エラー'
export type AioEngine = 'claude' | 'chatgpt' | 'gemini' | 'perplexity'

export interface MeoLocation {
  id: string
  user_id: string
  name: string
  address: string | null
  category: string | null
  website: string | null
  google_place_id: string | null
  created_at: string
}

export interface MeoReview {
  id: string
  user_id: string
  location_id: string
  source: string
  author: string | null
  rating: number | null
  body: string | null
  review_date: string | null
  reply_body: string | null
  reply_status: ReviewReplyStatus
  replied_at: string | null
  created_at: string
}

export interface MeoCitation {
  id: string
  user_id: string
  location_id: string
  kind: CitationKind
  name: string
  domain: string | null
  status: CitationStatus
  indexed: boolean
  listing_url: string | null
  last_synced_at: string | null
  created_at: string
}

export interface MeoAioCheck {
  id: string
  user_id: string
  location_id: string
  engine: AioEngine
  query: string
  mentioned: boolean
  rank: number | null
  snippet: string | null
  answer: string | null
  checked_at: string
}

export interface MeoStats {
  citationCount: number
  citationSyncedCount: number
  reviewCount: number
  averageRating: number
  unrepliedCount: number
  aioCheckCount: number
  aioMentionedCount: number
}
