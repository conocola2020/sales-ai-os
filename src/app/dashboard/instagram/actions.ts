'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type {
  InstagramTarget,
  InstagramTargetInsert,
  InstagramTargetUpdate,
  InstagramStats,
} from '@/types/instagram'
import type {
  InstagramSafetySettings,
  InstagramActivityLog,
  DmSafetyStatus,
} from '@/types/instagram-safety'
import {
  getWarmupLimit,
  getSafetyLevel,
  getNextRecommendedTime,
  getJstToday,
} from '@/lib/instagram-safety'

// ──────────────────────────────────────────
// Fetch all targets for current user
// ──────────────────────────────────────────
export async function getTargets(): Promise<{
  data: InstagramTarget[] | null
  error: string | null
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { data: [], error: null }

  // Supabaseは1リクエスト最大1000行。ページネーションで全件取得
  const PAGE_SIZE = 1000
  const allRows: InstagramTarget[] = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('instagram_targets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      console.error('getTargets error:', error)
      return { data: allRows.length > 0 ? allRows : null, error: error.message }
    }

    allRows.push(...(data as InstagramTarget[]))

    if (data.length < PAGE_SIZE) break // 最後のページ
    from += PAGE_SIZE
  }

  return { data: allRows, error: null }
}

// ──────────────────────────────────────────
// Create a new target
// ──────────────────────────────────────────
export async function createTarget(
  item: InstagramTargetInsert
): Promise<{ data: InstagramTarget | null; error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { data: null, error: '認証が必要です' }

  const { data, error } = await supabase
    .from('instagram_targets')
    .insert({
      user_id: user.id,
      username: item.username.replace(/^@/, '').trim(),
      display_name: item.display_name ?? null,
      bio: item.bio ?? null,
      industry: item.industry ?? null,
      follower_count: item.follower_count ?? null,
      engagement_rate: item.engagement_rate ?? null,
      following: item.following ?? false,
      liked: item.liked ?? false,
      dm_sent: item.dm_sent ?? false,
      dm_content: item.dm_content ?? null,
      dm_replied: item.dm_replied ?? false,
      liked_back: item.liked_back ?? false,
      followed_back: item.followed_back ?? false,
      status: item.status ?? '未対応',
      notes: item.notes ?? null,
    })
    .select('*')
    .single()

  if (error) {
    console.error('createTarget error:', error)
    return { data: null, error: error.message }
  }

  revalidatePath('/dashboard/instagram')
  return { data: data as InstagramTarget, error: null }
}

// ──────────────────────────────────────────
// Update a target
// ──────────────────────────────────────────
export async function updateTarget(
  id: string,
  changes: InstagramTargetUpdate
): Promise<{ data: InstagramTarget | null; error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { data: null, error: '認証が必要です' }

  // Normalize username if provided
  if (changes.username) {
    changes = { ...changes, username: changes.username.replace(/^@/, '').trim() }
  }

  const { data, error } = await supabase
    .from('instagram_targets')
    .update(changes)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*')
    .single()

  if (error) {
    console.error('updateTarget error:', error)
    return { data: null, error: error.message }
  }

  revalidatePath('/dashboard/instagram')
  return { data: data as InstagramTarget, error: null }
}

// ──────────────────────────────────────────
// Delete a target
// ──────────────────────────────────────────
export async function deleteTarget(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: '認証が必要です' }

  const { error } = await supabase
    .from('instagram_targets')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/instagram')
  return { error: null }
}

// ──────────────────────────────────────────
// Toggle quick-action flags
// ──────────────────────────────────────────
export async function toggleFlag(
  id: string,
  flag: 'liked' | 'following' | 'dm_replied' | 'liked_back' | 'followed_back',
  value: boolean,
  targetUsername?: string
): Promise<{ data: InstagramTarget | null; error: string | null }> {
  const result = await updateTarget(id, { [flag]: value })

  // Log like/follow actions
  if (result.data && value) {
    const actionMap: Record<string, 'like' | 'follow' | undefined> = {
      liked: 'like',
      following: 'follow',
    }
    const actionType = actionMap[flag]
    if (actionType) {
      logActivity(id, actionType, targetUsername || result.data.username).catch(() => {})
    }
  }

  return result
}

