import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAnthropicApiKey } from '@/lib/env'

const SYSTEM_PROMPT = `あなたはレシートのOCR専門家です。提供されたレシート画像を分析し、以下のJSON形式のみで返してください（説明文・コードブロック不要）:
{
  "receipt_date": "YYYY-MM-DD",
  "store_name": "店名",
  "items": [
    {
      "item_name": "品目名",
      "amount": 金額(数値),
      "expense_category": "カテゴリ"
    }
  ],
  "total_amount": 合計金額(数値)
}

expense_categoryは以下から最も適切なものを選んでください（品目名から推定）:
- 食費（飲食店、スーパー、コンビニの食品等）
- 交通費（電車、バス、タクシー、ガソリン等）
- 消耗品（文具、日用品、洗剤等）
- 交際費（接待、贈り物等）
- 通信費（電話、インターネット等）
- 書籍・資料費（本、雑誌等）
- 会議費（会議室、コーヒー等）
- その他

- receipt_dateが読み取れない場合は今日の日付を使用
- 金額は税込の数値（円マーク・カンマなし）
- 品目名が読み取れない場合は "不明" とする`

const DEMO_RESULT = {
  receipt_date: '2026-03-22',
  store_name: 'サンプルコーヒー',
  items: [
    { item_name: 'カフェラテ', amount: 550, expense_category: '食費' },
    { item_name: 'チーズケーキ', amount: 480, expense_category: '食費' },
  ],
  total_amount: 1030,
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('image') as File | null

    if (!file) {
      return NextResponse.json({ error: '画像ファイルが必要です' }, { status: 400 })
    }

    const apiKey = getAnthropicApiKey()
    const isDemo = !apiKey || apiKey === 'your-anthropic-api-key-here'

    if (isDemo) {
      await new Promise(resolve => setTimeout(resolve, 1500))
      return NextResponse.json({ result: DEMO_RESULT })
    }

    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const mediaType = (file.type || 'image/jpeg') as
      | 'image/jpeg'
      | 'image/png'
      | 'image/gif'
      | 'image/webp'

    const client = new Anthropic({ apiKey })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            { type: 'text', text: 'このレシートを読み取ってください。' },
          ],
        },
      ],
    })

    const textContent = response.content.find(b => b.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      return NextResponse.json({ error: 'OCR結果の取得に失敗しました' }, { status: 500 })
    }

    let result
    try {
      const jsonText = textContent.text
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim()
      result = JSON.parse(jsonText)
    } catch {
      return NextResponse.json({ error: 'OCR結果のパースに失敗しました' }, { status: 500 })
    }

    return NextResponse.json({ result })
  } catch (err) {
    console.error('OCR error:', err)
    return NextResponse.json({ error: 'OCR処理中にエラーが発生しました' }, { status: 500 })
  }
}
