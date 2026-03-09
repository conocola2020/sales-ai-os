import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function POST(req: NextRequest) {
  try {
    const { to, subject, body, leadId, queueItemId } = await req.json() as {
      to: string
      subject: string
      body: string
      leadId?: string
      queueItemId?: string
    }

    if (!to || !subject || !body) {
      return NextResponse.json(
        { error: '宛先、件名、本文は必須です' },
        { status: 400 }
      )
    }

    const apiKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@yourdomain.com'

    // Demo mode
    if (!apiKey || apiKey === 'your-resend-api-key-here') {
      await new Promise(r => setTimeout(r, 800))
      return NextResponse.json({
        success: true,
        demo: true,
        messageId: `demo_${Date.now()}`,
        message: 'デモモード: メール送信をシミュレートしました',
      })
    }

    const resend = new Resend(apiKey)

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [to],
      subject,
      text: body,
    })

    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json(
        { error: `メール送信エラー: ${error.message}` },
        { status: 500 }
      )
    }

    // Update Supabase records if configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (supabaseUrl && supabaseUrl !== 'your-supabase-url' && queueItemId) {
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()

      await supabase
        .from('send_queue')
        .update({
          status: '送信済み',
          sent_at: new Date().toISOString(),
        })
        .eq('id', queueItemId)

      if (leadId) {
        await supabase
          .from('leads')
          .update({ status: '送信済み' })
          .eq('id', leadId)
      }
    }

    return NextResponse.json({
      success: true,
      messageId: data?.id,
      message: 'メールを送信しました',
    })
  } catch (err) {
    console.error('Send email error:', err)
    return NextResponse.json(
      { error: 'メール送信に失敗しました' },
      { status: 500 }
    )
  }
}
