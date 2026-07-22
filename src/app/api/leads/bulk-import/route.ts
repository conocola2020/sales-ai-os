import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { splitByContactRule, LEAD_CONTACT_RULE_MESSAGE } from '@/lib/lead-rules'

export async function POST(req: NextRequest) {
  try {
    const { leads } = await req.json() as { leads: Record<string, string>[] }
    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ error: 'リードデータが必要です' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    // 登録条件: メール or 問い合わせフォームURL（満たさない行はスキップ）
    const { valid, skipped } = splitByContactRule(leads)
    if (valid.length === 0) {
      return NextResponse.json(
        { error: `全${leads.length}件が条件不足のため取り込みませんでした。${LEAD_CONTACT_RULE_MESSAGE}` },
        { status: 400 }
      )
    }

    const rows = valid.map((l) => ({ ...l, user_id: user.id }))

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

    return NextResponse.json({ success: true, count: inserted, skipped })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