// ──────────────────────────────────────────
// Save DM content and mark as sent (+ activity log)
// ──────────────────────────────────────────
export async function saveDmAndMarkSent(
  id: string,
  dmContent: string,
  targetUsername?: string
): Promise<{ data: InstagramTarget | null; error: string | null }> {
  const result = await updateTarget(id, {
    dm_content: dmContent,
    dm_sent: true,
    status: 'DM送信済み',
  })

  // Activity log (fire-and-forget)
  if (result.data) {
    logActivity(id, 'dm_sent', targetUsername || result.data.username).catch(() => {})
  }

  return result
}

// ──────────────────────────────────────────
// Bulk create targets (CSV import)
// ──────────────────────────────────────────
export async function bulkCreateTargets(
  items: InstagramTargetInsert[]
): Promise<{ count: number; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { count: 0, error: '認証が必要です' }

  const rows = items.map(item => ({
    user_id: user.id,
    username: item.username.replace(/^@/, '').trim(),
    display_name: item.display_name ?? null,
    bio: item.bio ?? null,
    industry: item.industry ?? null,
    follower_count: item.follower_count ?? null,
    engagement_rate: item.engagement_rate ?? null,
    following: false,
    liked: false,
    dm_sent: false,
    dm_content: null,
    dm_replied: false,
    liked_back: false,
    followed_back: false,
    status: '未対応' as const,
    notes: item.notes ?? null,
  }))

  const CHUNK = 500
  let inserted = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const { error } = await supabase
      .from('instagram_targets')
      .upsert(chunk, { onConflict: 'user_id,username', ignoreDuplicates: true })
    if (error) {
      console.error('bulkCreate chunk error:', error.message)
      // Continue with next chunk instead of stopping
      continue
    }
    inserted += chunk.length
  }

  revalidatePath('/dashboard/instagram')
  return { count: inserted, error: null }
}

// ──────────────────────────────────────────
// Bulk delete targets
// ──────────────────────────────────────────
export async function bulkDeleteTargets(
  ids: string[]
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証が必要です' }

  const { error } = await supabase
    .from('instagram_targets')
    .delete()
    .in('id', ids)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/instagram')
  return { error: null }
}

// ══════════════════════════════════════════
// 安全管理システム
// ══════════════════════════════════════════

// ──────────────────────────────────────────
// Activity logging
// ──────────────────────────────────────────
export async function logActivity(
  targetId: string | null,
  actionType: 'dm_sent' | 'like' | 'follow' | 'unfollow',
  targetUsername?: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証が必要です' }

  const { error } = await supabase.from('instagram_activity_log').insert({
    user_id: user.id,
    target_id: targetId,
    action_type: actionType,
    target_username: targetUsername ?? null,
  })

  if (error) {
    console.error('logActivity error:', error)
    return { error: error.message }
  }
  return { error: null }
}

// ──────────────────────────────────────────
// Safety settings CRUD
// ──────────────────────────────────────────
export async function getSafetySettings(): Promise<{
  data: InstagramSafetySettings | null
  error: string | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: null }

  const { data, error } = await supabase
    .from('instagram_safety_settings')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return { data: null, error: error.message }

  // Auto-create defaults if not exists
  if (!data) {
    const { data: created, error: createErr } = await supabase
      .from('instagram_safety_settings')
      .insert({
        user_id: user.id,
        account_start_date: getJstToday(),
        daily_dm_limit: 20,
        min_interval_minutes: 5,
        warmup_enabled: true,
      })
      .select('*')
      .single()

    if (createErr) return { data: null, error: createErr.message }
    return { data: created as InstagramSafetySettings, error: null }
  }

  return { data: data as InstagramSafetySettings, error: null }
}

export async function updateSafetySettings(
  changes: Partial<Pick<InstagramSafetySettings, 'account_start_date' | 'daily_dm_limit' | 'min_interval_minutes' | 'warmup_enabled'>>
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証が必要です' }

  const { error } = await supabase
    .from('instagram_safety_settings')
    .update(changes)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  return { error: null }
}

