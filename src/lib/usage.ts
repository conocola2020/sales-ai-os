import { NextResponse } from 'next/server'
import { PLANS, PlanId } from './stripe'
import { SupabaseClient } from '@supabase/supabase-js'

/**
 * 利用量チェック: 指定メトリクスが現在のプランの制限内かどうかを返す
 */
export async function checkUsageLimit(
  supabase: SupabaseClient,
  orgId: string,
  plan: PlanId,
  metric: 'leads' | 'sends_per_month' | 'members'
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const limit = PLANS[plan]?.limits[metric] ?? 0
  let current = 0

  switch (metric) {
    case 'leads': {
      const { count } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
      current = count ?? 0
      break
    }
    case 'sends_per_month': {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const { count } = await supabase
        .from('send_queue')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('status', '送信済み')
        .gte('updated_at', startOfMonth)
      current = count ?? 0
      break
    }
    case 'members': {
      const { count } = await supabase
        .from('org_members')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
      current = count ?? 0
      break
    }
  }

  return {
    allowed: current < limit,
    current,
    limit: limit === Infinity ? -1 : limit, // Infinity は JSON にできないので -1 で表現
  }
}

/**
 * 利用量制限の強制チェック（APIルート用ミドルウェア的関数）
 * - null を返す場合: 制限内（処理続行OK）
 * - NextResponse を返す場合: 制限超過（そのままレスポンスとして返す）
 */
export async function enforceUsageLimit(
  supabase: SupabaseClient,
  orgId: string,
  plan: PlanId,
  metric: 'leads' | 'sends_per_month' | 'members'
): Promise<NextResponse | null> {
  const result = await checkUsageLimit(supabase, orgId, plan, metric)

  if (result.allowed) {
    return null
  }

  const metricLabels: Record<string, string> = {
    leads: 'リード数',
    sends_per_month: '今月の送信数',
    members: 'メンバー数',
  }

  return NextResponse.json(
    {
      error: 'usage_limit_exceeded',
      message: `${metricLabels[metric]}がプランの上限に達しました。プランをアップグレードしてください。`,
      current: result.current,
      limit: result.limit,
    },
    { status: 403 }
  )
}
