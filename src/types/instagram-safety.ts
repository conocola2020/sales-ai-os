export interface InstagramSafetySettings {
  id?: string
  user_id?: string
  account_start_date: string // YYYY-MM-DD
  daily_dm_limit: number
  min_interval_minutes: number
  warmup_enabled: boolean
  created_at?: string
  updated_at?: string
}

export interface InstagramActivityLog {
  id: string
  user_id: string
  action_type: 'dm_sent' | 'like' | 'follow' | string
  target_id?: string | null
  username?: string | null
  notes?: string | null
  created_at: string
}

export type SafetyLevel = 'safe' | 'caution' | 'danger'

export interface DmSafetyStatus {
  todayDmCount: number
  effectiveLimit: number
  hardLimit: number
  warmupDay: number
  warmupPhase: string
  lastDmSentAt: string | null
  nextRecommendedAt: string | null
  waitSeconds: number
  safetyLevel: SafetyLevel
  canSendNow: boolean
  todayLikeCount: number
  todayFollowCount: number
}
