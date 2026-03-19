'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Reply, ReplyInsert, ReplyStats, Sentiment } from '@/types/replies'

const LEAD_SELECT = `
  *,
  lead:lead_id (
    company_name,
    contact_name,
    email,
    website_url,
    industry,
    status
  )
`

// ──────────────────────────────────────────
// Fetch all replies for current user
// ──────────────────────────────────────────
export async function getReplies(): Promise<{
  data: Reply[] | null
  error: string | null
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { data: [], error: null }

  const { data, error } = await supabase
    .from('replies')
    .select(LEAD_SELECT)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('getReplies error:', error)
    return { data: null, error: error.message }
  }

  return { data: data as Reply[], error: null }
}

// ──────────────────────────────────────────
// Save a new reply (after AI classification)
// ──────────────────────────────────────────
export async function createReply(
  item: ReplyInsert
): Promise<{ data: Reply | null; error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { data: null, error: '認証が必要です' }

  const { data, error } = await supabase
    .from('replies')
    .insert({
      user_id: user.id,
      lead_id: item.lead_id ?? null,
      content: item.content,
      sentiment: item.sentiment ?? 'その他',
      ai_response: item.ai_response ?? null,
      is_read: false,
    })
    .select(LEAD_SELECT)
    .single()

  if (error) {
    console.error('createReply error:', error)
    return { data: null, error: error.message }
  }

  revalidatePath('/dashboard/replies')
  return { data: data as Reply, error: null }
}

// ──────────────────────────────────────────
// Mark reply as read
// ──────────────────────────────────────────
export async function markAsRead(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: '認証が必要です' }

  const { error } = await supabase
    .from('replies')
    .update({ is_read: true })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/replies')
  return { error: null }
}

// ──────────────────────────────────────────
// Mark all replies as read
// ──────────────────────────────────────────
export async function markAllAsRead(): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: '認証が必要です' }

  const { error } = await supabase
    .from('replies')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/replies')
  return { error: null }
}

// ──────────────────────────────────────────
// Update sentiment manually
// ──────────────────────────────────────────
export async function updateSentiment(
  id: string,
  sentiment: Sentiment
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: '認証が必要です' }

  const { error } = await supabase
    .from('replies')
    .update({ sentiment })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/replies')
  return { error: null }
}

// ──────────────────────────────────────────
// Update AI response draft
// ──────────────────────────────────────────
export async function saveAiResponse(
  id: string,
  aiResponse: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: '認証が必要です' }

  const { error } = await supabase
    .from('replies')
    .update({ ai_response: aiResponse })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/replies')
  return { error: null }
}

// ──────────────────────────────────────────
// Link reply to a lead
// ──────────────────────────────────────────
export async function linkReplyToLead(
  replyId: string,
  leadId: string
): Promise<{ data: Reply | null; error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { data: null, error: '認証が必要です' }

  const { data, error } = await supabase
    .from('replies')
    .update({ lead_id: leadId })
    .eq('id', replyId)
    .eq('user_id', user.id)
    .select(LEAD_SELECT)
    .single()

  if (error) return { data: null, error: error.message }
  revalidatePath('/dashboard/replies')
  return { data: data as Reply, error: null }
}

// ──────────────────────────────────────────
// Delete a reply
// ──────────────────────────────────────────
export async function deleteReply(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: '認証が必要です' }

  const { error } = await supabase
    .from('replies')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/replies')
  return { error: null }
}

// ──────────────────────────────────────────
// Get reply statistics
// ──────────────────────────────────────────
export async function getReplyStats(): Promise<{
  data: ReplyStats | null
  error: string | null
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      data: { total: 0, unread: 0, interested: 0, considering: 0, declined: 0, questions: 0, other: 0 },
      error: null,
    }
  }

  const { data, error } = await supabase
    .from('replies')
    .select('sentiment, is_read')
    .eq('user_id', user.id)

  if (error) {
    console.error('getReplyStats error:', error)
    return { data: null, error: error.message }
  }

  const rows = data as { sentiment: string; is_read: boolean }[]
  const stats: ReplyStats = {
    total: rows.length,
    unread: rows.filter(r => !r.is_read).length,
    interested: rows.filter(r => r.sentiment === '興味あり').length,
    considering: rows.filter(r => r.sentiment === '検討中').length,
    declined: rows.filter(r => r.sentiment === 'お断り').length,
    questions: rows.filter(r => r.sentiment === '質問').length,
    other: rows.filter(r => r.sentiment === 'その他').length,
  }

  return { data: stats, error: null }
}
