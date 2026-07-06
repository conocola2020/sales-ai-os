import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { AIO_CHECK_SYSTEM_PROMPT, detectMention } from '@/lib/meo/prompts'
import type { MeoAioCheck } from '@/types/meo'

export const dynamic = 'force-dynamic'

// コーノスパイス系の表記ゆれ（location.name以外の別名はここに追加）
const DEFAULT_ALIASES = ['KOHNO SPICE', 'CONOCOLA', 'コーノ スパイス']

export async function POST(req: NextRequest) {
  try {
    const { query, locationId, locationName, aliases } = (await req.json()) as {
      query: string
      locationId?: string
      locationName: string
      aliases?: string[]
    }

    if (!query?.trim() || !locationName) {
      return NextResponse.json({ error: 'クエリと店舗名は必須です' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey || apiKey === 'your-anthropic-api-key-here') {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY が未設定のためAIOチェックを実行できません' },
        { status: 400 }
      )
    }

    // Step1: 消費者シミュレーション — AIに実際のローカル検索質問を投げる
    const anthropic = new Anthropic({ apiKey })
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: AIO_CHECK_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: query.trim() }],
    })

    const answer = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim()

    // Step2: 言及判定
    const result = detectMention(answer, locationName, aliases ?? DEFAULT_ALIASES)

    // Step3: ログイン済みなら履歴を保存
    let saved: MeoAioCheck | null = null
    if (locationId && !locationId.startsWith('demo-')) {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data, error } = await supabase
          .from('meo_aio_checks')
          .insert({
            user_id: user.id,
            location_id: locationId,
            engine: 'claude',
            query: query.trim(),
            mentioned: result.mentioned,
            rank: result.rank,
            snippet: result.snippet,
            answer,
          })
          .select()
          .single()

        if (error) {
          console.error('aio-check insert error:', error)
        } else {
          saved = data as MeoAioCheck
        }
      }
    }

    return NextResponse.json({
      engine: 'claude',
      query: query.trim(),
      mentioned: result.mentioned,
      rank: result.rank,
      snippet: result.snippet,
      answer,
      saved: saved !== null,
      check: saved,
    })
  } catch (e) {
    console.error('aio-check error:', e)
    const raw = e instanceof Error ? e.message : ''
    const msg = raw.includes('authentication_error')
      ? 'ANTHROPIC_API_KEY が無効です。.env.local に有効なAPIキーを設定してください。'
      : raw || 'AIOチェックに失敗しました'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
