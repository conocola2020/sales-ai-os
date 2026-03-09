import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { type, format } = await req.json() as {
      type: 'leads' | 'deals' | 'instagram' | 'replies' | 'send_queue'
      format: 'csv' | 'json'
    }

    if (!type) {
      return NextResponse.json({ error: 'typeは必須です' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

    // Demo data for when Supabase is not configured
    if (!supabaseUrl || supabaseUrl === 'your-supabase-url') {
      const demoData = getDemoData(type)
      if (format === 'csv') {
        const csv = jsonToCsv(demoData)
        return new Response(csv, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${type}_export_${new Date().toISOString().slice(0, 10)}.csv"`,
          },
        })
      }
      return NextResponse.json({ data: demoData })
    }

    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const tableMap: Record<string, string> = {
      leads: 'leads',
      deals: 'deals',
      instagram: 'instagram_targets',
      replies: 'replies',
      send_queue: 'send_queue',
    }

    const { data, error } = await supabase
      .from(tableMap[type])
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (format === 'csv') {
      const csv = jsonToCsv(data || [])
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${type}_export_${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('Export error:', err)
    return NextResponse.json({ error: 'エクスポートに失敗しました' }, { status: 500 })
  }
}

function jsonToCsv(data: Record<string, unknown>[]): string {
  if (data.length === 0) return ''
  const headers = Object.keys(data[0])
  const rows = data.map(row =>
    headers.map(h => {
      const val = row[h]
      if (val === null || val === undefined) return ''
      const str = typeof val === 'object' ? JSON.stringify(val) : String(val)
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str
    }).join(',')
  )
  return [headers.join(','), ...rows].join('\n')
}

function getDemoData(type: string): Record<string, unknown>[] {
  const now = new Date().toISOString()
  if (type === 'leads') {
    return [
      { company_name: 'サンプル株式会社', contact_name: '田中太郎', email: 'tanaka@sample.co.jp', industry: 'IT・ソフトウェア', status: '未着手', created_at: now },
      { company_name: 'テスト合同会社', contact_name: '鈴木花子', email: 'suzuki@test.co.jp', industry: 'SaaS・クラウド', status: '送信済み', created_at: now },
    ]
  }
  if (type === 'deals') {
    return [
      { company_name: 'サンプル株式会社', stage: '提案', amount: 500000, probability: 60, created_at: now },
    ]
  }
  return [{ message: 'デモデータ', created_at: now }]
}
