import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { Tone } from '@/types/messages'
import type { UserSettings, MessageTemplate } from '@/types/settings'
import { DEFAULT_USER_SETTINGS } from '@/types/settings'
import { fetchStructuredHpContent, formatStructuredContent } from '@/lib/hp-fetcher'
import { analyzeForConocola, formatAnalysis } from '@/lib/hp-analyzer'
import { buildSystemPrompt, buildUserPrompt } from '@/lib/prompt-builder'

// ---------------------------------------------------------------------------
// Demo streaming
// ---------------------------------------------------------------------------

async function* demoStream(company: string, tone: Tone): AsyncGenerator<string> {
  const demos: Record<Tone, string> = {
    '丁寧': `件名：${company}様のドリンク・フードメニュー強化のご提案
---
${company} ご担当者様

貴施設のWebサイトを拝見し、素晴らしいサウナ体験を提供されていることに大変感銘を受け、ご連絡いたしました。
世界初のサウナ専用コーラの製造・販売、およびサウナ飯の卸販売を手がけております、株式会社CONOCOLAの河野大地と申します。

貴施設のこだわりのサウナ環境は、多くのサウナーの皆様に愛されていることが伺えます。一方で、サウナ後のドリンクやフードメニューをさらに充実させることで、お客様の満足度と客単価のさらなる向上が期待できるのではないかと感じております。

弊社の「サウナー専用コーラ」は、スパイスとハーブを独自ブレンドした"ととのいドリンク"です。設備投資・スタッフ教育一切不要で、本日からすぐにご提供いただけます。現在全国約54施設にご導入いただいており、月間最大106万円の追加売上を達成された施設もございます。

また、「サ飯（冷凍スパイスカレー）」もございます。温めるだけで本格的なスパイスカレーを提供でき、キッチン設備が限られた施設様にもご好評いただいております。

まずは無料サンプルをお送りさせていただき、貴施設のお客様の反応をお試しいただければ幸いです。

ご多忙のところ恐れ入りますが、ご検討いただけますと幸いです。

株式会社CONOCOLA
代表取締役 河野大地
Tel: 052-228-4945
Mail: conocola2020@gmail.com
Web: https://conocola.com`,
    '簡潔': `件名：設備投資ゼロで導入できるサウナ専用ドリンク＆フードのご提案
---
${company} ご担当者様

サウナ専用コーラ・サウナ飯の製造販売を行う、株式会社CONOCOLAの河野大地です。
貴施設のWebサイトを拝見し、ご連絡いたしました。

■ サウナー専用コーラ
・スパイスとハーブを独自ブレンドした"ととのいドリンク"
・設備投資・教育不要、すぐに提供可能
・全国約54施設で導入済み、月間最大106万円の追加売上実績

■ サ飯（冷凍スパイスカレー）
・温めるだけで本格スパイスカレーを提供
・キッチンが狭い施設でも対応可能

無料サンプルをお送りいたします。
お気軽にご返信、またはお電話ください。

株式会社CONOCOLA
代表取締役 河野大地
Tel: 052-228-4945
Mail: conocola2020@gmail.com
Web: https://conocola.com`,
    'フレンドリー': `件名：サウナ後のドリンク＆フード、もっと楽しくしませんか？
---
${company} ご担当者様

はじめまして。世界初のサウナ専用コーラを作っている、株式会社CONOCOLAの河野大地です。

貴施設のWebサイトを拝見しました。こだわりのサウナ体験を提供されていて、サウナ好きとしてとても魅力的だなと感じています。

実は最近、多くのサウナ施設様から「ドリンクやフードをもっと充実させたいけど、設備やスタッフの問題で難しい」というお声をよくいただきます。貴施設でも同じようなお悩みはありませんか？

弊社の「サウナー専用コーラ」は、スパイスとハーブを独自ブレンドした"ととのい"のためのドリンクです。設備投資もスタッフ教育も一切不要で、届いたその日から提供できます。

全国約54施設で導入いただいていて、月間最大106万円の追加売上を達成された施設もあります。

まずは無料サンプルをお送りしますので、お客様の反応を見ていただけたら嬉しいです。

ご検討いただけますと幸いです。

株式会社CONOCOLA
代表取締役 河野大地
Tel: 052-228-4945
Mail: conocola2020@gmail.com
Web: https://conocola.com`,
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

    // DBに弊社情報がない場合はデフォルト値をフォールバック
    if (!settings) {
      settings = DEFAULT_USER_SETTINGS as unknown as UserSettings
    }

    // HP取得 + 事前分析
    let hpContent: string | null = null
    let hpAnalysisText: string | null = null
    const hpUrl = lead.company_url || lead.website_url
    if (hpUrl) {
      console.log(`[generate] HP構造化取得: ${hpUrl}`)
      const structured = await fetchStructuredHpContent(hpUrl)
      if (structured) {
        hpContent = formatStructuredContent(structured)
        const hpAnalysis = analyzeForConocola(structured)
        hpAnalysisText = formatAnalysis(hpAnalysis)
        console.log(`[generate] HP分析完了: ${hpAnalysis.facilityType}, 課題${hpAnalysis.identifiedProblems.length}件`)
      }
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
    const userPrompt = buildUserPrompt(lead, tone, customInstructions, analysis, hpContent, hpAnalysisText)

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
