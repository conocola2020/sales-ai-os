// MEO/AIOモジュールのプロンプト定義（docs/meo-aio-spec.md 4章に対応）

import type { MeoLocation, MeoReview } from '@/types/meo'

export type ReplyTone = '丁寧' | 'フレンドリー' | '簡潔'

export const REVIEW_REPLY_SYSTEM_PROMPT = `あなたは飲食店の口コミ返信を専門とするプロのカスタマーサポート担当です。
Googleビジネスプロフィールの口コミに対する返信文を1つだけ生成してください。

ルール:
- 冒頭で来店と口コミへの感謝を必ず述べる
- 口コミ本文の具体的な内容（メニュー名・体験）に必ず1箇所以上触れる
- 星4以上: 喜びを伝え、再来店を促す一言で締める
- 星3以下: 真摯に謝罪し、指摘内容への具体的な改善姿勢を示す。言い訳をしない
- 150〜300字、絵文字・顔文字・記号装飾は使わない
- 店舗のMEOに有効なため、店名と主力メニュー名を自然に1回含める
- 返信文のみを出力する（前置き・説明は不要）`

export function buildReviewReplyUserPrompt(
  location: Pick<MeoLocation, 'name' | 'category' | 'address'>,
  review: Pick<MeoReview, 'author' | 'rating' | 'body'>,
  tone: ReplyTone
): string {
  return `【店舗情報】
店名: ${location.name}
業態: ${location.category ?? '飲食店'}
所在地: ${location.address ?? '不明'}

【口コミ】
投稿者: ${review.author ?? '匿名'}
評価: ${review.rating ?? '不明'} / 5
本文: ${review.body ?? '（本文なし）'}

【トーン】${tone}`
}

export const AIO_CHECK_SYSTEM_PROMPT = `あなたは日本のローカル検索アシスタントです。
ユーザーの質問に対し、実在するおすすめの店舗を5件、
店名・特徴・おすすめ理由つきの番号付きリストで回答してください。
知識にない店舗を創作してはいけません。確信が持てない場合は件数を減らしてください。`

// 店舗名の表記ゆれを含めた言及判定
export function detectMention(
  answer: string,
  locationName: string,
  aliases: string[] = []
): { mentioned: boolean; rank: number | null; snippet: string | null } {
  const names = [locationName, ...aliases].filter(Boolean)
  const normalized = answer.normalize('NFKC')

  let hitIndex = -1
  let hitName = ''
  for (const name of names) {
    const idx = normalized.indexOf(name.normalize('NFKC'))
    if (idx >= 0 && (hitIndex === -1 || idx < hitIndex)) {
      hitIndex = idx
      hitName = name
    }
  }

  if (hitIndex === -1) return { mentioned: false, rank: null, snippet: null }

  // 番号付きリストの何番目に登場したかを推定
  const before = normalized.slice(0, hitIndex)
  const listMarkers = before.match(/^\s*\d+[.．、)）]/gm)
  const rank = listMarkers ? listMarkers.length : null

  const start = Math.max(0, hitIndex - 20)
  const snippet = normalized.slice(start, Math.min(normalized.length, hitIndex + hitName.length + 80))

  return { mentioned: true, rank, snippet }
}
