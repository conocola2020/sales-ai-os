/**
 * HP構造化データからCONOCOLA向けの事前分析を行うユーティリティ
 * AIコール不要 - キーワードマッチングベース
 */

import type { StructuredHpContent } from './hp-fetcher'

export interface HpAnalysis {
  facilityType: string
  hasDrinkMenu: boolean
  hasFoodMenu: boolean
  hasOriginalDrink: boolean
  hasSaunaMeshi: boolean
  identifiedProblems: string[]
  opportunities: string[]
  summary: string
}

// ---------------------------------------------------------------------------
// Keyword dictionaries
// ---------------------------------------------------------------------------

const DRINK_KEYWORDS = ['ドリンク', '飲み物', 'ジュース', 'コーラ', 'ビール', 'コーヒー', '牛乳', 'オロポ', 'ポカリ', 'イオンウォーター', 'お茶', 'スムージー']
const FOOD_KEYWORDS = ['食事', 'フード', 'ランチ', 'ディナー', 'レストラン', 'カレー', 'ラーメン', '定食', '丼', 'カフェ', '軽食', 'スナック', 'おつまみ']
const ORIGINAL_DRINK_KEYWORDS = ['オリジナル', '限定', '自家製', '手作り', 'クラフト', 'オーガニック', '特製']
const SAUNA_MESHI_KEYWORDS = ['サ飯', 'サウナ飯', 'ととのい飯', 'サウナめし']
const VENDING_KEYWORDS = ['自販機', '自動販売機']

const FACILITY_TYPE_MAP: [string[], string][] = [
  [['スーパー銭湯', 'スパ銭'], 'スーパー銭湯'],
  [['サウナ専門', 'サウナ施設'], 'サウナ専門施設'],
  [['カプセルホテル', 'カプセル'], 'カプセルホテル併設'],
  [['ホテル', '旅館', '宿泊'], 'ホテル・旅館'],
  [['銭湯', '公衆浴場'], '銭湯'],
  [['温泉', '天然温泉'], '温泉施設'],
  [['スパ', 'SPA'], 'スパ・リゾート'],
  [['フィットネス', 'ジム', 'スポーツ'], 'フィットネス併設'],
  [['キャンプ', 'アウトドア', 'グランピング'], 'アウトドアサウナ'],
  [['プライベート', '貸切', '個室'], 'プライベートサウナ'],
]

// ---------------------------------------------------------------------------
// Analysis functions
// ---------------------------------------------------------------------------

function detectFacilityType(content: StructuredHpContent): string {
  const allText = [content.title, content.description, content.bodyText].join(' ').toLowerCase()

  for (const [keywords, type] of FACILITY_TYPE_MAP) {
    if (keywords.some(kw => allText.includes(kw.toLowerCase()))) {
      return type
    }
  }

  if (allText.includes('サウナ')) return 'サウナ施設'
  return '温浴施設'
}

function checkKeywordsPresent(texts: string[], keywords: string[]): boolean {
  const combined = texts.join(' ')
  return keywords.some(kw => combined.includes(kw))
}

function identifyProblems(content: StructuredHpContent, hasDrink: boolean, hasFood: boolean, hasOriginal: boolean): string[] {
  const problems: string[] = []
  const allText = [content.bodyText, ...content.menuInfo].join(' ')
  const hasVending = VENDING_KEYWORDS.some(kw => allText.includes(kw))

  // ドリンク関連
  if (!hasDrink) {
    problems.push('ドリンクメニューの記載がなく、サウナ後の飲料体験を提供できていない可能性')
  } else if (hasVending && !hasOriginal) {
    problems.push('ドリンクが自販機中心で、施設オリジナルの付加価値のあるドリンクがない')
  } else if (!hasOriginal) {
    problems.push('一般的なドリンクのみで、サウナ体験に特化した差別化ドリンクがない')
  }

  // フード関連
  if (!hasFood) {
    problems.push('フードメニューの記載がなく、サウナ後の食事ニーズ（サ飯）に対応できていない')
  }

  // 差別化
  if (!hasOriginal && !checkKeywordsPresent([allText], SAUNA_MESHI_KEYWORDS)) {
    problems.push('SNS映えする目玉商品やサウナーに刺さるオリジナル商品がない')
  }

  // 客単価
  if (!hasDrink && !hasFood) {
    problems.push('飲食による客単価向上の余地が大きい（サウナ後の滞在時間を収益化できていない）')
  }

  // オペレーション
  if (!hasFood && content.facilityInfo.length > 0) {
    problems.push('キッチン設備やスタッフの制約で、フードメニュー拡充が難しい可能性')
  }

  return problems.slice(0, 4) // Max 4 problems
}

