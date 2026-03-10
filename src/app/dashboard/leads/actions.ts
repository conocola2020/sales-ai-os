'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Lead, LeadInsert, LeadUpdate } from '@/types/leads'

// ──────────────────────────────────────────
// Fetch all leads for current user
// ──────────────────────────────────────────
export async function getLeads(): Promise<{ data: Lead[]; error: string | null }> {
  const supabase = await createClient()

  // Supabaseのデフォルト制限は1000件。全件取得するためページネーション
  const all: Lead[] = []
  const PAGE = 1000
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1)

    if (error) return { data: all, error: error.message }
    if (!data || data.length === 0) break
    all.push(...(data as Lead[]))
    if (data.length < PAGE) break
    from += PAGE
  }

  return { data: all, error: null }
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
