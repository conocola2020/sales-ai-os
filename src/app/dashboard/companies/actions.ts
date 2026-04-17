'use server'

import { createClient, getAuthenticatedUser } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { CompanyAnalysis, AnalysisResult } from '@/types/analyses'

export async function getAnalyses(): Promise<{ data: CompanyAnalysis[] | null; error: string | null }> {
  const { supabase, user, orgId } = await getAuthenticatedUser()

  if (!user) {
    return { data: [], error: null }
  }

  let query = supabase
    .from('company_analyses')
    .select(
      `
      *,
      lead:lead_id (
        company_name,
        contact_name
      )
    `
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(30)
  if (orgId) query = query.eq('org_id', orgId)

  const { data, error } = await query

  if (error) {
    console.error('getAnalyses error:', error)
    return { data: null, error: error.message }
  }

  return { data: data as CompanyAnalysis[], error: null }
}

export async function saveAnalysis(
  analysisResult: AnalysisResult,
  url: string,
  leadId?: string | null
): Promise<{ data: CompanyAnalysis | null; error: string | null }> {
  const { supabase, user, orgId } = await getAuthenticatedUser()

  if (!user) {
    return { data: null, error: '認証が必要です' }
  }

  const insertData = {
    user_id: user.id,
    ...(orgId ? { org_id: orgId } : {}),
    lead_id: leadId ?? null,
    url,
    company_name: analysisResult.company_name,
    industry: analysisResult.industry,
    scale: analysisResult.scale,
    business_summary: analysisResult.business_summary,
    challenges: analysisResult.challenges,
    proposal_points: analysisResult.proposal_points,
    keywords: analysisResult.keywords,
    raw_analysis: analysisResult as unknown as Record<string, unknown>,
  }

  const { data, error } = await supabase
    .from('company_analyses')
    .insert(insertData)
    .select(
      `
      *,
      lead:lead_id (
        company_name,
        contact_name
      )
    `
    )
    .single()

  if (error) {
    console.error('saveAnalysis error:', error)
    return { data: null, error: error.message }
  }

  revalidatePath('/dashboard/companies')
  return { data: data as CompanyAnalysis, error: null }
}

export async function updateAnalysisLead(
  analysisId: string,
  leadId: string | null
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: '認証が必要です' }
  }

  const { error } = await supabase
    .from('company_analyses')
    .update({ lead_id: leadId })
    .eq('id', analysisId)
    .eq('user_id', user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/companies')
  return { error: null }
}

export async function deleteAnalysis(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: '認証が必要です' }
  }

  const { error } = await supabase
    .from('company_analyses')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/companies')
  return { error: null }
}
