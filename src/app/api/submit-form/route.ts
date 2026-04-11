import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/submit-form
 *
 * レガシーAPI（後方互換のため残置）。
 * 新規のフォーム送信は /api/agent-send を使用すること。
 * このAPIはステータスを「送信承認済み」に変更するのみ。
 */
export async function POST(req: NextRequest) {
  try {
    const { queueItemId } = await req.json() as { queueItemId: string }

    if (!queueItemId) {
      return NextResponse.json(
        { error: 'queueItemId は必須です' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    // キューアイテムを取得して確認
    const { data: item, error: fetchError } = await supabase
      .from('send_queue')
      .select(`
        id, send_method, status, form_url,
        lead:lead_id (company_name, website_url, company_url)
      `)
      .eq('id', queueItemId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !item) {
      return NextResponse.json(
        { error: 'キューアイテムが見つかりません' },
        { status: 404 }
      )
    }

    if (item.send_method !== 'form') {
      return NextResponse.json(
        { error: 'このアイテムはフォーム送信ではありません' },
        { status: 400 }
      )
    }

    // ユーザーが送信を承認 → 送信承認済みに変更してワーカーにトリガー
    // （確認待ち = レビュー中、送信承認済み = ワーカーが処理する）
    const { error: updateError } = await supabase
      .from('send_queue')
      .update({ status: '送信承認済み', updated_at: new Date().toISOString(), retry_count: 0 })
      .eq('id', queueItemId)
      .eq('user_id', user.id)

    if (updateError) {
      return NextResponse.json(
        { error: `更新エラー: ${updateError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'フォーム送信キューに追加しました。ワーカーが自動処理します。',
      item: {
        id: item.id,
        company_name: (item.lead as unknown as { company_name: string })?.company_name,
        website_url: (item.lead as unknown as { website_url: string })?.website_url,
      },
    })
  } catch (err) {
    console.error('Submit form error:', err)
    return NextResponse.json(
      { error: 'フォーム送信の処理に失敗しました' },
      { status: 500 }
    )
  }
}
