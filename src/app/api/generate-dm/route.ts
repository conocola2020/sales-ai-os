import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAnthropicApiKey } from '@/lib/env'

const apiKey = getAnthropicApiKey()
const client = new Anthropic({ apiKey })

// ──────────────────────────────────────────
// System prompt: generate personalized Instagram DM
// ──────────────────────────────────────────
const DM_SYSTEM_PROMPT = [
  'あなたはCONOCOLA（コノコーラ）のInstagram DM担当です。',
  '送信元アカウント: @conospice（CONOCOLAのInstagramアカウント）',
  '担当者: 河野大地（CONOCOLA代表）',
  'CONOCOLAはサウナー専用コーラブランドで、全国60以上のサウナ施設に導入済みです。',
  'ターゲット（主にサウナ施設）のプロフィール情報をもとに、自然で親しみやすいDMを日本語で生成してください。',
  '',
  '【DM生成ルール】',
  '- 200文字以内の簡潔なDM',
  '- カジュアルで親しみやすいトーン（Instagram DMらしく）',
  '- 「サウナー専用コーラ」CONOCOLAを自然に紹介する',
  '- 相手の施設情報やプロフィールに具体的に言及する（HP情報がある場合は活用）',
  '- 冒頭に@ユーザー名を含めない（直接メッセージなので不要）',
  '- 「はじめまして、CONOCOLAの河野です！」のように自然に始める',
  '- 最後に商談予約リンクを案内: https://timerex.net/s/daichi_3022_c34c/a78a4d68',
  '- 押しつけがましくなく、興味があれば気軽にという姿勢',
  '',
  'DM文面のみを返してください（説明・補足不要）。',
].join('\n')

// Demo DMs when API key not configured
function demoDm(
  username: string,
  displayName: string | null,
  bio: string | null,
  industry: string | null,
  facilityName: string | null
): string {
  const name = facilityName || displayName || `@${username}`
  const timerexUrl = 'https://timerex.net/s/daichi_3022_c34c/a78a4d68'
  if (industry && (industry.includes('サウナ') || industry.includes('温浴') || industry.includes('銭湯') || industry.includes('スパ'))) {
    return `はじめまして、CONOCOLAの河野です！${name}さんの素敵な施設、投稿で拝見しました🧖 サウナー専用コーラを全国60施設以上でお取り扱いいただいてまして、ととのい後の一杯にぴったりだと好評です！もしご興味あれば気軽にお話しさせてください✨ ${timerexUrl}`
  }
  if (bio && (bio.includes('サウナ') || bio.includes('ととの') || bio.includes('温泉'))) {
    return `はじめまして、CONOCOLAの河野です！${name}さんのサウナ愛が伝わる投稿、いつも楽しく見ています🔥 サウナー専用コーラを全国60施設以上に導入してまして、ご興味あれば詳しくお話しさせてください！ ${timerexUrl}`
  }
  return `はじめまして、CONOCOLAの河野です！${name}さんの投稿いつも拝見しています✨ サウナー専用コーラを展開しているのですが、もしお取り扱いにご興味あれば気軽にお話しできればうれしいです🙌 ${timerexUrl}`
}

// ──────────────────────────────────────────
// POST /api/generate-dm
// Body: { username, display_name?, bio?, industry?, follower_count? }
// ──────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      username: string
      display_name?: string | null
      bio?: string | null
      industry?: string | null
      follower_count?: number | null
      engagement_rate?: number | null
      facility_name?: string | null
      website_url?: string | null
      hp_info?: string | null
    }

    if (!body.username || typeof body.username !== 'string') {
      return NextResponse.json({ error: 'ユーザー名は必須です' }, { status: 400 })
    }

    const isDemo =
      !getAnthropicApiKey() ||
      getAnthropicApiKey() === 'your-anthropic-api-key-here'

    if (isDemo) {
      await new Promise(resolve => setTimeout(resolve, 900))
      const dm = demoDm(
        body.username,
        body.display_name ?? null,
        body.bio ?? null,
        body.industry ?? null,
        body.facility_name ?? null
      )
      return NextResponse.json({ dm })
    }

    // Build context for Claude
    const lines: string[] = [
      `ユーザー名: @${body.username}`,
      `表示名: ${body.display_name || '不明'}`,
      `施設名: ${body.facility_name || '不明'}`,
      `プロフィール(bio): ${body.bio || '（なし）'}`,
      `業種: ${body.industry || '不明'}`,
    ]
    if (body.follower_count != null) {
      lines.push(`フォロワー数: ${body.follower_count.toLocaleString()}人`)
    }
    if (body.engagement_rate != null) {
      lines.push(`エンゲージメント率: ${body.engagement_rate}%`)
    }
    if (body.website_url) {
      lines.push(`WebサイトURL: ${body.website_url}`)
    }
    if (body.hp_info) {
      lines.push(`\n【施設HP情報】\n${body.hp_info}`)
    }

    const userMessage = ['【ターゲット情報】', ...lines].join('\n')

    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        system: DM_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      })

      const textBlock = response.content.find(b => b.type === 'text')
      if (!textBlock || textBlock.type !== 'text') {
        return NextResponse.json({ error: 'DM生成に失敗しました' }, { status: 500 })
      }

      return NextResponse.json({ dm: textBlock.text.trim() })
    } catch (apiErr: unknown) {
      // クレジット不足・レート制限などAPIエラー時はデモDMにフォールバック
      const status = (apiErr as { status?: number })?.status
      const message = (apiErr as { error?: { error?: { message?: string } } })
        ?.error?.error?.message ?? ''

      console.warn('Anthropic API error, falling back to demo DM:', status, message)

      const dm = demoDm(
        body.username,
        body.display_name ?? null,
        body.bio ?? null,
        body.industry ?? null,
        body.facility_name ?? null
      )
      return NextResponse.json({ dm })
    }
  } catch (err) {
    console.error('generate-dm error:', err)
    return NextResponse.json({ error: 'DM生成中にエラーが発生しました' }, { status: 500 })
  }
}
