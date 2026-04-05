import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 300 // Vercel最大5分
import Anthropic from '@anthropic-ai/sdk'
import type { Tone } from '@/types/messages'
import type { UserSettings, MessageTemplate } from '@/types/settings'
import { DEFAULT_USER_SETTINGS } from '@/types/settings'
import { fetchStructuredHpContent, formatStructuredContent } from '@/lib/hp-fetcher'
import { analyzeForConocola, formatAnalysis } from '@/lib/hp-analyzer'
import { buildSystemPrompt, buildUserPrompt, parseSubjectAndBody } from '@/lib/prompt-builder'
import { getAnthropicApiKey } from '@/lib/env'

interface BulkGenerateRequest {
  leadIds: string[]
  tone: Tone
  customInstructions: string
  templateId?: string
}

interface BulkGenerateResult {
  leadId: string
  companyName: string
  subject: string
  body: string
  error?: string
}

// ---------------------------------------------------------------------------
// 一括生成API（ストリーミングでリアルタイム進捗を返す）
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const { leadIds, tone, customInstructions, templateId } = await req.json() as BulkGenerateRequest

    if (!leadIds?.length || !tone) {
      return NextResponse.json({ error: 'leadIds と tone は必須です' }, { status: 400 })
    }

    const apiKey = getAnthropicApiKey()
    const isDemo = !apiKey || apiKey === 'your-anthropic-api-key-here'

    // ── デモモード: ダミーデータをストリーム返却 ──
    if (isDemo) {
      const { generateCandidateDatesText } = await import('@/lib/date-utils')
      const dates = generateCandidateDatesText('9:00〜19:00')
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          const total = leadIds.length
          controller.enqueue(encoder.encode(
            JSON.stringify({ type: 'progress', total, completed: 0 }) + '\n'
          ))
          for (let i = 0; i < total; i++) {
            await new Promise(r => setTimeout(r, 300))
            const demoBody = `ご担当者様\n\nはじめまして！世界初のサウナ専用コーラを作っている、株式会社CONOCOLAの河野大地です。\n\n貴施設のWebサイトを拝見し、サウナへのこだわりに大変共感いたしました。\n\n弊社は全国60以上のサウナ施設様にご導入いただいており、NHK・東海テレビなどメディア掲載実績も多数ございます。\n\nぜひ一度、15分程度のオンラインミーティングでご紹介させてください。\n\n▼ ご都合のよい日時をお選びください\n${dates}\n📅 https://timerex.net/s/daichi_3022_c34c/a78a4d68\n\n河野大地\nCONOCOLA株式会社\nTel: 050-1234-5678\nEmail: daichi@conocola.com`
            controller.enqueue(encoder.encode(
              JSON.stringify({
                type: 'result',
                leadId: leadIds[i],
                companyName: `デモ企業${i + 1}`,
                subject: `【CONOCOLA】サウナ専用コーラのご提案`,
                body: demoBody,
                progress: { total, completed: i + 1 },
              }) + '\n'
            ))
          }
          controller.enqueue(encoder.encode(
            JSON.stringify({ type: 'done', total, completed: total }) + '\n'
          ))
          controller.close()
        },
      })
      return new Response(stream, {
        headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache' },
      })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl || supabaseUrl === 'your-supabase-url') {
      return NextResponse.json({ error: 'Supabaseが設定されていません' }, { status: 500 })
    }

    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    // Fetch user settings
    let settings: UserSettings | null = null
    const { data: settingsData } = await supabase
      .from('user_settings').select('*').limit(1).maybeSingle()
    if (settingsData) settings = settingsData as UserSettings
    if (!settings) settings = DEFAULT_USER_SETTINGS as unknown as UserSettings

    // Fetch template
    let template: MessageTemplate | null = null
    if (templateId) {
      const { data } = await supabase.from('message_templates').select('*').eq('id', templateId).single()
      if (data) template = data as MessageTemplate
    } else {
      const { data } = await supabase.from('message_templates').select('*').eq('is_default', true).limit(1).maybeSingle()
      if (data) template = data as MessageTemplate
    }

    // Fetch all leads at once
    const { data: leadsData } = await supabase.from('leads').select('*').in('id', leadIds)
    const leadsMap = new Map<string, Record<string, string | null>>()
    if (leadsData) {
      for (const lead of leadsData) {
        leadsMap.set(lead.id, lead)
      }
    }

    const client = new Anthropic({ apiKey })
    const systemPrompt = buildSystemPrompt(settings, template, tone)

    // Stream results as NDJSON（順次処理 + レート制限対策）
    const DELAY_MS = 1000 // リクエスト間の待機時間（1秒）
    const MAX_RETRIES = 3 // 429エラー時の最大リトライ回数
    const encoder = new TextEncoder()
    const readableStream = new ReadableStream({
      async start(controller) {
        const total = leadIds.length
        let completed = 0

        controller.enqueue(encoder.encode(
          JSON.stringify({ type: 'progress', total, completed: 0 }) + '\n'
        ))

        // Claude APIコール（429リトライ付き）
        const callWithRetry = async (
          systemMsg: string,
          userMsg: string,
          retries = 0
        ): Promise<Anthropic.Message> => {
          try {
            return await client.messages.create({
              model: 'claude-sonnet-4-6',
              max_tokens: 1500,
              system: systemMsg,
              messages: [{ role: 'user', content: userMsg }],
            })
          } catch (err) {
            const isRateLimit =
              err instanceof Anthropic.RateLimitError ||
              (err instanceof Error && err.message.includes('429'))
            if (isRateLimit && retries < MAX_RETRIES) {
              // 指数バックオフ: 10秒, 20秒, 40秒
              const waitMs = 10000 * Math.pow(2, retries)
              controller.enqueue(encoder.encode(
                JSON.stringify({
                  type: 'progress',
                  total,
                  completed,
                  message: `レート制限到達。${waitMs / 1000}秒後にリトライ... (${retries + 1}/${MAX_RETRIES})`,
                }) + '\n'
              ))
              await new Promise(r => setTimeout(r, waitMs))
              return callWithRetry(systemMsg, userMsg, retries + 1)
            }
            throw err
          }
        }

        // 1件分の処理
        const processLead = async (leadId: string) => {
          const lead = leadsMap.get(leadId) ?? { company_name: '不明' }
          try {
            let hpContent: string | null = null
            let hpAnalysisText: string | null = null
            const hpUrl = lead.company_url || lead.website_url
            if (hpUrl) {
              const structured = await Promise.race([
                fetchStructuredHpContent(hpUrl as string),
                new Promise<null>(r => setTimeout(() => r(null), 5000)),
              ])
              if (structured) {
                hpContent = formatStructuredContent(structured)
                const hpAnalysis = analyzeForConocola(structured)
                hpAnalysisText = formatAnalysis(hpAnalysis)
              }
            }

            const { data: analysisData } = await supabase
              .from('company_analyses')
              .select('business_summary, challenges, proposal_points, keywords')
              .eq('lead_id', leadId)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()

            const userPrompt = buildUserPrompt(
              lead, tone, customInstructions,
              analysisData as Record<string, unknown> | null,
              hpContent, hpAnalysisText
            )

            const response = await callWithRetry(systemPrompt, userPrompt)

            const fullText = response.content
              .filter(b => b.type === 'text')
              .map(b => b.text)
              .join('')

            const { subject, body } = parseSubjectAndBody(fullText)
            completed++
            controller.enqueue(encoder.encode(
              JSON.stringify({
                type: 'result',
                leadId,
                companyName: (lead.company_name as string) ?? '不明',
                subject,
                body,
                progress: { total, completed },
              }) + '\n'
            ))
          } catch (err) {
            completed++
            const errMsg = err instanceof Error ? err.message : '不明なエラー'
            controller.enqueue(encoder.encode(
              JSON.stringify({
                type: 'result',
                leadId,
                companyName: (lead.company_name as string) ?? '不明',
                subject: '',
                body: '',
                error: errMsg,
                progress: { total, completed },
              }) + '\n'
            ))
          }
        }

        // 順次処理（1件ずつ、間にウェイトを入れる）
        for (let i = 0; i < total; i++) {
          await processLead(leadIds[i])
          // 最後の1件以外はウェイトを入れる
          if (i < total - 1) {
            await new Promise(r => setTimeout(r, DELAY_MS))
          }
        }

        controller.enqueue(encoder.encode(
          JSON.stringify({ type: 'done', total, completed }) + '\n'
        ))
        controller.close()
      },
    })

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    console.error('Bulk generate error:', err)
    return NextResponse.json({ error: '一括生成に失敗しました' }, { status: 500 })
  }
}
