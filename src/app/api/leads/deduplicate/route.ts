import { getAuthenticatedUser } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const { supabase, user, orgId } = await getAuthenticatedUser()
    if (!user || !orgId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    // 全件取得（ページネーション・組織スコープ）
    const all: { id: string; company_name: string; created_at: string }[] = []
    const PAGE = 1000
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('leads')
        .select('id, company_name, created_at')
        .eq('org_id', orgId)
        .order('created_at', { ascending: true })
        .range(from, from + PAGE - 1)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      if (!data || data.length === 0) break
      all.push(...data)
      if (data.length < PAGE) break
      from += PAGE
    }

    // company_name でグループ化し、最初の1件だけ残す
    const seen = new Map<string, string>() // company_name -> 残すID
    const toDelete: string[] = []

    for (const row of all) {
      if (!seen.has(row.company_name)) {
        seen.set(row.company_name, row.id)
      } else {
        toDelete.push(row.id)
      }
    }

    // チャンク分割で削除
    const CHUNK = 100
    let deleted = 0
    for (let i = 0; i < toDelete.length; i += CHUNK) {
      const { error } = await supabase
        .from('leads')
        .delete()
        .in('id', toDelete.slice(i, i + CHUNK))
      if (error) {
        return NextResponse.json({
          error: error.message,
          deleted,
          remaining: toDelete.length - deleted,
        }, { status: 500 })
      }
      deleted += Math.min(CHUNK, toDelete.length - i)
    }

    return NextResponse.json({
      success: true,
      total: all.length,
      unique: seen.size,
      deleted,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
