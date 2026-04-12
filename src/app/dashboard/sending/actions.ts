'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { SendQueueItem, SendQueueInsert, SendStats, SendMethod, SendStatus } from '@/types/sending'

const LEAD_SELECT = `
  *,
  lead:lead_id (
    company_name,
    contact_name,
    email,
    website_url,
    company_url,
    contact_url,
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
    .limit(1000)

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

  // 重複チェック：同じリードが確認待ちに既にある場合はスキップ
  const { data: existing } = await supabase
    .from('send_queue')
    .select('id')
    .eq('lead_id', item.lead_id)
    .eq('status', '確認待ち')
    .limit(1)
    .maybeSingle()

  if (existing) {
    return { data: null, error: 'このリードは既に確認待ちに追加されています' }
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
      subject: item.subject ?? null,
      send_method: sendMethod,
      scheduled_at: item.scheduled_at ?? null,
      status: '確認待ち',
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
// 送信済み → 確認待ちに戻す（誤判定のリセット用）
// ──────────────────────────────────────────
export async function resetToReview(
  ids: string[]
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証が必要です' }

  const { error } = await supabase
    .from('send_queue')
    .update({
      status: '確認待ち',
      error_message: null,
      sent_at: null,
      retry_count: 0,
    })
    .in('id', ids)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  // リードのステータスも「未着手」に戻す
  const { data: items } = await supabase
    .from('send_queue')
    .select('lead_id')
    .in('id', ids)
    .eq('user_id', user.id)
  if (items) {
    const leadIds = items.map(i => i.lead_id).filter(Boolean)
    if (leadIds.length > 0) {
      await supabase
        .from('leads')
        .update({ status: '未着手' })
        .in('id', leadIds)
        .eq('user_id', user.id)
    }
  }

  revalidatePath('/dashboard/sending')
  revalidatePath('/dashboard/leads')
  return { error: null }
}

// ──────────────────────────────────────────
// 送信方法を変更 (form ↔ manual ↔ email)
// ──────────────────────────────────────────
export async function changeSendMethod(
  ids: string[],
  method: 'form' | 'manual' | 'email'
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証が必要です' }

  const { error } = await supabase
    .from('send_queue')
    .update({ send_method: method, status: '確認待ち', error_message: null })
    .in('id', ids)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/sending')
  return { error: null }
}

// ──────────────────────────────────────────
// Retry a failed item (reset to 確認待ち)
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
      status: '送信承認済み',
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
// Mark item as requiring manual handling
// ──────────────────────────────────────────
export async function markAsManual(
  id: string,
  reason: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: '認証が必要です' }

  const { error } = await supabase
    .from('send_queue')
    .update({
      status: '手動対応',
      error_message: reason,
    })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/sending')
  return { error: null }
}

// ──────────────────────────────────────────
// フォーム未検出確定（form_not_found → 手動対応 or メール切替）
// ──────────────────────────────────────────
export async function confirmFormNotFound(
  id: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証が必要です' }

  const { error } = await supabase
    .from('send_queue')
    .update({
      status: '手動対応' as SendStatus,
      error_message: 'フォーム未検出確定 — 手動対応が必要',
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
      data: { total: 0, reviewing: 0, sent: 0, failed: 0, manual: 0, formNotFound: 0 },
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
    reviewing: rows.filter(r => r.status === '確認待ち').length,
    sent: rows.filter(r => r.status === '送信済み').length,
    failed: rows.filter(r => r.status === '失敗').length,
    manual: rows.filter(r => r.status === '手動対応').length,
    formNotFound: rows.filter(r => r.status === 'form_not_found').length,
  }

  return { data: stats, error: null }
}

// ──────────────────────────────────────────
// Screenshot Storage Cleanup
// ──────────────────────────────────────────
const SCREENSHOT_MAX = 10000
const SCREENSHOT_DELETE_COUNT = 5000

export async function cleanupScreenshotsIfNeeded(): Promise<{
  deleted: number
  error: string | null
}> {
  const supabase = await createClient()

  // Count files in screenshots bucket
  const { data: files, error: listError } = await supabase.storage
    .from('screenshots')
    .list('', { limit: 1, offset: SCREENSHOT_MAX })

  if (listError) return { deleted: 0, error: listError.message }

  // If no files beyond the limit, no cleanup needed
  if (!files || files.length === 0) return { deleted: 0, error: null }

  // Get oldest files to delete
  const { data: oldFiles, error: oldError } = await supabase.storage
    .from('screenshots')
    .list('', {
      limit: SCREENSHOT_DELETE_COUNT,
      sortBy: { column: 'created_at', order: 'asc' },
    })

  if (oldError || !oldFiles) return { deleted: 0, error: oldError?.message ?? 'Failed to list' }

  const filePaths = oldFiles.map((f) => f.name)
  if (filePaths.length === 0) return { deleted: 0, error: null }

  const { error: removeError } = await supabase.storage
    .from('screenshots')
    .remove(filePaths)

  if (removeError) return { deleted: 0, error: removeError.message }

  // Clear screenshot_url for deleted files
  for (const path of filePaths) {
    await supabase
      .from('send_queue')
      .update({ screenshot_url: null })
      .like('screenshot_url', `%${path}%`)
  }

  return { deleted: filePaths.length, error: null }
}
