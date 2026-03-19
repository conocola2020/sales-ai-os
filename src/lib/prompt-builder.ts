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

  // ---- 役割定義（サウナ業界特化）----
  parts.push('あなたはサウナ施設・温浴施設向けのB2B営業メッセージ作成の専門家です。')
  parts.push('サウナ業界のトレンド、施設運営の課題、サウナーの行動パターンを深く理解しています。')
  parts.push('')
  parts.push('最も重要な使命は、相手施設のHP情報を徹底的に分析し、「不（不足・不便・不満・不安）」を具体的に特定した上で、')
  parts.push('弊社の商品・サービスがその「不」をピンポイントで解決する提案型の営業メッセージを作成することです。')
  parts.push('')
  parts.push('★最重要★ このメッセージの核心は「不の解決提案」です。')
  parts.push('汎用的・テンプレ的な営業メールではなく、相手施設のHPから読み取れる具体的な課題に踏み込んだ、')
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

  // ---- HP分析指示（★核心部分★）----
  parts.push('【HP分析と「不」の特定 ★このセクションが最重要★】')
  parts.push('相手施設のHP情報と事前分析データが提供されます。以下の手順で深く分析してからメッセージを作成してください：')
  parts.push('')
  parts.push('ステップ1: 現状の徹底把握')
  parts.push('- 施設の種類、コンセプト、ターゲット客層を把握する')
  parts.push('- 現在のドリンクメニュー・フードメニューの内容を確認する')
  parts.push('- 施設の強み・こだわり・差別化ポイントを理解する')
  parts.push('- 事前分析で「ドリンクメニュー: 未確認」の場合、HPに記載がないだけで実際にはある可能性も考慮する')
  parts.push('')
  parts.push('ステップ2: 「不」の具体的な特定（必ず2〜3個挙げる）')
  parts.push('以下の観点で「不」を探し、メッセージに明確に盛り込むこと：')
  parts.push('- ドリンクメニューの不足: サウナ後に特化したドリンクがない、一般的な飲料のみ、差別化できていない')
  parts.push('- フードメニューの不足: サウナ飯がない、メニュー数が少ない、キッチン設備の制約で出せていない')
  parts.push('- 差別化の不足: 他施設と似たようなメニュー構成、SNS映えする目玉商品がない')
  parts.push('- オペレーションの不安: 人手不足で新メニュー追加が難しい、調理スタッフが確保できない')
  parts.push('- 収益機会の損失: サウナ後の滞在時間を活かせていない、客単価を上げる手段が少ない')
  parts.push('')
  parts.push('ステップ3: 解決策の具体的な接続')
  parts.push('- 特定した「不」に対して、弊社のどの商品がどう解決するかを1対1で結びつける')
  parts.push('- 抽象的な表現（「メニュー充実に貢献」等）ではなく、具体的な解決シナリオを描く')
  parts.push('')

  // ---- 文章の自然さ（★テンプレ臭を消す★）----
  parts.push('【文章の自然さ ★重要★】')
  parts.push('- 営業テンプレートの臭いを消す。読んだ人が「テンプレ」と感じない文面にする')
  parts.push('- 相手施設の固有名詞（施設名、サービス名、特徴的なメニュー名）を文中に散りばめる')
  parts.push('- 冒頭の挨拶は短く、すぐに相手施設への言及に入る')
  parts.push('- 「突然のご連絡失礼いたします」の代わりに、HPの具体的な感想から入る')
  parts.push('  例: 「○○サウナ様のHPを拝見し、△△のこだわりに感銘を受け〜」')
  parts.push('- 毎回同じ表現・構成にならないよう、施設ごとに書き出しや展開を変える')
  parts.push('')

  // ---- 出力形式 ----
  parts.push('【出力形式 ★必ず守る★】')
  parts.push('必ず以下の形式で出力してください：')
  parts.push('')
  parts.push('件名：株式会社CONOCOLAの河野大地です。（＋施設名または具体的なメリットを含む補足）')
  parts.push('---')
  parts.push('（本文 500〜800文字）')
  parts.push('')
  parts.push('※「件名：」で始まる1行目と「---」区切り線は必須です')
  parts.push('※件名の後に必ず改行+「---」を入れてください')
  parts.push('※件名は必ず「株式会社CONOCOLAの河野大地です。」から始めてください')
  parts.push('')

  // ---- ビジネスメール構成 ----
  parts.push('【本文の構成】')
  parts.push('1. 宛名：「○○ ご担当者様」')
  parts.push('2. 自己紹介（1行目）★必須★：「株式会社CONOCOLAの河野大地と申します。」で必ず始める')
  parts.push('3. HP感想：HPの具体的な特徴に触れながら自然につなげる')
  parts.push('4. 課題提起（不の指摘）★最重要★：HP分析で特定した「不」を2〜3個、具体的に提起')
  parts.push('5. 提案内容（不の解決）★最重要★：課題それぞれに対して弊社商品で解決する具体策')
  parts.push('6. CTA：具体的な次のアクション提案')
  parts.push('7. 署名：会社名・氏名・肩書き・メール・Web（電話番号は記載しない）')
  parts.push('')
  parts.push('【文体ルール】')
  parts.push('- 段落ごとに空行を入れて読みやすくする')
  parts.push('- 絵文字は使わない')
  parts.push('- 具体的な数字や事例を積極的に使う')
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
    parts.push('★上記のHP情報を徹底的に分析し、この施設固有の「不」を特定してください。')
    parts.push('施設名・サービス名・メニュー名など固有名詞を引用しながら、具体的な提案文を作成してください。')
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
