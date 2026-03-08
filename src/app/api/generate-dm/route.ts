import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ──────────────────────────────────────────
// System prompt: generate personalized Instagram DM
// ──────────────────────────────────────────
const DM_SYSTEM_PROMPT = [
  'あなたはInstagramのDMを書くプロのコピーライターです。',
  'ターゲットのプロフィール情報をもとに、自然で親しみやすいDMを日本語で生成してください。',
  '',
  '【DM生成ルール】',
  '- 3〜5文程度の簡潔なDM（200文字以内推奨）',
  '- 相手のプロフィール・業種・発信内容に自然に言及する',
  '- 売り込み感を出さず、まず相互フォローや会話のきっかけを作ることを目的にする',
  '- 具体的な質問や提案で締めて、返信しやすくする',
  '- 冒頭に@ユーザー名を含めない（直接メッセージなので不要）',
  '- 「はじめまして」から自然に始める',
  '- マーケティング・集客・売上向上の文脈で価値を提供できることを示す（押しつけがましくなく）',
  '',
  'DM文面のみを返してください（説明・補足不要）。',
].join('\n')

// Demo DMs when API key not configured
function demoDm(
  username: string,
  displayName: string | null,
  bio: string | null,
  industry: string | null
): string {
  const name = displayName || `@${username}`
  if (industry && (industry.includes('飲食') || industry.includes('食品'))) {
    return `はじめまして！${name}さんのお料理の投稿いつも拝見しています✨ 美味しそうな写真と丁寧な発信がとても素敵だなと思いフォローさせていただきました。もしよろしければ、お店のSNS集客についてお役に立てることがあればと思いご連絡しました。少しでもご興味があれば、お気軽にご返信いただけますか？`
  }
  if (industry && (industry.includes('IT') || industry.includes('SaaS') || industry.includes('テック'))) {
    return `はじめまして！${name}さんのプロダクト発信いつも参考にしています🙌 ${bio ? `「${bio.slice(0, 20)}」` : 'IT・SaaS領域'}でご活躍とのこと、とても刺激を受けています。もしよろしければ、マーケティング面でお力になれることがあればと思いご連絡しました。ご興味あればお気軽にお返事いただけますか？`
  }
  if (industry && industry.includes('コンサルティング')) {
    return `はじめまして！${name}さんのビジネス発信、いつも勉強になっています📊 コンサルティング業界での豊富なご経験が伝わってきます。もしよろしければ、クライアント獲得やブランディングについて情報交換させていただけないでしょうか？お気軽にご返信いただけますか？`
  }
  return `はじめまして！${name}さんの投稿をいつも楽しく拝見しています✨ ${bio ? `「${bio.slice(0, 30)}...」というプロフィールに共感しました。` : 'とても素敵な発信をされているなと思いご連絡しました。'}もし差し支えなければ、SNSやマーケティングについて情報交換できればと思っています。ご興味があればお気軽にご返信ください🙌`
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
    }

    if (!body.username || typeof body.username !== 'string') {
      return NextResponse.json({ error: 'ユーザー名は必須です' }, { status: 400 })
    }

    const isDemo =
      !process.env.ANTHROPIC_API_KEY ||
      process.env.ANTHROPIC_API_KEY === 'your-anthropic-api-key-here'

    if (isDemo) {
      await new Promise(resolve => setTimeout(resolve, 900))
      const dm = demoDm(
        body.username,
        body.display_name ?? null,
        body.bio ?? null,
        body.industry ?? null
      )
      return NextResponse.json({ dm })
    }

    // Build context for Claude
    const lines: string[] = [
      `ユーザー名: @${body.username}`,
      `表示名: ${body.display_name || '不明'}`,
      `プロフィール(bio): ${body.bio || '（なし）'}`,
      `業種: ${body.industry || '不明'}`,
    ]
    if (body.follower_count != null) {
      lines.push(`フォロワー数: ${body.follower_count.toLocaleString()}人`)
    }
    if (body.engagement_rate != null) {
      lines.push(`エンゲージメント率: ${body.engagement_rate}%`)
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
        body.industry ?? null
      )
      return NextResponse.json({ dm })
    }
  } catch (err) {
    console.error('generate-dm error:', err)
    return NextResponse.json({ error: 'DM生成中にエラーが発生しました' }, { status: 500 })
  }
}
