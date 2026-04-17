'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function createOrganization(name: string): Promise<{ orgId: string | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { orgId: null, error: '認証が必要です' }

  // Check if user already has an org
  const { data: existing } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (existing) return { orgId: existing.org_id, error: null }

  // Create organization
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9\u3000-\u9fff]+/g, '-')
    .replace(/^-|-$/g, '') || `org-${Date.now()}`

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({ name, slug })
    .select('id')
    .single()

  if (orgError) return { orgId: null, error: orgError.message }

  // Add user as owner member
  const { error: memberError } = await supabase
    .from('org_members')
    .insert({ org_id: org.id, user_id: user.id, role: 'owner' })

  if (memberError) return { orgId: null, error: memberError.message }

  return { orgId: org.id, error: null }
}

export async function saveProfile(settings: {
  representative: string
  company_email: string
  company_phone: string
  company_name: string
  org_id: string
}): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証が必要です' }

  const { error } = await supabase
    .from('user_settings')
    .upsert(
      {
        user_id: user.id,
        org_id: settings.org_id,
        representative: settings.representative,
        company_email: settings.company_email,
        company_phone: settings.company_phone,
        company_name: settings.company_name,
      },
      { onConflict: 'user_id' }
    )

  if (error) return { error: error.message }
  revalidatePath('/dashboard/settings')
  return { error: null }
}

export async function completeOnboarding(): Promise<void> {
  redirect('/dashboard')
}
