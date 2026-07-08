import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import {
  REVIEW_REPLY_SYSTEM_PROMPT,
  buildReviewReplyUserPrompt,
  type ReplyTone,
} from '@/lib/meo/prompts'

export const dynamic = 'force-dynamic'

const DEMO_REPLY = (name: string) =>
  `この度は${name}にご来店いただき、また温かい口コミをお寄せいただき誠にありがとうございます。お楽しみいただけたご様子を拝見し、スタッフ一同大変嬉しく思っております。これからもスパイスの調合にこだわった一皿をご提供できるよう努めてまいります。またのご来店を心よりお待ちしております。`

export async function POST(req: NextRequest) {
  try {
    const { location, review, tone } = (await req.json()) as {
      location: { name: string; category: string | null; address: string | null }
      review: { author: string | null; rating: number | null; body: string | null }
      tone?: ReplyTone
    }

    if (!location?.name || !review?.body) {
      return NextResponse.json({ error: '店舗情報と口コミ本文は必須です' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey || apiKey === 'your-anthropic-api-key-here') {
      return NextResponse.json({ reply: DEMO_REPLY(location.name), isDemo: true })
    }

    const anthropic = new Anthropic({ apiKey })
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: REVIEW_REPLY_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: buildReviewReplyUserPrompt(location, review, tone ?? '丁寧'),
        },
      ],
    })

    const reply = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim()

    return NextResponse.json({ reply, isDemo: false })
  } catch (e) {
    console.error('generate-reply error:', e)
    const raw = e instanceof Error ? e.message : ''
    const msg = raw.includes('authentication_error')
      ? 'ANTHROPIC_API_KEY が無効です。.env.local に有効なAPIキーを設定してください。'
      : raw || '返信の生成に失敗しました'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
