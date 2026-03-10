import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { Tone } from '@/types/messages'
import type { UserSettings, MessageTemplate } from '@/types/settings'
import { fetchHpContent } from '@/lib/hp-fetcher'

// ---------------------------------------------------------------------------
// 動的システムプロンプト構築
// ---------------------------------------------------------------------------

const TONE_INSTRUCTIONS: Record<Tone, string> = {
  '丁寧': [
    '【トーン指示】',
    '- 正しい敬語を使い、礼儀正しくフォーマルな文体にする',
    '- 「〜いたします」「〜ございます」「〜いただけますと幸いです」等の丁寧表現を使う',
    '- 共感部分も「〜ではないでしょうか」のように丁寧に言い換える',
    '- 全体的に落ち着いた印象で、ビジネス文書として違和感のないトーンにする',
  ].join('\n'),

  '簡潔': [
    '【トーン指示】',
    '- 無駄な修飾や前置きを省き、要点をストレートに伝える',
    '- 一文を短くし、テンポの良い文章にする',
    '- 箇条書き部分はそのまま活かし、本文の説明も簡潔にまとめる',
    '- 「〜です」「〜ます」のシンプルな敬語で統一する',
  ].join('\n'),

  'フレンドリー': [
    '【トーン指示】',
    '- 親しみやすく、話しかけるような温かみのある文体にする',
    '- 「〜ですよね」「〜しませんか？」等の共感・問いかけ表現を活用する',
    '- 堅すぎず、カジュアルすぎないバランスを保つ',
    '- 読み手が気軽に返信したくなるような親近感のあるトーンにする',
  ].join('\n'),
}

function buildSystemPrompt(
  settings: UserSettings | null,
  template: MessageTemplate | null,
  tone: Tone
): string {
  const parts: string[] = []

  // ---- 役割定義 ----
  parts.push('あなたはB2B営業のプロフェッショナルです。')
  parts.push('相手企業の情報（HP情報含む）を分析し、「不（不足・不便・不満）」を特定した上で、')
  parts.push('弊社の商品・サービスがその「不」を解決する提案型の営業メッセージを作成します。')
  parts.push('')

  // ---- 弊社情報 ----
  if (settings && settings.company_name) {
    parts.push('【弊社情報】')
    parts.push(`会社名: ${settings.company_name}`)
    if (settings.representative) {
      const title = settings.representative_title ? `（${settings.representative_title}）` : ''
      parts.push(`担当者: ${settings.representative}${title}`)
    }
    if (settings.company_email) parts.push(`メール: ${settings.company_email}`)
    if (settings.company_website) parts.push(`Web: ${settings.company_website}`)
    if (settings.company_description) parts.push(`事業内容: ${settings.company_description}`)

    // 商品情報
    const products = Array.isArray(settings.products) ? settings.products : []
    if (products.length > 0) {
      parts.push('')
      parts.push('【弊社の商品・サービス】')
      products.forEach((p, i) => {
        parts.push(`${i + 1}. ${p.name}`)
        if (p.description) parts.push(`   説明: ${p.description}`)
        if (p.benefits) parts.push(`   相手へのメリット: ${p.benefits}`)
      })
    }

    // 強み
    const vps = Array.isArray(settings.value_propositions) ? settings.value_propositions : []
    if (vps.length > 0) {
      parts.push('')
      parts.push('【弊社の強み】')
      vps.forEach((v, i) => parts.push(`${i + 1}. ${v}`))
    }

    // 実績
    if (settings.social_proof) {
      parts.push('')
      parts.push(`【導入実績】${settings.social_proof}`)
    }

    // CTA
    if (settings.cta_text) {
      parts.push('')
      parts.push(`【デフォルトCTA】${settings.cta_text}`)
    }
    parts.push('')
  }

  // ---- テンプレート構造 ----
  if (template && template.structure) {
    parts.push('【メッセージ構成テンプレート】')
    parts.push(template.structure)
    parts.push('')
  }

  // ---- HP分析指示 ----
  parts.push('【HP分析指示】')
  parts.push('相手企業のHP情報が提供された場合、以下の手順で分析してからメッセージを作成してください：')
  parts.push('1. 現状把握: 施設の種類、サービス、メニュー、強み、特徴を把握する')
  parts.push('2. 「不」の特定: ドリンクメニューの弱さ、フードの不足、差別化ポイントの少なさ、人手不足感 等')
  parts.push('3. 解決策の接続: 弊社商品がその「不」をどう解決するかを具体的に結びつける')
  parts.push('4. メッセージに反映: 分析結果をもとに、パーソナライズされた提案メッセージを作成する')
  parts.push('')

  // ---- 共通生成ルール ----
  parts.push('【生成ルール】')
  parts.push('- 件名も含めてメッセージ全文を出力する')
  parts.push('- メッセージ本文のみ出力する（「以下の通りです」等の前置き不要）')
  parts.push('- 相手企業への理解と共感が伝わる内容にする')
  parts.push('- 弊社商品の押し売りではなく、相手の課題解決として提案する')
  parts.push('- 具体的な数字や事例があれば積極的に使う')
  parts.push('- 250〜400文字程度（件名除く）でまとめる')
  parts.push('')

  // ---- トーン ----
  parts.push(TONE_INSTRUCTIONS[tone])

  return parts.join('\n')
}

