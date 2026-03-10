import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { ids } = await req.json() as { ids: string[] }
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'IDが必要です' }, { status: 400 })
    }

    const supabase = await createClient()

    // 50件ずつチャンク分割で削除
    const CHUNK = 50
    for (let i = 0; i < ids.length; i += CHUNK) {
      const { error } = await supabase
        .from('leads')
        .delete()
        .in('id', ids.slice(i, i + CHUNK))
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, deleted: ids.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
