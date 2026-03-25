export function formatWaitTime(seconds: number): string {
  if (seconds <= 0) return '0秒'
  if (seconds < 60) return `${seconds}秒`
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (secs === 0) return `${minutes}分`
  return `${minutes}分${secs}秒`
}

export function getJstToday(): string {
  const now = new Date()
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return jst.toISOString().slice(0, 10)
}

export function getWarmupLimit(
  accountStartDate: string,
  dailyLimit: number,
  warmupEnabled: boolean
): { effectiveLimit: number; warmupDay: number; warmupPhase: string } {
  if (!warmupEnabled) {
    return {
      effectiveLimit: dailyLimit,
      warmupDay: 999,
      warmupPhase: `通常モード (${dailyLimit}件/日)`,
    }
  }

  const start = new Date(accountStartDate)
  const today = new Date(getJstToday())
  const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  const warmupDay = Math.max(1, diff + 1)

  let effectiveLimit: number
  let warmupPhase: string

  if (warmupDay <= 7) {
    effectiveLimit = Math.min(5, dailyLimit)
    warmupPhase = `ウォームアップ第1週 (${effectiveLimit}件/日)`
  } else if (warmupDay <= 14) {
    effectiveLimit = Math.min(10, dailyLimit)
    warmupPhase = `ウォームアップ第2週 (${effectiveLimit}件/日)`
  } else if (warmupDay <= 21) {
    effectiveLimit = Math.min(15, dailyLimit)
    warmupPhase = `ウォームアップ第3週 (${effectiveLimit}件/日)`
  } else {
    effectiveLimit = dailyLimit
    warmupPhase = `通常モード (${effectiveLimit}件/日)`
  }

  return { effectiveLimit, warmupDay, warmupPhase }
}

export function getNextRecommendedTime(
  lastDmSentAt: string | null,
  minIntervalMinutes: number
): { nextAt: string | null; waitSeconds: number } {
  if (!lastDmSentAt) return { nextAt: null, waitSeconds: 0 }
  const last = new Date(lastDmSentAt)
  const nextAt = new Date(last.getTime() + minIntervalMinutes * 60 * 1000)
  const now = new Date()
  const waitSeconds = Math.max(0, Math.floor((nextAt.getTime() - now.getTime()) / 1000))
  return { nextAt: nextAt.toISOString(), waitSeconds }
}

export function getSafetyLevel(
  count: number,
  limit: number
): 'safe' | 'caution' | 'danger' {
  if (limit <= 0) return 'safe'
  const ratio = count / limit
  if (ratio >= 1) return 'danger'
  if (ratio >= 0.7) return 'caution'
  return 'safe'
}
