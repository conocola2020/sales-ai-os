'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type {
  InstagramTarget,
  InstagramTargetInsert,
  InstagramTargetUpdate,
  InstagramStats,
} from '@/types/instagram'

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

  const { data, error } = await supabase
    .from('instagram_targets')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error('getTargets error:', error)
    return { data: null, error: error.message }
  }

  return { data: data as InstagramTarget[], error: null }
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
  value: boolean
): Promise<{ data: InstagramTarget | null; error: string | null }> {
  return updateTarget(id, { [flag]: value })
}

// ──────────────────────────────────────────
// Save DM content and mark as sent
// ──────────────────────────────────────────
export async function saveDmAndMarkSent(
  id: string,
  dmContent: string
): Promise<{ data: InstagramTarget | null; error: string | null }> {
  return updateTarget(id, {
    dm_content: dmContent,
    dm_sent: true,
    status: 'DM送信済み',
  })
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
    const { error } = await supabase.from('instagram_targets').insert(rows.slice(i, i + CHUNK))
    if (error) return { count: inserted, error: error.message }
    inserted += Math.min(CHUNK, rows.length - i)
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

// ──────────────────────────────────────────
// Get statistics
// ──────────────────────────────────────────
export async function getTargetStats(): Promise<{
  data: InstagramStats | null
  error: string | null
}> {
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
