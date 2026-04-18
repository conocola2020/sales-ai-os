'use server'

import { revalidatePath } from 'next/cache'
import { getAuthenticatedUser } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Organization {
  id: string
  name: string
  slug: string
  plan: string
  created_at: string
}

export interface Member {
  id: string
  user_id: string
  email: string
  role: string
  created_at: string
}

export interface Invitation {
  id: string
  email: string
  role: string
  created_at: string
  expires_at: string
  accepted_at: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isAdmin(role: string | null): boolean {
  return role === 'owner' || role === 'admin'
}

// ---------------------------------------------------------------------------
// Organization CRUD
// ---------------------------------------------------------------------------

export async function getOrganization(): Promise<{ data: Organization | null; error: string | null }> {
  try {
    const { supabase, user, orgId } = await getAuthenticatedUser()
    if (!user || !orgId) return { data: null, error: null }

    const { data, error } = await supabase
      .from('organizations')
      .select('id, name, slug, plan, created_at')
      .eq('id', orgId)
      .single()

    if (error) throw error
    return { data: data as Organization, error: null }
  } catch (e) {
    console.error('getOrganization error:', e)
    return { data: null, error: String(e) }
  }
}

export async function updateOrganization(payload: { name: string }): Promise<{ error: string | null }> {
  try {
    const { supabase, user, orgId, role } = await getAuthenticatedUser()
    if (!user || !orgId) return { error: '認証エラー' }
    if (!isAdmin(role)) return { error: '権限がありません' }

    const { error } = await supabase
      .from('organizations')
      .update({ name: payload.name })
      .eq('id', orgId)

    if (error) throw error
    revalidatePath('/dashboard/settings')
    return { error: null }
  } catch (e) {
    console.error('updateOrganization error:', e)
    return { error: String(e) }
  }
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export async function getMembers(): Promise<{ data: Member[]; error: string | null }> {
  try {
    const { supabase, user, orgId } = await getAuthenticatedUser()
    if (!user || !orgId) return { data: [], error: null }

    const { data, error } = await supabase
      .from('org_members')
      .select('id, user_id, role, created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true })

    if (error) throw error

    // Fetch emails for each member via auth admin or profiles
    // Since we can't use admin API from client, we'll get emails from auth.users
    // through a join or separate query. Using a workaround with profiles or direct query.
    const members: Member[] = []
    for (const m of data ?? []) {
      // Try to get email from user metadata
      let email = ''
      if (m.user_id === user.id) {
        email = user.email ?? ''
      } else {
        // Query profiles or auth - since RLS may block, we use a profiles table if exists
        // Fallback: store email in org_members or use a view
        const { data: profile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', m.user_id)
          .maybeSingle()
        email = profile?.email ?? '(不明)'
      }
      members.push({
        id: m.id,
        user_id: m.user_id,
        email,
        role: m.role,
        created_at: m.created_at,
      })
    }

    return { data: members, error: null }
  } catch (e) {
    console.error('getMembers error:', e)
    return { data: [], error: String(e) }
  }
}

export async function updateMemberRole(
  memberId: string,
  role: string
): Promise<{ error: string | null }> {
  try {
    const { supabase, user, orgId, role: myRole } = await getAuthenticatedUser()
    if (!user || !orgId) return { error: '認証エラー' }
    if (!isAdmin(myRole)) return { error: '権限がありません' }

    // Get the target member
    const { data: target, error: fetchErr } = await supabase
      .from('org_members')
      .select('id, user_id, role')
      .eq('id', memberId)
      .eq('org_id', orgId)
      .single()

    if (fetchErr || !target) return { error: 'メンバーが見つかりません' }
    if (target.role === 'owner') return { error: 'オーナーのロールは変更できません' }

    const { error } = await supabase
      .from('org_members')
      .update({ role })
      .eq('id', memberId)
      .eq('org_id', orgId)

    if (error) throw error
    revalidatePath('/dashboard/settings')
    return { error: null }
  } catch (e) {
    console.error('updateMemberRole error:', e)
    return { error: String(e) }
  }
}

export async function removeMember(memberId: string): Promise<{ error: string | null }> {
  try {
    const { supabase, user, orgId, role: myRole } = await getAuthenticatedUser()
    if (!user || !orgId) return { error: '認証エラー' }
    if (!isAdmin(myRole)) return { error: '権限がありません' }

    // Get the target member
    const { data: target, error: fetchErr } = await supabase
      .from('org_members')
      .select('id, user_id, role')
      .eq('id', memberId)
      .eq('org_id', orgId)
      .single()

    if (fetchErr || !target) return { error: 'メンバーが見つかりません' }
    if (target.role === 'owner') return { error: 'オーナーは削除できません' }
    if (target.user_id === user.id) return { error: '自分自身は削除できません' }

    const { error } = await supabase
      .from('org_members')
      .delete()
      .eq('id', memberId)
      .eq('org_id', orgId)

    if (error) throw error
    revalidatePath('/dashboard/settings')
    return { error: null }
  } catch (e) {
    console.error('removeMember error:', e)
    return { error: String(e) }
  }
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

export async function inviteMember(
  email: string,
  role: string
): Promise<{ error: string | null }> {
  try {
    const { supabase, user, orgId, role: myRole } = await getAuthenticatedUser()
    if (!user || !orgId) return { error: '認証エラー' }
    if (!isAdmin(myRole)) return { error: '権限がありません' }

    // Check for existing pending invitation
    const { data: existing } = await supabase
      .from('org_invitations')
      .select('id')
      .eq('org_id', orgId)
      .eq('email', email)
      .is('accepted_at', null)
      .gte('expires_at', new Date().toISOString())
      .maybeSingle()

    if (existing) return { error: 'このメールアドレスには既に有効な招待があります' }

    const token = crypto.randomUUID()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const { error } = await supabase
      .from('org_invitations')
      .insert({
        org_id: orgId,
        email,
        role,
        token,
        invited_by: user.id,
        expires_at: expiresAt.toISOString(),
      })

    if (error) throw error

    // Log invite URL (email sending to be implemented with Resend later)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    console.log(`[Invitation] URL: ${baseUrl}/auth/signup?token=${token}`)

    revalidatePath('/dashboard/settings')
    return { error: null }
  } catch (e) {
    console.error('inviteMember error:', e)
    return { error: String(e) }
  }
}

export async function getInvitations(): Promise<{ data: Invitation[]; error: string | null }> {
  try {
    const { supabase, user, orgId } = await getAuthenticatedUser()
    if (!user || !orgId) return { data: [], error: null }

    const { data, error } = await supabase
      .from('org_invitations')
      .select('id, email, role, created_at, expires_at, accepted_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return { data: (data ?? []) as Invitation[], error: null }
  } catch (e) {
    console.error('getInvitations error:', e)
    return { data: [], error: String(e) }
  }
}

export async function cancelInvitation(invitationId: string): Promise<{ error: string | null }> {
  try {
    const { supabase, user, orgId, role: myRole } = await getAuthenticatedUser()
    if (!user || !orgId) return { error: '認証エラー' }
    if (!isAdmin(myRole)) return { error: '権限がありません' }

    const { error } = await supabase
      .from('org_invitations')
      .delete()
      .eq('id', invitationId)
      .eq('org_id', orgId)

    if (error) throw error
    revalidatePath('/dashboard/settings')
    return { error: null }
  } catch (e) {
    console.error('cancelInvitation error:', e)
    return { error: String(e) }
  }
}
