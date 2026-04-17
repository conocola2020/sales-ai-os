import { getAuthenticatedUser } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { leads } = await req.json() as { leads: Record<string, string>[] }
    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ error: 'リードデータが必要です' }, { status: 400 })
    }

    const { supabase, user, orgId } = await getAuthenticatedUser()
    if (!user || !orgId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const rows = leads.map((l) => ({ ...l, user_id: user.id, org_id: orgId }))

    // 200件ずつチャンク分割でインサート
    const CHUNK = 200
    let inserted = 0
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error } = await supabase.from('leads').insert(rows.slice(i, i + CHUNK))
      if (error) {
        return NextResponse.json({ error: error.message, inserted }, { status: 500 })
      }
      inserted += Math.min(CHUNK, rows.length - i)
    }

    return NextResponse.json({ success: true, count: inserted })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
