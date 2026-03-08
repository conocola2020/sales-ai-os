'use server'

import { revalidatePath } from 'next/cache'
import type { Message, MessageInsert } from '@/types/messages'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const isConfigured = supabaseUrl && supabaseUrl !== 'your-supabase-url'

async function getClient() {
  const { createClient } = await import('@/lib/supabase/server')
  return createClient()
}

export async function getMessages(leadId?: string): Promise<{ data: Message[]; error: string | null }> {
  if (!isConfigured) return { data: [], error: null }

  try {
    const supabase = await getClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: [], error: null }

    let query = supabase
      .from('messages')
      .select('*, lead:leads(company_name, contact_name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (leadId) {
      query = query.eq('lead_id', leadId)
    }

    const { data, error } = await query
    if (error) throw error
    return { data: data ?? [], error: null }
  } catch (e) {
    console.error('getMessages error:', e)
    return { data: [], error: String(e) }
  }
}

export async function saveMessage(payload: MessageInsert): Promise<{ data: Message | null; error: string | null }> {
  if (!isConfigured) return { data: null, error: 'Supabase未設定' }

  try {
    const supabase = await getClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: '認証エラー' }

    const { data, error } = await supabase
      .from('messages')
      .insert({ ...payload, user_id: user.id })
      .select('*, lead:leads(company_name, contact_name)')
      .single()

    if (error) throw error
    revalidatePath('/dashboard/compose')
    return { data, error: null }
  } catch (e) {
    console.error('saveMessage error:', e)
    return { data: null, error: String(e) }
  }
}

export async function deleteMessage(id: string): Promise<{ error: string | null }> {
  if (!isConfigured) return { error: 'Supabase未設定' }

  try {
    const supabase = await getClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: '認証エラー' }

    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/dashboard/compose')
    return { error: null }
  } catch (e) {
    console.error('deleteMessage error:', e)
    return { error: String(e) }
  }
}
