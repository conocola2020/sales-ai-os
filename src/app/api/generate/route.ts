import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { Tone } from '@/types/messages'
import type { UserSettings, MessageTemplate } from '@/types/settings'
import { DEFAULT_USER_SETTINGS } from '@/types/settings'
import { fetchStructuredHpContent, formatStructuredContent } from '@/lib/hp-fetcher'
import { analyzeForConocola, formatAnalysis } from '@/lib/hp-analyzer'
import { buildSystemPrompt, buildUserPrompt } from '@/lib/prompt-builder'
import { generateFreeSalesMessage } from '@/lib/free-message-generator'
import { wrapGeneratedText } from '@/lib/message-formatting'
import type { HpAnalysis } from '@/lib/hp-analyzer'
import type { StructuredHpContent } from '@/lib/hp-fetcher'

// ---------------------------------------------------------------------------
// API Route
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const { leadId, tone, customInstructions, templateId, generationMode = 'free' } = await req.json() as {
      leadId: string
      tone: Tone
      customInstructions: string
      templateId?: string
      generationMode?: 'free' | 'claude'
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
    let structuredHpContent: StructuredHpContent | null = null
    let hpAnalysis: HpAnalysis | null = null
    let hpContent: string | null = null
    let hpAnalysisText: string | null = null
    const hpUrl = lead.company_url || lead.website_url
    if (hpUrl) {
      console.log(`[generate] HP構造化取得: ${hpUrl}`)
      const structured = await fetchStructuredHpContent(hpUrl)
      if (structured) {
        structuredHpContent = structured
        hpContent = formatStructuredContent(structured)
        hpAnalysis = analyzeForConocola(structured)
        hpAnalysisText = formatAnalysis(hpAnalysis)
        console.log(`[generate] HP分析完了: ${hpAnalysis.facilityType}, 課題${hpAnalysis.identifiedProblems.length}件`)
      }
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    const shouldUseFreeGenerator =
      generationMode === 'free' ||
      !apiKey ||
      apiKey === 'your-anthropic-api-key-here'

    // 無料テンプレ生成: Claude APIを使わず、HP分析結果をテンプレートに差し込む
    if (shouldUseFreeGenerator) {
      const freeMessage = generateFreeSalesMessage({
        lead,
        tone,
        customInstructions,
        settings,
        template,
        hpContent: structuredHpContent,
        hpAnalysis,
      })
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          for (const char of freeMessage.text) {
            controller.enqueue(encoder.encode(char))
            await new Promise(r => setTimeout(r, 3))
          }
          controller.close()
        },
      })
      return new Response(stream, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }

    // Real Claude API generation, then normalize line breaks before streaming to UI.
    const client = new Anthropic({ apiKey: apiKey! })
    const systemPrompt = buildSystemPrompt(settings, template, tone)
    const userPrompt = buildUserPrompt(lead, tone, customInstructions, analysis, hpContent, hpAnalysisText)

    const encoder = new TextEncoder()
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          const response = await client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 1500,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
          })

          const fullText = response.content
            .filter((block) => block.type === 'text')
            .map((block) => block.text)
            .join('')

          for (const char of wrapGeneratedText(fullText)) {
            controller.enqueue(encoder.encode(char))
            await new Promise(r => setTimeout(r, 3))
          }
        } catch (err) {
          const errStatus = (err as { status?: number })?.status
          const errMsg = (err as { error?: { error?: { message?: string } } })?.error?.error?.message ?? ''
          console.error('Anthropic stream error:', errStatus, errMsg)
          if (errStatus === 401 || errMsg.includes('x-api-key') || errMsg.includes('authentication')) {
            const freeMessage = generateFreeSalesMessage({
              lead,
              tone,
              customInstructions,
              settings,
              template,
              hpContent: structuredHpContent,
              hpAnalysis,
            })
            controller.enqueue(encoder.encode(freeMessage.text))
          } else {
            controller.enqueue(
              encoder.encode(`[エラー] AI生成に失敗しました (${errStatus || 'unknown'}): ${errMsg || '不明なエラー'}`)
            )
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