// ---------------------------------------------------------------------------
// ユーザープロンプト構築
// ---------------------------------------------------------------------------

function buildUserPrompt(
  lead: Record<string, string | null>,
  tone: Tone,
  customInstructions: string,
  analysis?: Record<string, unknown> | null,
  hpContent?: string | null
): string {
  const parts = [
    '以下の情報をもとに、営業メッセージを生成してください。',
    '',
    '【対象企業情報】',
    `施設名/会社名: ${lead.company_name ?? '不明'}`,
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
      parts.push(`推定課題（不）: ${(analysis.challenges as string[]).join('、')}`)
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

  // HP コンテンツがある場合
  if (hpContent) {
    parts.push('', '【企業HPから取得した情報】')
    parts.push(hpContent)
    parts.push('')
    parts.push('上記のHP情報から「不（不足・不便・不満）」を読み取り、弊社商品で解決できるポイントを組み込んだメッセージを作成してください。')
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
    '丁寧': `件名：${company}様のドリンクメニュー強化のご提案\n\n${company}ご担当者様\n\n突然のご連絡、大変失礼いたします。\n飲料・食品の製造・OEM開発を手がけるCONOCOLAの河野と申します。\n\n貴施設のWebサイトを拝見し、素晴らしいサウナ体験を提供されていることに大変感銘を受けました。\n\nサウナ後のドリンクメニューをさらに充実させることで、お客様の満足度と客単価の向上が期待できるのではないかと存じます。\n\n弊社の「サウナー専用コーラ」は設備投資・教育不要で、今日からすぐに提供可能です。全国約50施設に導入いただいており、月間最大106万円の追加売上実績がございます。\n\nまずは無料サンプルをお送りさせていただければ幸いです。\n\n株式会社CONOCOLA\n代表取締役　河野大地\n📧 conocola2020@gmail.com\n🌐 https://conocola.com`,
    '簡潔': `件名：設備投資ゼロで導入できるサウナ専用ドリンク\n\n${company}様\n\nCONOCOLAの河野です。\n\n貴施設にサウナ専用コーラ＆サ飯をご提案します。\n\n✓ 設備投資・教育不要、すぐに提供可能\n✓ 全国約50施設で導入済み\n✓ 月間最大106万円の追加売上実績\n\n無料サンプルをお送りします。お気軽にご返信ください。\n\n株式会社CONOCOLA 河野大地\n📧 conocola2020@gmail.com`,
    'フレンドリー': `件名：サウナ後のドリンク、もっと楽しくしませんか？\n\n${company}の皆さん、こんにちは！\nCONOCOLAの河野です。\n\n素敵なサウナ施設を運営されていますね！ サウナ後のあの最高の瞬間をもっと特別にできるドリンクがあるんです。\n\n「サウナー専用コーラ」はスパイスとハーブを独自ブレンドした"ととのいドリンク"。設備投資ゼロで今日から提供できます。\n\nまずは無料サンプルで試してみませんか？😊\n\n株式会社CONOCOLA 河野大地\n📧 conocola2020@gmail.com`,
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
    const { leadId, tone, customInstructions, templateId } = await req.json() as {
      leadId: string
      tone: Tone
      customInstructions: string
      templateId?: string
    }

    if (!leadId || !tone) {
      return NextResponse.json({ error: 'leadId と tone は必須です' }, { status: 400 })
    }

    // Fetch lead, analysis, settings, template from Supabase
    let lead: Record<string, string | null> = { company_name: '企業名未設定' }
    let analysis: Record<string, unknown> | null = null
    let settings: UserSettings | null = null
    let template: MessageTemplate | null = null

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (supabaseUrl && supabaseUrl !== 'your-supabase-url') {
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()

      // Lead
      const { data: leadData, error: leadError } = await supabase
        .from('leads').select('*').eq('id', leadId).single()
      if (!leadError && leadData) lead = leadData

      // Company analysis
      const { data: analysisData } = await supabase
        .from('company_analyses')
        .select('business_summary, challenges, proposal_points, keywords')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (analysisData) analysis = analysisData as Record<string, unknown>

      // User settings (弊社情報)
      const { data: settingsData } = await supabase
        .from('user_settings')
        .select('*')
        .limit(1)
        .maybeSingle()
      if (settingsData) settings = settingsData as UserSettings

      // Message template
      if (templateId) {
        const { data: tplData } = await supabase
          .from('message_templates')
          .select('*')
          .eq('id', templateId)
          .single()
        if (tplData) template = tplData as MessageTemplate
      } else {
        // Default template
        const { data: tplData } = await supabase
          .from('message_templates')
          .select('*')
          .eq('is_default', true)
          .limit(1)
          .maybeSingle()
        if (tplData) template = tplData as MessageTemplate
      }
    }

    // HP自動取得（分析データがない場合）
    let hpContent: string | null = null
    if (lead.website_url) {
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
    const systemPrompt = buildSystemPrompt(settings, template, tone)
    const userPrompt = buildUserPrompt(lead, tone, customInstructions, analysis, hpContent)

    const encoder = new TextEncoder()
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          const stream = client.messages.stream({
            model: 'claude-sonnet-4-6',
            max_tokens: 1500,
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
