import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { AnalysisResult } from '@/types/analyses'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const ANALYSIS_SYSTEM_PROMPT = [
  'あなたは企業調査の専門家です。提供されたWebサイトのコンテンツを分析し、以下のJSON形式で企業情報を返してください。',
  '',
  '必ず以下のJSONのみを返してください（説明文やコードブロックは不要）:',
  '{',
  '  "company_name": "企業名",',
  '  "industry": "業種（例: IT・ソフトウェア、EC・小売、製造業、金融・保険、医療・ヘルスケア、不動産、教育、コンサルティング、広告・マーケティング、飲食・サービス、物流・運輸、メディア・エンタメ、その他）",',
  '  "scale": "規模（1〜10名 / 11〜50名 / 51〜100名 / 101〜300名 / 301〜1000名 / 1000名以上 / 不明）",',
  '  "business_summary": "事業内容の要約（100〜150文字）",',
  '  "challenges": ["課題1", "課題2", "課題3"],',
  '  "proposal_points": ["提案ポイント1", "提案ポイント2", "提案ポイント3"],',
  '  "keywords": ["キーワード1", "キーワード2", "キーワード3", "キーワード4", "キーワード5"]',
  '}',
  '',
  '- challenges: Webサイトから読み取れる潜在的な課題・ニーズを3〜5つ',
  '- proposal_points: 営業担当者が提案すべきポイントを3〜5つ（具体的かつ実践的に）',
  '- keywords: 企業の特徴を表すキーワードを3〜7つ',
].join('\n')

function stripHtml(html: string): string {
  let text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(nav|footer|header|aside)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
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

  return text
}

function extractMetaData(html: string): { title: string; description: string } {
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i)
  const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : ''

  const descMatch =
    html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ??
    html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i)
  const description = descMatch ? descMatch[1].trim() : ''

  return { title, description }
}

const DEMO_ANALYSIS: AnalysisResult = {
  company_name: 'サンプル株式会社',
  industry: 'IT・ソフトウェア',
  scale: '51〜100名',
  business_summary:
    'クラウドベースのSaaSプロダクトを開発・提供するIT企業。中小企業向けの業務効率化ツールを主力製品として展開し、全国に顧客基盤を持つ。',
  challenges: [
    '既存システムとの連携が複雑で導入コストが高い',
    '営業チームのデジタル化が遅れており手動作業が多い',
    '顧客データの活用が十分でなく機会損失が発生している',
  ],
  proposal_points: [
    'API連携による既存システムへのスムーズな統合提案',
    '営業DX推進のためのSFA/CRMツール導入支援',
    'データ分析基盤の整備による顧客インサイト強化',
  ],
  keywords: ['SaaS', 'クラウド', '中小企業向け', '業務効率化', 'DX推進'],
}

async function demoAnalysis(): Promise<AnalysisResult> {
  await new Promise(resolve => setTimeout(resolve, 1500))
  return DEMO_ANALYSIS
}

export async function POST(req: NextRequest) {
  try {
    const { url } = (await req.json()) as { url: string }
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URLを入力してください' }, { status: 400 })
    }

    let normalizedUrl = url.trim()
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl
    }

    const isDemo =
      !process.env.ANTHROPIC_API_KEY ||
      process.env.ANTHROPIC_API_KEY === 'your-anthropic-api-key-here'

    if (isDemo) {
      const result = await demoAnalysis()
      return NextResponse.json({ result })
    }

    // Fetch the URL
    let html: string
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)
      const fetchResponse = await fetch(normalizedUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ja,en;q=0.9',
        },
      })
      clearTimeout(timeout)

      if (!fetchResponse.ok) {
        return NextResponse.json(
          { error: `URLの取得に失敗しました (HTTP ${fetchResponse.status})` },
          { status: 400 }
        )
      }

      const buffer = await fetchResponse.arrayBuffer()
      const rawText = Buffer.from(buffer).toString('utf-8')
      const charsetMatch = rawText.match(/charset=["']?([\w-]+)/i)
      if (charsetMatch && charsetMatch[1].toLowerCase() !== 'utf-8') {
        html = Buffer.from(buffer).toString('latin1')
      } else {
        html = rawText
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return NextResponse.json({ error: 'URLの取得がタイムアウトしました' }, { status: 408 })
      }
      return NextResponse.json(
        { error: 'URLにアクセスできませんでした。URLを確認してください。' },
        { status: 400 }
      )
    }

    const { title, description } = extractMetaData(html)
    const bodyText = stripHtml(html)

    const contentForAnalysis = [
      `URL: ${normalizedUrl}`,
      title ? `タイトル: ${title}` : '',
      description ? `メタディスクリプション: ${description}` : '',
      '',
      'ページコンテンツ:',
      bodyText.slice(0, 5000),
    ]
      .filter(Boolean)
      .join('\n')

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: ANALYSIS_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: contentForAnalysis,
        },
      ],
    })

    const textContent = response.content.find(b => b.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      return NextResponse.json({ error: '分析結果の取得に失敗しました' }, { status: 500 })
    }

    let result: AnalysisResult
    try {
      const jsonText = textContent.text
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim()
      result = JSON.parse(jsonText) as AnalysisResult
      result.challenges = Array.isArray(result.challenges) ? result.challenges : []
      result.proposal_points = Array.isArray(result.proposal_points) ? result.proposal_points : []
      result.keywords = Array.isArray(result.keywords) ? result.keywords : []
    } catch {
      return NextResponse.json({ error: '分析結果のパースに失敗しました' }, { status: 500 })
    }

    return NextResponse.json({ result })
  } catch (err) {
    console.error('Analyze error:', err)
    return NextResponse.json({ error: '分析中にエラーが発生しました' }, { status: 500 })
  }
}
