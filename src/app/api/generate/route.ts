import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { Tone } from '@/types/messages'

const SYSTEM_PROMPTS: Record<Tone, string> = {
  '丁寧': `あなたはB2B営業のプロフェッショナルです。企業の問い合わせフォームや担当者へ送る、丁寧でフォーマルな営業メッセージを作成します。

ルール：
- 正しい敬語を使い、礼儀正しい文体を保つ
- 相手企業への敬意と関心を示す
- 相手企業の事業内容や特徴を踏まえ、具体的な提案を含める
- 弊社の価値提案を明確かつ控えめに伝える
- 押しつけがましくなく、対話のきっかけとなる内容にする
- 200〜350文字程度でまとめる
- メッセージ本文のみ出力する（「以下の通りです」等の前置き不要）`,

  '簡潔': `あなたはB2B営業のプロフェッショナルです。要点を絞ったシンプルで効果的な営業メッセージを作成します。

ルール：
- 無駄を省き、要点を3点以内にまとめる
- 相手企業の事業内容を踏まえたメリットを冒頭に明示する
- 読みやすい短文を心がける
- 150〜250文字程度でまとめる
- メッセージ本文のみ出力する（「以下の通りです」等の前置き不要）`,

  'フレンドリー': `あなたはB2B営業のプロフェッショナルです。親しみやすく、温かみのある営業メッセージを作成します。

ルール：
- カジュアルすぎず、適度に親しみやすいトーンを保つ
- 相手企業の事業内容に触れ、共感を示す
- 自然な言葉遣いで、堅苦しくならないようにする
- 200〜300文字程度でまとめる
- メッセージ本文のみ出力する（「以下の通りです」等の前置き不要）`,
}

// ---------------------------------------------------------------------------
// HP からテキストを抽出するヘルパー
// ---------------------------------------------------------------------------

function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(p|div|h[1-6]|li|br|tr)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function extractMeta(html: string): { title: string; description: string } {
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i)
  const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : ''
  const descMatch =
    html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ??
    html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i)
  const description = descMatch ? descMatch[1].trim() : ''
  return { title, description }
}

async function fetchHpContent(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en;q=0.9',
      },
    })
    clearTimeout(timeout)
    if (!res.ok) return null
    const html = await res.text()
    const { title, description } = extractMeta(html)
    const body = stripHtml(html)
    const parts = [
      title ? `タイトル: ${title}` : '',
      description ? `説明: ${description}` : '',
      body.slice(0, 3000),
    ].filter(Boolean)
    return parts.join('\n')
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// プロンプト組み立て
// ---------------------------------------------------------------------------

function buildUserPrompt(
  lead: Record<string, string | null>,
  tone: Tone,
  customInstructions: string,
  analysis?: Record<string, unknown> | null,
  hpContent?: string | null
): string {
  const parts = [
    `以下の企業情報を参考に、${tone}なトーンの営業メッセージを作成してください。`,
    '相手企業の事業内容や特徴を踏まえた、パーソナライズされた内容にしてください。',
    '',
    '【対象企業情報】',
    `会社名: ${lead.company_name ?? '不明'}`,
    lead.contact_name ? `担当者名: ${lead.contact_name}` : null,
    lead.industry ? `業種: ${lead.industry}` : null,
    lead.website_url ? `Webサイト: ${lead.website_url}` : null,
    lead.phone ? `電話番号: ${lead.phone}` : null,
    lead.notes ? `備考・メモ: ${lead.notes}` : null,
  ].filter(Boolean) as string[]

  // 既存の企業分析データがある場合
  if (analysis) {
    if (analysis.business_summary) {
      parts.push('', '【AI企業分析結果】')
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

  // HP コンテンツがある場合（分析データがない場合のフォールバック）
  if (!analysis && hpContent) {
    parts.push('', '【企業HPから取得した情報】')
    parts.push(hpContent)
    parts.push('')
    parts.push('上記のHP情報を分析し、この企業に最適化された営業メッセージを作成してください。')
  }

  const instructions = customInstructions?.trim()
    ? `\n\n【追加指示】\n${customInstructions}`
    : ''

  return parts.join('\n') + instructions
}

// ---------------------------------------------------------------------------
// Demo streaming
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// API Route
// ---------------------------------------------------------------------------

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

    // 分析データがない場合、HPからコンテンツを自動取得
    let hpContent: string | null = null
    if (!analysis && lead.website_url) {
      console.log(`[generate] HP自動取得: ${lead.website_url}`)
      hpContent = await fetchHpContent(lead.website_url)
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
    const userPrompt = buildUserPrompt(lead, tone, customInstructions, analysis, hpContent)

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
          const errStatus = (err as { status?: number })?.status
          const errMsg = (err as { error?: { error?: { message?: string } } })?.error?.error?.message ?? ''
          console.error('Anthropic stream error:', errStatus, errMsg)
          // エラーメッセージを送信（デモにフォールバックしない）
          controller.enqueue(
            encoder.encode(`[エラー] AI生成に失敗しました (${errStatus || 'unknown'}): ${errMsg || '不明なエラー'}`)
          )
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
