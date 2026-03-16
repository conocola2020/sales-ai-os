'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { SendQueueItem, SendQueueInsert, SendStats, SendMethod } from '@/types/sending'

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
// Fetch all queue items for current user
// ──────────────────────────────────────────
export async function getSendQueue(): Promise<{
  data: SendQueueItem[] | null
  error: string | null
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: [], error: null }
  }

  const { data, error } = await supabase
    .from('send_queue')
    .select(LEAD_SELECT)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('getSendQueue error:', error)
    return { data: null, error: error.message }
  }

  return { data: data as SendQueueItem[], error: null }
}

// ──────────────────────────────────────────
// Add a lead + message to the send queue
// ──────────────────────────────────────────
export async function addToQueue(
  item: SendQueueInsert
): Promise<{ data: SendQueueItem | null; error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: '認証が必要です' }
  }

  // Auto-detect send method based on lead email
  let sendMethod: SendMethod = item.send_method ?? 'form'
  if (!item.send_method) {
    const { data: lead } = await supabase
      .from('leads')
      .select('email')
      .eq('id', item.lead_id)
      .single()
    sendMethod = lead?.email ? 'email' : 'form'
  }

  const { data, error } = await supabase
    .from('send_queue')
    .insert({
      user_id: user.id,
      lead_id: item.lead_id,
      message_content: item.message_content,
      send_method: sendMethod,
      scheduled_at: item.scheduled_at ?? null,
      status: '待機中',
    })
    .select(LEAD_SELECT)
    .single()

  if (error) {
    console.error('addToQueue error:', error)
    return { data: null, error: error.message }
  }

  revalidatePath('/dashboard/sending')
  return { data: data as SendQueueItem, error: null }
}

// ──────────────────────────────────────────
// Move item to 確認待ち (ready for review)
// ──────────────────────────────────────────
export async function markAsReady(
  id: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: '認証が必要です' }

  const { error } = await supabase
    .from('send_queue')
    .update({ status: '確認待ち' })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/sending')
  return { error: null }
}

// ──────────────────────────────────────────
// Mark item as sent (送信済み) + update lead status
// ──────────────────────────────────────────
export async function markAsSent(
  id: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: '認証が必要です' }

  // 1. Get the queue item to find the lead_id
  const { data: queueItem, error: fetchError } = await supabase
    .from('send_queue')
    .select('lead_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !queueItem) {
    return { error: fetchError?.message ?? 'アイテムが見つかりません' }
  }

  // 2. Update queue item status to 送信済み
  const { error: queueError } = await supabase
    .from('send_queue')
    .update({ status: '送信済み', sent_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (queueError) return { error: queueError.message }

  // 3. Update the lead status to 送信済み
  const { error: leadError } = await supabase
    .from('leads')
    .update({ status: '送信済み' })
    .eq('id', queueItem.lead_id)
    .eq('user_id', user.id)

  if (leadError) {
    console.error('markAsSent lead update error:', leadError)
    // Non-fatal: queue is updated but lead update failed
  }

  revalidatePath('/dashboard/sending')
  revalidatePath('/dashboard/leads')
  return { error: null }
}

// ──────────────────────────────────────────
// Mark item as failed
// ──────────────────────────────────────────
export async function markAsFailed(
  id: string,
  errorMessage: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: '認証が必要です' }

  const { error } = await supabase
    .from('send_queue')
    .update({
      status: '失敗',
      error_message: errorMessage,
    })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/sending')
  return { error: null }
}

// ──────────────────────────────────────────
// Retry a failed item (reset to 待機中)
// ──────────────────────────────────────────
export async function retryQueueItem(
  id: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: '認証が必要です' }

  // Increment retry_count and reset status
  const { data: current, error: fetchError } = await supabase
    .from('send_queue')
    .select('retry_count')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !current) {
    return { error: fetchError?.message ?? 'アイテムが見つかりません' }
  }

  const { error } = await supabase
    .from('send_queue')
    .update({
      status: '待機中',
      error_message: null,
      retry_count: (current.retry_count as number) + 1,
    })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/sending')
  return { error: null }
}

// ──────────────────────────────────────────
// Delete a queue item
// ──────────────────────────────────────────
export async function deleteQueueItem(
  id: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: '認証が必要です' }

  const { error } = await supabase
    .from('send_queue')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/sending')
  return { error: null }
}

// ──────────────────────────────────────────
// Get send statistics
// ──────────────────────────────────────────
export async function getSendStats(): Promise<{
  data: SendStats | null
  error: string | null
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      data: { total: 0, pending: 0, reviewing: 0, sent: 0, failed: 0 },
      error: null,
    }
  }

  const { data, error } = await supabase
    .from('send_queue')
    .select('status')
    .eq('user_id', user.id)

  if (error) {
    console.error('getSendStats error:', error)
    return { data: null, error: error.message }
  }

  const rows = data as { status: string }[]
  const stats: SendStats = {
    total: rows.length,
    pending: rows.filter(r => r.status === '待機中').length,
    reviewing: rows.filter(r => r.status === '確認待ち').length,
    sent: rows.filter(r => r.status === '送信済み').length,
    failed: rows.filter(r => r.status === '失敗').length,
  }

  return { data: stats, error: null }
}