// ──────────────────────────────────────────
// DM Safety Status (main check)
// ──────────────────────────────────────────
export async function getDmSafetyStatus(): Promise<{
  data: DmSafetyStatus | null
  error: string | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Demo mode: return safe defaults
  if (!user) {
    return {
      data: {
        todayDmCount: 0,
        effectiveLimit: 20,
        hardLimit: 20,
        warmupDay: 30,
        warmupPhase: '通常モード (20件/日)',
        lastDmSentAt: null,
        nextRecommendedAt: null,
        waitSeconds: 0,
        safetyLevel: 'safe',
        canSendNow: true,
        todayLikeCount: 0,
        todayFollowCount: 0,
      },
      error: null,
    }
  }

  // Fetch settings
  const { data: settings } = await getSafetySettings()
  const safetySettings = settings || {
    account_start_date: getJstToday(),
    daily_dm_limit: 20,
    min_interval_minutes: 5,
    warmup_enabled: true,
  }

  // Fetch today's activity (JST midnight boundary)
  const today = getJstToday()
  const todayMidnight = `${today}T00:00:00+09:00`

  const { data: activities } = await supabase
    .from('instagram_activity_log')
    .select('action_type, created_at')
    .eq('user_id', user.id)
    .gte('created_at', todayMidnight)
    .order('created_at', { ascending: false })

  const rows = (activities || []) as { action_type: string; created_at: string }[]
  const todayDmCount = rows.filter(r => r.action_type === 'dm_sent').length
  const todayLikeCount = rows.filter(r => r.action_type === 'like').length
  const todayFollowCount = rows.filter(r => r.action_type === 'follow').length

  // Last DM timestamp
  const lastDmRow = rows.find(r => r.action_type === 'dm_sent')
  const lastDmSentAt = lastDmRow?.created_at ?? null

  // Warmup calculation
  const warmup = getWarmupLimit(
    safetySettings.account_start_date,
    safetySettings.daily_dm_limit,
    safetySettings.warmup_enabled
  )

  // Next recommended time
  const nextRec = getNextRecommendedTime(lastDmSentAt, safetySettings.min_interval_minutes)

  // Safety level
  const safetyLevel = getSafetyLevel(todayDmCount, warmup.effectiveLimit)

  return {
    data: {
      todayDmCount,
      effectiveLimit: warmup.effectiveLimit,
      hardLimit: safetySettings.daily_dm_limit,
      warmupDay: warmup.warmupDay,
      warmupPhase: warmup.warmupPhase,
      lastDmSentAt,
      nextRecommendedAt: nextRec.nextAt,
      waitSeconds: nextRec.waitSeconds,
      safetyLevel,
      canSendNow: todayDmCount < warmup.effectiveLimit,
      todayLikeCount,
      todayFollowCount,
    },
    error: null,
  }
}

// ──────────────────────────────────────────
// Recent activity log
// ──────────────────────────────────────────
export async function getRecentActivityLog(
  limit: number = 20
): Promise<{ data: InstagramActivityLog[]; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [], error: null }

  const { data, error } = await supabase
    .from('instagram_activity_log')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return { data: [], error: error.message }
  return { data: (data || []) as InstagramActivityLog[], error: null }
}

// ──────────────────────────────────────────
// Get statistics
// ──────────────────────────────────────────
export async function getTargetStats(): Promise<{
  data: InstagramStats | null
  error: string | null
}> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl || supabaseUrl === 'your-supabase-url') {
    return { data: { total: 0, approached: 0, dmSent: 0, replied: 0, converted: 0, replyRate: null }, error: null }
  }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      data: { total: 0, approached: 0, dmSent: 0, replied: 0, converted: 0, replyRate: null },
      error: null,
    }
  }

  const { data, error } = await supabase
    .from('instagram_targets')
    .select('liked, following, dm_sent, dm_replied, status')
    .eq('user_id', user.id)

  if (error) {
    console.error('getTargetStats error:', error)
    return { data: null, error: error.message }
  }

  const rows = data as {
    liked: boolean
    following: boolean
    dm_sent: boolean
    dm_replied: boolean
    status: string
  }[]

  const approached = rows.filter(r => r.liked || r.following).length
  const dmSent = rows.filter(r => r.dm_sent).length
  const replied = rows.filter(r => r.dm_replied).length
  const converted = rows.filter(r => r.status === '成約').length
  const replyRate = dmSent > 0 ? Math.round((replied / dmSent) * 100) : null

  return {
    data: { total: rows.length, approached, dmSent, replied, converted, replyRate },
    error: null,
  }
}
