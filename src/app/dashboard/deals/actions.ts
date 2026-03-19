'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Deal, DealInsert, DealUpdate, DealStats } from '@/types/deals'
import { ACTIVE_STAGES } from '@/types/deals'

// ──────────────────────────────────────────
// Fetch all deals for current user
// ──────────────────────────────────────────
export async function getDeals(): Promise<{
  data: Deal[] | null
  error: string | null
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { data: [], error: null }

  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error('getDeals error:', error)
    return { data: null, error: error.message }
  }

  return { data: data as Deal[], error: null }
}

// ──────────────────────────────────────────
// Create a new deal
// ──────────────────────────────────────────
export async function createDeal(
  item: DealInsert
): Promise<{ data: Deal | null; error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { data: null, error: '認証が必要です' }

  const { data, error } = await supabase
    .from('deals')
    .insert({
      user_id: user.id,
      lead_id: item.lead_id ?? null,
      company_name: item.company_name,
      contact_name: item.contact_name ?? null,
      stage: item.stage ?? '初回接触',
      amount: item.amount ?? null,
      probability: item.probability ?? null,
      next_action: item.next_action ?? null,
      next_action_date: item.next_action_date ?? null,
      meeting_date: item.meeting_date ?? null,
      meeting_url: item.meeting_url ?? null,
      notes: item.notes ?? null,
    })
    .select('*')
    .single()

  if (error) {
    console.error('createDeal error:', error)
    return { data: null, error: error.message }
  }

  revalidatePath('/dashboard/deals')
  return { data: data as Deal, error: null }
}

// ──────────────────────────────────────────
// Update a deal
// ──────────────────────────────────────────
export async function updateDeal(
  id: string,
  changes: DealUpdate
): Promise<{ data: Deal | null; error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { data: null, error: '認証が必要です' }

  const { data, error } = await supabase
    .from('deals')
    .update(changes)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*')
    .single()

  if (error) {
    console.error('updateDeal error:', error)
    return { data: null, error: error.message }
  }

  revalidatePath('/dashboard/deals')
  return { data: data as Deal, error: null }
}

// ──────────────────────────────────────────
// Delete a deal
// ──────────────────────────────────────────
export async function deleteDeal(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: '認証が必要です' }

  const { error } = await supabase
    .from('deals')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/deals')
  return { error: null }
}

// ──────────────────────────────────────────
// Create deal from reply (auto-link lead + update status)
// ──────────────────────────────────────────
export async function createDealFromReply(
  leadId: string,
  companyName: string,
  contactName?: string | null,
  replyContent?: string | null,
): Promise<{ data: Deal | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: '認証が必要です' }

  // Check if deal already exists for this lead
  const { data: existing } = await supabase
    .from('deals')
    .select('id')
    .eq('user_id', user.id)
    .eq('lead_id', leadId)
    .limit(1)
    .maybeSingle()

  if (existing) {
    return { data: null, error: 'この企業の商談は既に存在します' }
  }

  // Create deal
  const { data, error } = await supabase
    .from('deals')
    .insert({
      user_id: user.id,
      lead_id: leadId,
      company_name: companyName,
      contact_name: contactName ?? null,
      stage: 'ヒアリング',
      probability: 20,
      next_action: '初回ミーティング日程調整',
      meeting_url: 'https://timerex.net/s/daichi_3022_c34c/a78a4d68',
      notes: replyContent ? `【返信内容】\n${replyContent.slice(0, 500)}` : null,
      activity_log: JSON.stringify([{
        date: new Date().toISOString(),
        type: 'stage_change',
        description: '返信から商談を自動作成',
        from: '未着手',
        to: 'ヒアリング',
      }]),
    })
    .select('*')
    .single()

  if (error) {
    console.error('createDealFromReply error:', error)
    return { data: null, error: error.message }
  }

  // Update lead status to 商談中
  await supabase
    .from('leads')
    .update({ status: '商談中' })
    .eq('id', leadId)
    .eq('user_id', user.id)

  revalidatePath('/dashboard/deals')
  revalidatePath('/dashboard/leads')
  revalidatePath('/dashboard/replies')
  return { data: data as Deal, error: null }
}

// ──────────────────────────────────────────
// Get deal statistics
// ──────────────────────────────────────────
export async function getDealStats(): Promise<{
  data: DealStats | null
  error: string | null
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      data: {
        total: 0,
        active: 0,
        won: 0,
        lost: 0,
        pipelineAmount: 0,
        weightedAmount: 0,
        winRate: null,
      },
      error: null,
    }
  }

  const { data, error } = await supabase
    .from('deals')
    .select('stage, amount, probability')
    .eq('user_id', user.id)

  if (error) {
    console.error('getDealStats error:', error)
    return { data: null, error: error.message }
  }

  const rows = data as { stage: string; amount: number | null; probability: number | null }[]

  const active = rows.filter(r => ACTIVE_STAGES.includes(r.stage as never)).length
  const won = rows.filter(r => r.stage === '成約').length
  const lost = rows.filter(r => r.stage === '失注').length
  const pipelineAmount = rows
    .filter(r => ACTIVE_STAGES.includes(r.stage as never))
    .reduce((sum, r) => sum + (r.amount ?? 0), 0)
  const weightedAmount = rows
    .filter(r => ACTIVE_STAGES.includes(r.stage as never))
    .reduce((sum, r) => sum + (r.amount ?? 0) * ((r.probability ?? 0) / 100), 0)
  const closedCount = won + lost
  const winRate = closedCount > 0 ? Math.round((won / closedCount) * 100) : null

  return {
    data: {
      total: rows.length,
      active,
      won,
      lost,
      pipelineAmount,
      weightedAmount,
      winRate,
    },
    error: null,
  }
}
