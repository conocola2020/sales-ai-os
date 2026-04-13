'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Lead, LeadInsert, LeadUpdate } from '@/types/leads'

// ──────────────────────────────────────────
// Fetch all leads for current user
// ──────────────────────────────────────────
export async function getLeads(): Promise<{ data: Lead[]; error: string | null }> {
  const supabase = await createClient()

  const PAGE = 1000

  // まず総件数を取得（HEADリクエスト・高速）
  const { count, error: countError } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })

  if (countError) return { data: [], error: countError.message }
  if (!count) return { data: [], error: null }

  // 全ページを並列取得
  const pageCount = Math.ceil(count / PAGE)
  const results = await Promise.all(
    Array.from({ length: pageCount }, (_, i) =>
      supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .range(i * PAGE, (i + 1) * PAGE - 1)
    )
  )

  const all: Lead[] = []
  for (const result of results) {
    if (result.error) return { data: all, error: result.error.message }
    all.push(...(result.data as Lead[]))
  }

  return { data: all, error: null }
}

// ──────────────────────────────────────────
// 送信キューのステータスをリードIDでマッピング
// 失敗 > 確認待ち の優先順位で返す
// ──────────────────────────────────────────
export async function getLeadQueueStatuses(): Promise<Record<string, string>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}

  const { data } = await supabase
    .from('send_queue')
    .select('lead_id, status')
    .eq('user_id', user.id)
    .neq('status', '送信済み') // 送信済みは表示不要

  if (!data) return {}

  const map: Record<string, string> = {}
  for (const item of data) {
    if (!item.lead_id) continue
    const prev = map[item.lead_id]
    // 失敗・form_not_found が最優先、次に確認待ち
    if (!prev || item.status === '失敗' || item.status === 'form_not_found') {
      map[item.lead_id] = item.status
    }
  }
  return map
}

// ──────────────────────────────────────────
// 軽量版：ドロップダウン用（id・社名・担当者名のみ）
// ──────────────────────────────────────────
export async function getLeadOptions(): Promise<{
  data: Pick<Lead, 'id' | 'company_name' | 'contact_name' | 'status' | 'industry' | 'notes' | 'website_url' | 'company_url' | 'email' | 'contact_method'>[]
  error: string | null
}> {
  const supabase = await createClient()
  const FIELDS = 'id, company_name, contact_name, status, industry, notes, website_url, company_url, email, contact_method'
  const PAGE = 1000

  // まず総件数を取得
  const { count, error: countError } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })

  if (countError) return { data: [], error: countError.message }
  if (!count) return { data: [], error: null }

  // 全ページを並列取得
  const pageCount = Math.ceil(count / PAGE)
  const results = await Promise.all(
    Array.from({ length: pageCount }, (_, i) =>
      supabase
        .from('leads')
        .select(FIELDS)
        .order('created_at', { ascending: false })
        .range(i * PAGE, (i + 1) * PAGE - 1)
    )
  )

  const all: Pick<Lead, 'id' | 'company_name' | 'contact_name' | 'status' | 'industry' | 'notes' | 'website_url' | 'company_url' | 'email' | 'contact_method'>[] = []
  for (const result of results) {
    if (result.error) return { data: all, error: result.error.message }
    all.push(...(result.data as typeof all))
  }

  return { data: all, error: null }
}

// ──────────────────────────────────────────
// Lightweight lead summary (for dashboard)
// ──────────────────────────────────────────
export async function getLeadSummary(): Promise<{
  data: { total: number; untouched: number } | null
  error: string | null
}> {
  const supabase = await createClient()

  const [totalRes, untouchedRes] = await Promise.all([
    supabase.from('leads').select('id', { count: 'exact', head: true }),
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', '未着手'),
  ])

  if (totalRes.error) return { data: null, error: totalRes.error.message }

  return {
    data: {
      total: totalRes.count ?? 0,
      untouched: untouchedRes.count ?? 0,
    },
    error: null,
  }
}

// ──────────────────────────────────────────
// Create a single lead
// ──────────────────────────────────────────
export async function createLead(
  lead: LeadInsert
): Promise<{ data: Lead | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: '認証が必要です' }

  const { data, error } = await supabase
    .from('leads')
    .insert({ ...lead, user_id: user.id })
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  revalidatePath('/dashboard/leads')
  return { data: data as Lead, error: null }
}

// ──────────────────────────────────────────
// Bulk insert (CSV import)
// ──────────────────────────────────────────
export async function bulkCreateLeads(
  leads: LeadInsert[]
): Promise<{ count: number; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { count: 0, error: '認証が必要です' }

  const rows = leads.map((l) => ({ ...l, user_id: user.id }))

  const CHUNK = 500
  let inserted = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase.from('leads').insert(rows.slice(i, i + CHUNK))
    if (error) return { count: inserted, error: error.message }
    inserted += Math.min(CHUNK, rows.length - i)
  }

  revalidatePath('/dashboard/leads')
  return { count: inserted, error: null }
}

// ──────────────────────────────────────────
// Update a lead
// ──────────────────────────────────────────
export async function updateLead(
  id: string,
  updates: LeadUpdate
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('leads')
    .update(updates)
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/leads')
  return { error: null }
}

// ──────────────────────────────────────────
// Update status only (quick action)
// ──────────────────────────────────────────
export async function updateLeadStatus(
  id: string,
  status: string
): Promise<{ error: string | null }> {
  return updateLead(id, { status: status as Lead['status'] })
}

// ──────────────────────────────────────────
// Delete lead(s)
// ──────────────────────────────────────────
export async function deleteLead(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { error } = await supabase.from('leads').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/leads')
  return { error: null }
}

export async function deleteLeads(ids: string[]): Promise<{ error: string | null }> {
  const supabase = await createClient()

  // チャンク分割で大量削除に対応
  const CHUNK = 100
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { error } = await supabase.from('leads').delete().in('id', ids.slice(i, i + CHUNK))
    if (error) return { error: error.message }
  }

  revalidatePath('/dashboard/leads')
  return { error: null }
}
