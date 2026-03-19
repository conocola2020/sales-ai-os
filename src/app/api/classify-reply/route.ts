import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { Sentiment } from '@/types/replies'
import { getAnthropicApiKey } from '@/lib/env'

const apiKey = getAnthropicApiKey()
const client = new Anthropic({ apiKey })

// ──────────────────────────────────────────
// System prompt: classify + draft response
// ──────────────────────────────────────────
const CLASSIFY_SYSTEM_PROMPT = [
  'あなたはB2B営業の専門家です。受信した返信メッセージを分析し、以下のJSON形式のみを返してください（説明文・コードブロック不要）:',
  '{',
  '  "sentiment": "分類ラベル",',
  '  "reason": "分類理由（30文字以内）",',
  '  "ai_response": "返信文案（200〜400文字、段落ごとに\\n\\nで改行）"',
  '}',
  '',
  '分類ラベルは必ず以下のいずれか:',
  '- 興味あり: 積極的な関心・面談・商談を希望している',
  '- 検討中: 前向きだが即断できない・情報収集中',
  '- お断り: 不要・興味なし・拒否の意思が明確',
  '- 質問: 料金・機能・詳細についての質問がある',
  '- その他: 上記に当てはまらない',
  '',
  'ai_responseのルール:',
  '- 相手の感情・返信内容に合わせた自然な返信文案を生成する',
  '- 丁寧かつ簡潔に、次のアクション（面談提案・追加情報提供等）を促す',
  '- 「お断り」の場合も、失礼のない締めくくりの文面を生成する',
  '- メッセージ本文のみ（前置き・後書き不要）',
  '- 必ず段落ごとに改行（\\n\\n）を入れて読みやすく整形する',
  '- 構成: 冒頭の挨拶 → 本題への返答 → 次のアクション提案 → 締めの挨拶（各段落を改行で区切る）',
  '- 200〜400文字程度で丁寧に書く',
].join('\n')

// Demo response when API key not configured
function demoClassify(content: string): { sentiment: Sentiment; reason: string; ai_response: string } {
  const lower = content
  if (lower.includes('興味') || lower.includes('詳しく') || lower.includes('面談') || lower.includes('お会い')) {
    return {
      sentiment: '興味あり',
      reason: '面談・詳細確認への関心が見られる',
      ai_response: 'お返事いただきありがとうございます。\n\nぜひ詳しくご説明させていただければ幸いです。ご都合のよい日程をいくつかお知らせいただけますでしょうか。オンライン・対面どちらでも対応可能です。\n\nどうぞよろしくお願いいたします。',
    }
  }
  if (lower.includes('検討') || lower.includes('上司') || lower.includes('社内')) {
    return {
      sentiment: '検討中',
      reason: '社内検討中のニュアンスが読み取れる',
      ai_response: 'ご検討いただきありがとうございます。\n\n追加でご不明な点やご確認事項がございましたら、いつでもお気軽にご連絡ください。\n\n引き続きどうぞよろしくお願いいたします。',
    }
  }
  if (lower.includes('結構') || lower.includes('不要') || lower.includes('間に合って') || lower.includes('お断り')) {
    return {
      sentiment: 'お断り',
      reason: '不要・お断りの意思が明確',
      ai_response: 'ご返信いただきありがとうございます。\n\n今回はご縁がなかったとのこと、承知いたしました。\n\nまたご状況が変わりましたら、いつでもお声がけいただければ幸いです。失礼いたします。',
    }
  }
  if (lower.includes('料金') || lower.includes('費用') || lower.includes('価格') || lower.includes('どのくらい') || lower.includes('?') || lower.includes('？')) {
    return {
      sentiment: '質問',
      reason: '具体的な質問・問い合わせが含まれる',
      ai_response: 'ご質問いただきありがとうございます。\n\n詳細についてご説明させていただきます。別途、資料をお送りすることも可能です。\n\nまたご不明な点があれば、お気軽にご連絡ください。',
    }
  }
  return {
    sentiment: 'その他',
    reason: '特定カテゴリに該当しない返信',
    ai_response: 'ご返信いただきありがとうございます。\n\n引き続きご不明な点などございましたら、いつでもお気軽にお問い合わせください。\n\nどうぞよろしくお願いいたします。',
  }
}

// ──────────────────────────────────────────
// POST /api/classify-reply
// Body: { content: string; company_name?: string; contact_name?: string }
// ──────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      content: string
      company_name?: string
      contact_name?: string
    }

    if (!body.content || typeof body.content !== 'string') {
      return NextResponse.json({ error: '返信内容を入力してください' }, { status: 400 })
    }

    const isDemo =
      !getAnthropicApiKey() ||
      getAnthropicApiKey() === 'your-anthropic-api-key-here'

    if (isDemo) {
      await new Promise(resolve => setTimeout(resolve, 800))
      const result = demoClassify(body.content)
      return NextResponse.json(result)
    }

    // Build user message with context
    const userMessage = [
      body.company_name ? `送信元会社: ${body.company_name}` : null,
      body.contact_name ? `送信元担当者: ${body.contact_name}` : null,
      '',
      '【返信内容】',
      body.content,
    ]
      .filter(line => line !== null)
      .join('\n')

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: CLASSIFY_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const textBlock = response.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: '分析結果の取得に失敗しました' }, { status: 500 })
    }

    let result: { sentiment: Sentiment; reason: string; ai_response: string }
    try {
      const jsonText = textBlock.text
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim()
      result = JSON.parse(jsonText) as typeof result

      // Validate sentiment
      const validSentiments: Sentiment[] = ['興味あり', '検討中', 'お断り', '質問', 'その他']
      if (!validSentiments.includes(result.sentiment)) {
        result.sentiment = 'その他'
      }
    } catch {
      return NextResponse.json({ error: '分析結果のパースに失敗しました' }, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('classify-reply error:', err)
    return NextResponse.json({ error: '分析中にエラーが発生しました' }, { status: 500 })
  }
}