function identifyOpportunities(content: StructuredHpContent, hasDrink: boolean, hasFood: boolean): string[] {
  const opportunities: string[] = []

  if (!hasDrink || !checkKeywordsPresent([content.bodyText], ORIGINAL_DRINK_KEYWORDS)) {
    opportunities.push('サウナー専用コーラの導入で、サウナ後の特別なドリンク体験を提供')
  }

  if (!hasFood) {
    opportunities.push('冷凍サ飯の導入で、キッチン不要で本格フードメニューを追加')
  }

  if (content.snsLinks.length > 0) {
    opportunities.push('SNS活用中の施設 → サウナーコーラのSNS映えで集客アップ')
  }

  const allText = content.bodyText
  if (allText.includes('リニューアル') || allText.includes('オープン') || allText.includes('新規')) {
    opportunities.push('リニューアル・新規オープンのタイミングで新メニュー導入の好機')
  }

  return opportunities.slice(0, 3)
}

// ---------------------------------------------------------------------------
// Main Analysis
// ---------------------------------------------------------------------------

export function analyzeForConocola(content: StructuredHpContent): HpAnalysis {
  const facilityType = detectFacilityType(content)
  const menuTexts = [...content.menuInfo, content.bodyText]
  const allTexts = [content.title, content.description, ...content.menuInfo, content.bodyText, ...content.additionalPages.map(p => p.text)]

  const hasDrinkMenu = checkKeywordsPresent(menuTexts, DRINK_KEYWORDS)
  const hasFoodMenu = checkKeywordsPresent(menuTexts, FOOD_KEYWORDS)
  const hasOriginalDrink = checkKeywordsPresent(allTexts, ORIGINAL_DRINK_KEYWORDS)
  const hasSaunaMeshi = checkKeywordsPresent(allTexts, SAUNA_MESHI_KEYWORDS)

  const identifiedProblems = identifyProblems(content, hasDrinkMenu, hasFoodMenu, hasOriginalDrink)
  const opportunities = identifyOpportunities(content, hasDrinkMenu, hasFoodMenu)

  // Summary
  const summaryParts: string[] = []
  summaryParts.push(`${facilityType}。`)
  if (hasDrinkMenu) summaryParts.push('ドリンクメニューあり。')
  else summaryParts.push('ドリンクメニュー未確認。')
  if (hasFoodMenu) summaryParts.push('フードメニューあり。')
  else summaryParts.push('フードメニュー未確認。')
  if (hasOriginalDrink) summaryParts.push('オリジナル商品あり。')
  if (identifiedProblems.length > 0) {
    summaryParts.push(`主な課題: ${identifiedProblems[0]}`)
  }

  return {
    facilityType,
    hasDrinkMenu,
    hasFoodMenu,
    hasOriginalDrink,
    hasSaunaMeshi,
    identifiedProblems,
    opportunities,
    summary: summaryParts.join(' '),
  }
}

/**
 * 分析結果をプロンプト用テキストに変換
 */
export function formatAnalysis(analysis: HpAnalysis): string {
  const parts: string[] = []

  parts.push('【HP事前分析（自動）】')
  parts.push(`施設タイプ: ${analysis.facilityType}`)
  parts.push(`ドリンクメニュー: ${analysis.hasDrinkMenu ? 'あり' : '未確認'}`)
  parts.push(`フードメニュー: ${analysis.hasFoodMenu ? 'あり' : '未確認'}`)
  parts.push(`オリジナルドリンク: ${analysis.hasOriginalDrink ? 'あり' : 'なし'}`)
  parts.push(`サウナ飯: ${analysis.hasSaunaMeshi ? 'あり' : 'なし'}`)

  if (analysis.identifiedProblems.length > 0) {
    parts.push('')
    parts.push('【特定された「不」（課題）】')
    analysis.identifiedProblems.forEach((p, i) => parts.push(`${i + 1}. ${p}`))
  }

  if (analysis.opportunities.length > 0) {
    parts.push('')
    parts.push('【営業チャンス】')
    analysis.opportunities.forEach((o, i) => parts.push(`${i + 1}. ${o}`))
  }

  return parts.join('\n')
}
