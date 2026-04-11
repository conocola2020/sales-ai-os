import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  runFormSubmission,
  type FormSubmissionRequest,
} from '@/lib/anthropic/managed-agent'

/**
 * POST /api/agent-send
 *
 * Claude Managed Agent を使ったフォーム自動送信API。
 * クラウドサンドボックス内で Agent がフォームを探索・送信し、
 * 結果を Supabase に反映する。
 */

// Vercel Function の最大実行時間（秒）
export const maxDuration = 120

interface UserSettings {
  company_name: string
  representative: string
  company_email: string
  company_phone: string
}

export async function POST(req: NextRequest) {
  try {
    const { queueItemId } = (await req.json()) as { queueItemId: string }

    if (!queueItemId) {
      return NextResponse.json(
        { error: 'queueItemId は必須です' },
        { status: 400 }
      )
    }

    // デモモード判定
    const apiKey = process.env.ANTHROPIC_API_KEY
    const isDemo = !apiKey || apiKey === 'your-anthropic-api-key-here'

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    // キューアイテム + リード情報を取得
    const { data: item, error: fetchError } = await supabase
      .from('send_queue')
      .select(
        `
        id, message_content, subject, send_method, form_url, status,
        lead:lead_id (
          id, company_name, website_url, company_url, contact_url, contact_name
        )
      `
      )
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

    const lead = item.lead as unknown as {
      id: string
      company_name: string
      website_url: string | null
      company_url: string | null
      contact_url: string | null
    }

    const companyUrl = lead.company_url || lead.website_url
    if (!companyUrl) {
      return NextResponse.json(
        { error: '企業URLが設定されていません' },
        { status: 400 }
      )
    }

    // ユーザー設定（送信者プロフィール）を取得
    const { data: settings } = await supabase
      .from('user_settings')
      .select('company_name, representative, company_email, company_phone')
      .eq('user_id', user.id)
      .single()

    const userSettings = settings as UserSettings | null

    if (
      !userSettings?.representative ||
      !userSettings?.company_email
    ) {
      return NextResponse.json(
        {
          error:
            '送信者情報が未設定です。設定ページで氏名・メールアドレスを入力してください。',
        },
        { status: 400 }
      )
    }

    // ステータスを「送信中」に更新
    await supabase
      .from('send_queue')
      .update({
        status: '送信承認済み',
        updated_at: new Date().toISOString(),
      })
      .eq('id', queueItemId)
      .eq('user_id', user.id)

    // デモモードの場合はシミュレーション
    if (isDemo) {
      await supabase
        .from('send_queue')
        .update({
          status: '送信済み',
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', queueItemId)
        .eq('user_id', user.id)

      return NextResponse.json({
        success: true,
        demo: true,
        message: '[デモ] フォーム送信をシミュレーションしました',
        result: { result: 'success', message: 'デモモード' },
      })
    }

    // Managed Agent でフォーム送信を実行
    const submissionReq: FormSubmissionRequest = {
      companyUrl,
      contactUrl: lead.contact_url || undefined,
      messageContent: item.message_content,
      senderCompany: userSettings.company_name,
      senderName: userSettings.representative,
      senderEmail: userSettings.company_email,
      senderPhone: userSettings.company_phone || '',
      subject: item.subject || undefined,
    }

    const result = await runFormSubmission(submissionReq)

    // 結果に応じてステータス更新
    if (result.result === 'success') {
      await supabase
        .from('send_queue')
        .update({
          status: '送信済み',
          sent_at: new Date().toISOString(),
          screenshot_url: `agent_result:${JSON.stringify(result)}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', queueItemId)
        .eq('user_id', user.id)

      // leads テーブルのステータスも更新
      await supabase
        .from('leads')
        .update({
          status: '送信済み',
          updated_at: new Date().toISOString(),
        })
        .eq('id', lead.id)

      // contact_url を保存（新たに発見された場合）
      if (result.contactUrl) {
        await supabase
          .from('leads')
          .update({
            contact_url: result.contactUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('id', lead.id)
      }

      return NextResponse.json({
        success: true,
        message: `${lead.company_name} へのフォーム送信が完了しました`,
        result,
      })
    }

    if (result.result === 'form_not_found') {
      await supabase
        .from('send_queue')
        .update({
          status: 'form_not_found',
          error_message: result.message,
          updated_at: new Date().toISOString(),
        })
        .eq('id', queueItemId)
        .eq('user_id', user.id)

      return NextResponse.json({
        success: false,
        message: result.message,
        result,
      })
    }

    if (result.result === 'manual') {
      await supabase
        .from('send_queue')
        .update({
          status: '手動対応',
          error_message: result.message,
          updated_at: new Date().toISOString(),
        })
        .eq('id', queueItemId)
        .eq('user_id', user.id)

      return NextResponse.json({
        success: false,
        message: result.message,
        result,
      })
    }

    // failed
    await supabase
      .from('send_queue')
      .update({
        status: '失敗',
        error_message: result.message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', queueItemId)
      .eq('user_id', user.id)

    return NextResponse.json({
      success: false,
      message: result.message,
      result,
    })
  } catch (err) {
    console.error('Agent send error:', err)

    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'フォーム送信の処理に失敗しました',
      },
      { status: 500 }
    )
  }
}
