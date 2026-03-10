import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { Tone } from '@/types/messages'
import type { UserSettings, MessageTemplate } from '@/types/settings'
import { DEFAULT_USER_SETTINGS } from '@/types/settings'
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
  parts.push('最も重要な使命は、相手企業のHP情報を徹底的に分析し、「不（不足・不便・不満・不安）」を具体的に特定した上で、')
  parts.push('弊社の商品・サービスがその「不」をピンポイントで解決する提案型の営業メッセージを作成することです。')
  parts.push('')
  parts.push('★最重要★ このメッセージの核心は「不の解決提案」です。')
  parts.push('汎用的・テンプレ的な営業メールではなく、相手企業のHPから読み取れる具体的な課題に踏み込んだ、')
  parts.push('「うちのことをちゃんと調べてくれている」と感じさせるメッセージを作成してください。')
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

  // ---- HP分析指示（★核心部分★）----
  parts.push('【HP分析と「不」の特定 ★このセクションが最重要★】')
  parts.push('相手企業のHP情報が提供された場合、以下の手順で深く分析してからメッセージを作成してください：')
  parts.push('')
  parts.push('ステップ1: 現状の徹底把握')
  parts.push('- 施設の種類、コンセプト、ターゲット客層を把握する')
  parts.push('- 現在のドリンクメニュー・フードメニューの内容を確認する')
  parts.push('- 施設の強み・こだわり・差別化ポイントを理解する')
  parts.push('')
  parts.push('ステップ2: 「不」の具体的な特定（必ず2〜3個挙げる）')
  parts.push('以下の観点で「不」を探し、メッセージに明確に盛り込むこと：')
  parts.push('- ドリンクメニューの不足: サウナ後に特化したドリンクがない、一般的な飲料のみ、差別化できていない')
  parts.push('- フードメニューの不足: サウナ飯がない、メニュー数が少ない、キッチン設備の制約で出せていない')
  parts.push('- 差別化の不足: 他施設と似たようなメニュー構成、SNS映えする目玉商品がない')
  parts.push('- オペレーションの不安: 人手不足で新メニュー追加が難しい、調理スタッフが確保できない')
  parts.push('- 収益機会の損失: サウナ後の滞在時間を活かせていない、客単価を上げる手段が少ない')
  parts.push('')
  parts.push('ステップ3: 解決策の具体的な接続（★ここが営業メールの説得力の核★）')
  parts.push('- 特定した「不」に対して、弊社のどの商品がどう解決するかを1対1で結びつける')
  parts.push('- 「〜でお悩みではないでしょうか → 弊社の○○なら△△で解決できます」の構造を使う')
  parts.push('- 抽象的な表現（「メニュー充実に貢献」等）ではなく、具体的な解決シナリオを描く')
  parts.push('  例: 「キッチンスペースが限られていても、冷凍パックを温めるだけで本格スパイスカレーが提供可能」')
  parts.push('  例: 「サウナ後の"ととのい"に特化した専用ドリンクで、他施設にはない体験を提供」')
  parts.push('')

  // ---- 共通生成ルール ----
  parts.push('【生成ルール】')
  parts.push('- コピペしてそのままメール送信できるビジネスメール形式で出力する')
  parts.push('- メッセージ本文のみ出力する（「以下の通りです」等の前置き不要）')
  parts.push('- 500〜800文字で作成する（件名除く）')
  parts.push('')
  parts.push('【ビジネスメール構成】')
  parts.push('以下の順番で構成すること：')
  parts.push('1. 件名：（1行目に記載）')
  parts.push('2. 宛名：「○○ ご担当者様」')
  parts.push('3. 挨拶＋自己紹介：突然の連絡の断り → 会社名・氏名・何をしている会社か簡潔に')
  parts.push('4. 連絡の経緯：なぜ連絡したか（HP拝見、業界動向等）')
  parts.push('5. 相手への共感・理解：HP分析から読み取った相手の強み・こだわり・取り組みを具体的な固有名詞や特徴を交えて褒める（汎用的な褒め言葉NG、「貴施設のHP拝見しました」だけで終わらない）')
  parts.push('6. 課題提起（不の指摘）★最重要パート★：HP分析で特定した「不」を2〜3個、具体的に・自然に提起する。「〜ではないでしょうか」「〜という課題はございませんか」の形で。ここが汎用的だとメール全体の説得力が落ちるので、必ず相手企業固有の課題に踏み込む')
  parts.push('7. 提案内容（不の解決）★最重要パート★：6で提起した課題それぞれに対して、弊社の具体的な商品名を挙げて「この不はこう解決できる」と1対1で結びつける。数字・実績も必ず入れる')
  parts.push('8. 次のアクション（CTA）：具体的な提案（サンプル送付、電話、Zoom等）')
  parts.push('9. 結びの挨拶：「ご検討いただけますと幸いです」等')
  parts.push('10. 署名：会社名・氏名・肩書き・メール・電話・Web')
  parts.push('')
  parts.push('【文体ルール】')
  parts.push('- 相手企業への理解と共感が伝わる内容にする')
  parts.push('- 弊社商品の押し売りではなく、相手の課題解決として提案する')
  parts.push('- 具体的な数字や事例があれば積極的に使う')
  parts.push('- 段落ごとに空行を入れて読みやすくする')
  parts.push('- 絵文字は使わない（ビジネスメールとして適切な体裁）')
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
    '丁寧': `件名：${company}様のドリンク・フードメニュー強化のご提案

${company} ご担当者様

突然のご連絡、大変失礼いたします。
世界初のサウナ専用コーラの製造・販売、およびサウナ飯の卸販売を手がけております、株式会社CONOCOLAの河野大地と申します。

この度、貴施設のWebサイトを拝見し、素晴らしいサウナ体験を提供されていることに大変感銘を受けました。施設づくりへのこだわりが伝わり、多くのサウナーの皆様に愛されている施設であることが伺えます。

一方で、サウナ後のドリンクやフードメニューをさらに充実させることで、お客様の満足度と客単価のさらなる向上が期待できるのではないかと感じております。

弊社の「サウナー専用コーラ」は、スパイスとハーブを独自ブレンドした"ととのいドリンク"でございます。設備投資・スタッフ教育一切不要で、本日からすぐにご提供いただけます。現在全国約54施設にご導入いただいており、月間最大106万円の追加売上を達成された施設もございます。導入先の多くが1年以上継続してお取り扱いいただいており、リピート率の高さが特徴です。

また、キッチン設備が限られた施設様にもご好評いただいている「サ飯（冷凍スパイスカレー）」もございます。温めるだけで本格的なスパイスカレーを提供でき、お客様の滞在時間と単価向上に貢献いたします。

まずは無料サンプルをお送りさせていただき、貴施設のお客様の反応をお試しいただければ幸いです。お電話またはZoomでのご説明も承っておりますので、お気軽にお申し付けください。

ご多忙のところ恐れ入りますが、ご検討いただけますと幸いです。

株式会社CONOCOLA
代表取締役 河野大地
Tel: 052-228-4945
Mail: conocola2020@gmail.com
Web: https://conocola.com`,
    '簡潔': `件名：設備投資ゼロで導入できるサウナ専用ドリンク＆フードのご提案

${company} ご担当者様

突然のご連絡失礼いたします。
サウナ専用コーラ・サウナ飯の製造販売を行う、株式会社CONOCOLAの河野大地です。

貴施設のWebサイトを拝見し、ご連絡いたしました。

サウナ後のドリンク・フードメニューの充実は、顧客満足度と客単価向上に直結します。現在のメニューに弊社商品を追加いただくことで、新たな収益源を簡単に確保いただけます。

弊社の主力商品をご紹介いたします。

■ サウナー専用コーラ
・スパイスとハーブを独自ブレンドした"ととのいドリンク"
・設備投資・教育不要、すぐに提供可能
・全国約54施設で導入済み、月間最大106万円の追加売上実績

■ サ飯（冷凍スパイスカレー）
・温めるだけで本格スパイスカレーを提供
・キッチンが狭い施設でも対応可能
・滞在時間と客単価の向上に貢献

無料サンプルをお送りいたします。
お気軽にご返信、またはお電話ください。

株式会社CONOCOLA
代表取締役 河野大地
Tel: 052-228-4945
Mail: conocola2020@gmail.com
Web: https://conocola.com`,
    'フレンドリー': `件名：サウナ後のドリンク＆フード、もっと楽しくしませんか？

${company} ご担当者様

はじめまして。
世界初のサウナ専用コーラを作っている、株式会社CONOCOLAの河野大地と申します。

貴施設のWebサイトを拝見しました。こだわりのサウナ体験を提供されていて、サウナ好きとしてとても魅力的だなと感じています。

実は最近、多くのサウナ施設様から「サウナ後のドリンクやフードをもっと充実させたいけど、設備やスタッフの問題で難しい」というお声をよくいただきます。貴施設でも同じようなお悩みはありませんか？

そこでご紹介したいのが、弊社の「サウナー専用コーラ」です。スパイスとハーブを独自ブレンドした、まさに"ととのい"のために生まれたドリンクです。設備投資もスタッフ教育も一切不要で、届いたその日から提供できます。

現在全国約54施設で導入いただいていて、飲んだお客様のリピート率がとても高いんです。1年以上継続してくださっている施設がほとんどで、月間最大106万円の追加売上を達成された施設もあります。

合わせて「サ飯（冷凍スパイスカレー）」もご用意しています。温めるだけで本格スパイスカレーが提供できるので、キッチンが限られている施設様にもとても好評です。

まずは無料サンプルをお送りしますので、お客様の反応を見ていただけたら嬉しいです。お電話やZoomでのご説明も気軽にお声がけください。

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
