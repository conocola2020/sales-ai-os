import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { Tone } from '@/types/messages'

const SYSTEM_PROMPTS: Record<Tone, string> = {
  '丁寧': `あなたはB2B営業のプロフェッショナルです。企業の問い合わせフォームや担当者へ送る、丁寧でフォーマルな営業メッセージを作成します。

ルール：
- 正しい敬語を使い、礼儀正しい文体を保つ
- 相手企業への敬意と関心を示す
- 弊社の価値提案を明確かつ控えめに伝える
- 押しつけがましくなく、対話のきっかけとなる内容にする
- 200〜350文字程度でまとめる
- メッセージ本文のみ出力する（「以下の通りです」等の前置き不要）`,

  '簡潔': `あなたはB2B営業のプロフェッショナルです。要点を絞ったシンプルで効果的な営業メッセージを作成します。

ルール：
- 無駄を省き、要点を3点以内にまとめる
- 相手のメリットを冒頭に明示する
- 読みやすい短文を心がける
- 150〜250文字程度でまとめる
- メッセージ本文のみ出力する（「以下の通りです」等の前置き不要）`,

  'フレンドリー': `あなたはB2B営業のプロフェッショナルです。親しみやすく、温かみのある営業メッセージを作成します。

ルール：
- カジュアルすぎず、適度に親しみやすいトーンを保つ
- 相手に寄り添った共感を示す
- 自然な言葉遣いで、堅苦しくならないようにする
- 200〜300文字程度でまとめる
- メッセージ本文のみ出力する（「以下の通りです」等の前置き不要）`,
}

function buildUserPrompt(
  lead: Record<string, string | null>,
  tone: Tone,
  customInstructions: string,
  analysis?: Record<string, unknown> | null
): string {
  const parts = [
    `以下の企業情報を参考に、${tone}なトーンの営業メッセージを作成してください。`,
    '',
    '【対象企業情報】',
    `会社名: ${lead.company_name ?? '不明'}`,
    lead.contact_name ? `担当者名: ${lead.contact_name}` : null,
    lead.industry ? `業種: ${lead.industry}` : null,
    lead.website_url ? `Webサイト: ${lead.website_url}` : null,
    lead.notes ? `備考・メモ: ${lead.notes}` : null,
  ].filter(Boolean) as string[]

  // Enrich with analysis data if available
  if (analysis) {
    if (analysis.business_summary) {
      parts.push('', '【AI企業分析】')
      parts.push(`事業概要: ${analysis.business_summary}`)
    }
    if (Array.isArray(analysis.challenges) && analysis.challenges.length > 0) {
      parts.push(`推定課題: ${(analysis.challenges as string[]).join('、')}`)
    }
    if (Array.isArray(analysis.proposal_points) && analysis.proposal_points.length > 0) {
      parts.push('', '【重点提案ポイント】')
      ;(analysis.proposal_points as string[]).forEach((point, i) => {
        parts.push(`${i + 1}. ${point}`)
      })
    }
    if (Array.isArray(analysis.keywords) && analysis.keywords.length > 0) {
      parts.push(`キーワード: ${(analysis.keywords as string[]).join('、')}`)
    }
  }

  const instructions = customInstructions?.trim()
    ? `\n\n【追加指示】\n${customInstructions}`
    : ''

  return parts.join('\n') + instructions
}

// Demo streaming for when ANTHROPIC_API_KEY is not configured
async function* demoStream(company: string, tone: Tone): AsyncGenerator<string> {
  const demos: Record<Tone, string> = {
    '丁寧': `${company}ご担当者様\n\n突然のご連絡、大変失礼いたします。\n\n私どもは、中小〜中堅企業様の営業効率化を支援するSaaSサービスを提供しております。貴社の事業にご関心をお持ちし、一度ご説明の機会をいただけますと幸いです。\n\nご多忙の折、誠に恐縮ではございますが、お時間をいただけますでしょうか。\n\nどうぞよろしくお願いいたします。`,
    '簡潔': `${company}ご担当者様\n\n営業効率を30%改善するSaaSをご紹介します。\n\n✓ AI自動化で営業工数を削減\n✓ 導入3ヶ月で成果が出る実績\n✓ 初期費用0円・1ヶ月無料体験あり\n\n15分のデモをぜひご覧ください。`,
    'フレンドリー': `${company}の皆さん、こんにちは！\n\nいつも素敵なお仕事をされているのを拝見しています。\n\n実は、貴社のような企業様にぴったりのサービスがあってご連絡しました。営業の手間をグッと減らしながら、もっと大切なことに時間を使えるようになります！\n\nぜひ一度、気軽にお話しできませんか？😊`,
  }

  const text = demos[tone]
  const chunks = text.split('')
  for (const char of chunks) {
    yield char
    await new Promise(r => setTimeout(r, 15))
  }
}

export async function POST(req: NextRequest) {
  try {
    const { leadId, tone, customInstructions } = await req.json() as {
      leadId: string
      tone: Tone
      customInstructions: string
    }

    if (!leadId || !tone) {
      return NextResponse.json({ error: 'leadId と tone は必須です' }, { status: 400 })
    }

    // Fetch lead data and most recent company analysis from Supabase
    let lead: Record<string, string | null> = { company_name: '企業名未設定' }
    let analysis: Record<string, unknown> | null = null
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (supabaseUrl && supabaseUrl !== 'your-supabase-url') {
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()
      const { data, error } = await supabase.from('leads').select('*').eq('id', leadId).single()
      if (!error && data) lead = data

      // Fetch the most recent company analysis linked to this lead
      const { data: analysisData } = await supabase
        .from('company_analyses')
        .select('business_summary, challenges, proposal_points, keywords')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (analysisData) analysis = analysisData as Record<string, unknown>
    }

    const apiKey = process.env.ANTHROPIC_API_KEY

    // Demo mode when API key is not configured
    if (!apiKey || apiKey === 'your-anthropic-api-key-here') {
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          for await (const chunk of demoStream(lead.company_name ?? '企業名未設定', tone)) {
            controller.enqueue(encoder.encode(chunk))
          }
          controller.close()
        },
      })
      return new Response(stream, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }

    // Real Claude API streaming
    const client = new Anthropic({ apiKey })
    const systemPrompt = SYSTEM_PROMPTS[tone]
    const userPrompt = buildUserPrompt(lead, tone, customInstructions, analysis)

    const encoder = new TextEncoder()
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          const stream = client.messages.stream({
            model: 'claude-sonnet-4-6',
            max_tokens: 1024,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
          })

          for await (const event of stream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              controller.enqueue(encoder.encode(event.delta.text))
            }
          }
        } catch (err) {
          const status = (err as { status?: number })?.status
          const message = (err as { error?: { error?: { message?: string } } })?.error?.error?.message ?? ''
          console.warn('Anthropic stream error, falling back to demo:', status, message)
          // フォールバック: デモテキストをストリーミング
          for await (const chunk of demoStream(lead.company_name ?? '企業名未設定', tone)) {
            controller.enqueue(encoder.encode(chunk))
          }
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    console.error('Generate route error:', err)
    return NextResponse.json({ error: '生成に失敗しました' }, { status: 500 })
  }
}
