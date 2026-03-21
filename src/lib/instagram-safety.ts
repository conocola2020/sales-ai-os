import type { SafetyLevel } from '@/types/instagram-safety'

/** JST (UTC+9) の今日の日付を YYYY-MM-DD で返す */
export function getJstToday(): string {
  const now = new Date()
  // JST offset: +9h
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return jst.toISOString().slice(0, 10)
}

/** アカウント開始日からのウォームアップ上限を計算する */
export function getWarmupLimit(
  accountStartDate: string,
  dailyDmLimit: number,
  warmupEnabled: boolean
): { effectiveLimit: number; warmupDay: number; warmupPhase: string } {
  if (!warmupEnabled) {
    return {
      effectiveLimit: dailyDmLimit,
      warmupDay: 0,
      warmupPhase: `通常モード (${dailyDmLimit}件/日)`,
    }
  }

  const start = new Date(accountStartDate)
  const today = new Date(getJstToday())
  const diffMs = today.getTime() - start.getTime()
  const warmupDay = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1)

  let effectiveLimit: number
  let warmupPhase: string

  if (warmupDay <= 7) {
    effectiveLimit = Math.min(5, dailyDmLimit)
    warmupPhase = `ウォームアップ ${warmupDay}日目 (${effectiveLimit}件/日)`
  } else if (warmupDay <= 14) {
    effectiveLimit = Math.min(10, dailyDmLimit)
    warmupPhase = `ウォームアップ ${warmupDay}日目 (${effectiveLimit}件/日)`
  } else if (warmupDay <= 30) {
    effectiveLimit = Math.min(15, dailyDmLimit)
    warmupPhase = `ウォームアップ ${warmupDay}日目 (${effectiveLimit}件/日)`
  } else {
    effectiveLimit = dailyDmLimit
    warmupPhase = `通常モード (${dailyDmLimit}件/日)`
  }

  return { effectiveLimit, warmupDay, warmupPhase }
}

/** 直近のDM送信時刻と最小インターバルから次推奨送信時刻を計算 */
export function getNextRecommendedTime(
  lastDmSentAt: string | null,
  minIntervalMinutes: number
): { nextAt: string | null; waitSeconds: number } {
  if (!lastDmSentAt) {
    return { nextAt: null, waitSeconds: 0 }
  }

  const lastSent = new Date(lastDmSentAt)
  const nextAt = new Date(lastSent.getTime() + minIntervalMinutes * 60 * 1000)
  const now = new Date()
  const waitMs = nextAt.getTime() - now.getTime()

  if (waitMs <= 0) {
    return { nextAt: null, waitSeconds: 0 }
  }

  return {
    nextAt: nextAt.toISOString(),
    waitSeconds: Math.ceil(waitMs / 1000),
  }
}

/** 今日の送信数と上限からセーフティレベルを判定 */
export function getSafetyLevel(todayDmCount: number, effectiveLimit: number): SafetyLevel {
  if (todayDmCount >= effectiveLimit) return 'danger'
  if (todayDmCount >= Math.floor(effectiveLimit * 0.7)) return 'caution'
  return 'safe'
}

/** 待機秒数を日本語でフォーマット */
export function formatWaitTime(seconds: number): string {
  if (seconds <= 0) return 'すぐ送信可能'
  if (seconds < 60) return `${seconds}秒`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}分`
  const hours = Math.floor(minutes / 60)
  const remainMinutes = minutes % 60
  return remainMinutes > 0 ? `${hours}時間${remainMinutes}分` : `${hours}時間`
}
