'use server'

import { revalidatePath } from 'next/cache'
import { getAuthenticatedUser } from '@/lib/supabase/server'
import type { UserSettings, UserSettingsInsert, MessageTemplate, MessageTemplateInsert } from '@/types/settings'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const isConfigured = supabaseUrl && supabaseUrl !== 'your-supabase-url'

async function getClient() {
  const { createClient } = await import('@/lib/supabase/server')
  return createClient()
}

// ---------------------------------------------------------------------------
// UserSettings
// ---------------------------------------------------------------------------

export async function getSettings(): Promise<{ data: UserSettings | null; error: string | null }> {
  if (!isConfigured) return { data: null, error: null }

  try {
    const { supabase, user, orgId } = await getAuthenticatedUser()
    if (!user) return { data: null, error: null }

    let query = supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
    if (orgId) query = query.eq('org_id', orgId)

    const { data, error } = await query.maybeSingle()

    if (error) throw error
    return { data: data as UserSettings | null, error: null }
  } catch (e) {
    console.error('getSettings error:', e)
    return { data: null, error: String(e) }
  }
}

export async function upsertSettings(
  payload: UserSettingsInsert
): Promise<{ data: UserSettings | null; error: string | null }> {
  if (!isConfigured) return { data: null, error: 'Supabase未設定' }

  try {
    const { supabase, user, orgId } = await getAuthenticatedUser()
    if (!user) return { data: null, error: '認証エラー' }

    const { data, error } = await supabase
      .from('user_settings')
      .upsert(
        {
          user_id: user.id,
          ...(orgId ? { org_id: orgId } : {}),
          ...payload,
        },
        { onConflict: 'user_id' }
      )
      .select('*')
      .single()

    if (error) throw error
    revalidatePath('/dashboard/settings')
    return { data: data as UserSettings, error: null }
  } catch (e) {
    console.error('upsertSettings error:', e)
    return { data: null, error: String(e) }
  }
}

// ---------------------------------------------------------------------------
// MessageTemplates
// ---------------------------------------------------------------------------

export async function getTemplates(): Promise<{ data: MessageTemplate[]; error: string | null }> {
  if (!isConfigured) return { data: [], error: null }

  try {
    const { supabase, user, orgId } = await getAuthenticatedUser()
    if (!user) return { data: [], error: null }

    let query = supabase
      .from('message_templates')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })
    if (orgId) query = query.eq('org_id', orgId)

    const { data, error } = await query

    if (error) throw error
    return { data: (data ?? []) as MessageTemplate[], error: null }
  } catch (e) {
    console.error('getTemplates error:', e)
    return { data: [], error: String(e) }
  }
}

export async function createTemplate(
  payload: MessageTemplateInsert
): Promise<{ data: MessageTemplate | null; error: string | null }> {
  if (!isConfigured) return { data: null, error: 'Supabase未設定' }

  try {
    const { supabase, user, orgId } = await getAuthenticatedUser()
    if (!user) return { data: null, error: '認証エラー' }

    const { data, error } = await supabase
      .from('message_templates')
      .insert({ ...payload, user_id: user.id, ...(orgId ? { org_id: orgId } : {}) })
      .select('*')
      .single()

    if (error) throw error
    revalidatePath('/dashboard/settings')
    return { data: data as MessageTemplate, error: null }
  } catch (e) {
    console.error('createTemplate error:', e)
    return { data: null, error: String(e) }
  }
}

export async function seedDefaultTemplates(): Promise<{ error: string | null }> {
  if (!isConfigured) return { error: 'Supabase未設定' }

  try {
    const { supabase, user, orgId } = await getAuthenticatedUser()
    if (!user) return { error: '認証エラー' }

    // Check if already seeded
    const { count } = await supabase
      .from('message_templates')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
    if (count && count > 0) return { error: null }

    const { DEFAULT_TEMPLATES } = await import('@/types/settings')
    const rows = DEFAULT_TEMPLATES.map((t, i) => ({
      ...t,
      user_id: user.id,
      ...(orgId ? { org_id: orgId } : {}),
      sort_order: i,
    }))

    const { error } = await supabase.from('message_templates').insert(rows)
    if (error) throw error
    revalidatePath('/dashboard/settings')
    return { error: null }
  } catch (e) {
    console.error('seedDefaultTemplates error:', e)
    return { error: String(e) }
  }
}
