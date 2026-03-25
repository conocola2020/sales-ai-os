/**
 * 営業メッセージ生成用プロンプトビルダー
 * /api/generate (ストリーミング) と /api/generate-bulk (一括) で共用
 */

import type { Tone } from '@/types/messages'
import type { UserSettings, MessageTemplate } from '@/types/settings'
import { generateCtaWithDates } from '@/lib/date-utils'

// ---------------------------------------------------------------------------
// Tone Instructions
// ---------------------------------------------------------------------------

export const TONE_INSTRUCTIONS: Record<Tone, string> = {
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

// ---------------------------------------------------------------------------
// System Prompt Builder
// ---------------------------------------------------------------------------

export function buildSystemPrompt(
  settings: UserSettings | null,
  template: MessageTemplate | null,
  tone: Tone
): string {
  const parts: string[] = []

  // ---- 役割定義 ----
  parts.push('あなたは天才営業マンです。B2B冷営業メールを1通作成してください。')
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
    if (settings.company_phone) parts.push(`電話: ${settings.company_phone}`)
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

    // CTA（候補日を動的に生成）
    const ctaText = settings.cta_text || generateCtaWithDates()
    parts.push('')
    parts.push(`【デフォルトCTA】\n${ctaText}`)
    parts.push('★重要★ CTA内の候補日・URLは省略・変更せず、必ずそのまま本文に含めてください。候補日の日付と時間帯、日程調整リンクのURLをそのまま記載してください。')
    parts.push('')
  }

  // ---- テンプレート構造 ----
  if (template && template.structure) {
    parts.push('【メッセージ構成テンプレート】')
    parts.push(template.structure)
    parts.push('')
  }

  // ---- 生成ルール ----
  parts.push('【生成ルール ★必ず守る★】')
  parts.push('')
  parts.push('■ 文字数')
  parts.push('- スケジュール部分を除いて400字以内')
  parts.push('- 読了時間：15〜20秒を目安にする')
  parts.push('')
  parts.push('■ 書き出し')
  parts.push('- リサーチした事実（HP情報・分析データから）を1文だけ入れる')
  parts.push('- 「共感しました」で終わらせず、即座に用件につなげる')
  parts.push('')
  parts.push('■ 実績の書き方')
  parts.push('- 2行以内に絞る')
  parts.push('- 必ず「だから相手にこんなメリットがある」という文脈で使う')
  parts.push('- 実績の羅列禁止')
  parts.push('')
  parts.push('■ 主語のルール')
  parts.push('- 「私ども」より「御社」を先に置く')
  parts.push('- YOUメッセージ（相手が得ること）を前面に出す')
  parts.push('')
  parts.push('■ 相手への指摘')
  parts.push('- 相手のビジネスの弱点・課題を断定する表現は使わない')
  parts.push('- 代わりに「掛け合わせることで〜できる」という可能性の文脈にする')
  parts.push('')
  parts.push('■ CTA')
  parts.push('- デフォルトCTAのTimeRexリンクのみ使用')
  parts.push('- 「15分だけ」と明記する')
  parts.push('')

  // ---- 出力形式 ----
  parts.push('【出力形式 ★必ず守る★】')
  parts.push('必ず以下の形式で出力してください：')
  parts.push('')
  parts.push('件名：（相手に刺さる短い件名）')
  parts.push('---')
  parts.push('（本文 400字以内）')
  parts.push('')
  parts.push('※「件名：」で始まる1行目と「---」区切り線は必須です')
  parts.push('※件名の後に必ず改行+「---」を入れてください')
  parts.push('')

  // ---- 本文の構成 ----
  parts.push('【本文の構成】')
  parts.push('1. 宛名：「○○ ご担当者様」')
  parts.push('2. 書き出し：リサーチ事実1文 → すぐに用件へ')
  parts.push('3. 提案：相手の強み × 弊社サービス = 御社のメリット、という文脈')
  parts.push('4. CTA：候補日 + TimeRexリンク（「15分だけ」と明記）')
  parts.push('5. 署名：会社名・氏名・肩書き・メール・Web（電話番号は記載しない）')
  parts.push('')
  parts.push('【文体ルール】')
  parts.push('- 段落ごとに空行を入れて読みやすくする')
  parts.push('- 絵文字は使わない')
  parts.push('- テンプレ臭を消す。相手固有の情報を必ず入れる')
  parts.push('- 毎回同じ表現・構成にならないよう、施設ごとに書き出しや展開を変える')
  parts.push('')

  // ---- トーン ----
  parts.push(TONE_INSTRUCTIONS[tone])

  return parts.join('\n')
}

// ---------------------------------------------------------------------------
// User Prompt Builder
// ---------------------------------------------------------------------------

export function buildUserPrompt(
  lead: Record<string, string | null>,
  tone: Tone,
  customInstructions: string,
  analysis?: Record<string, unknown> | null,
  hpContent?: string | null,
  hpAnalysis?: string | null,
): string {
  const parts = [
    '以下の情報をもとに、営業メッセージを生成してください。',
    '',
    '【対象施設情報】',
    `施設名/会社名: ${lead.company_name ?? '不明'}`,
    lead.contact_name ? `担当者名: ${lead.contact_name}` : null,
    lead.industry ? `業種: ${lead.industry}` : null,
    lead.website_url ? `Webサイト: ${lead.website_url}` : null,
    lead.company_url ? `企業HP: ${lead.company_url}` : null,
    lead.phone ? `電話番号: ${lead.phone}` : null,
    lead.notes ? `備考・メモ: ${lead.notes}` : null,
  ].filter(Boolean) as string[]

  // HP事前分析データ（hp-analyzer.tsによる自動分析）
  if (hpAnalysis) {
    parts.push('', hpAnalysis)
  }

  // 既存の企業分析データ（DB保存分）
  if (analysis) {
    if (analysis.business_summary) {
      parts.push('', '【AI企業分析結果（DB保存分）】')
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
  }

  // HP コンテンツ（構造化テキスト）
  if (hpContent) {
    parts.push('', '【施設HPから取得した情報】')
    parts.push(hpContent)
    parts.push('')
    parts.push('★上記のHP情報から、書き出しに使うリサーチ事実を1つ見つけてください。')
    parts.push('弱点の断定は禁止。「御社の○○と弊社の△△を掛け合わせることで〜できる」という可能性の文脈で提案してください。')
  }

  const instructions = customInstructions?.trim()
    ? `\n\n【追加指示】\n${customInstructions}`
    : ''

  return parts.join('\n') + instructions
}

// ---------------------------------------------------------------------------
// Subject/Body Parser
// ---------------------------------------------------------------------------

/**
 * 生成テキストから件名と本文を分離する
 */
export function parseSubjectAndBody(text: string): { subject: string; body: string } {
  // Pattern 1: 件名：xxx\n---\nbody
  const match = text.match(/^件名[：:](.+?)[\r\n]+---[\r\n]+([\s\S]*)$/m)
  if (match) {
    return { subject: match[1].trim(), body: match[2].trim() }
  }

  // Pattern 2: 件名：xxx\n\nbody (without ---)
  const match2 = text.match(/^件名[：:](.+?)[\r\n]{2,}([\s\S]*)$/m)
  if (match2) {
    return { subject: match2[1].trim(), body: match2[2].trim() }
  }

  // Fallback: no subject found
  return { subject: '', body: text.trim() }
}
