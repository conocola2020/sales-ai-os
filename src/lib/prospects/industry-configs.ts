/**
 * 業種別の収集設定（Phase 2B）
 *
 * 収集の業種差分（検索キーワード・Placesタイプ・除外チェーン）をここに集約する。
 * 収集エンジン（scripts/fetch-prospects.ts）は業種を知らず、この設定だけを見る。
 *
 * 出典: docs/phase2b-generalize-prospect-collection-design.md
 * ⚠️ まだ設定がない業種（雑貨屋・お土産屋・高級食品スーパー等）は精度の工夫が要るため
 *    未実装。キッチンカーは Places に適切なタイプがなく対象外、サウナは既存の
 *    sauna-ikitai 収集パイプラインを使う。
 */

import { CAFE_BLACKLIST, type BlacklistEntry } from './blacklist'

export interface IndustryConfig {
  /** prospects.industry / leads.industry に入る正規名（src/lib/industries.ts と揃える） */
  id: string
  /** テキスト検索キーワード（各エリア × 各キーワードでクエリ発行） */
  searchKeywords: string[]
  /** 採用対象の Google Places タイプ */
  placesTypes: string[]
  /** 除外チェーン等 */
  blacklist: BlacklistEntry[]
}

const chain = (id: string, ...patterns: string[]): BlacklistEntry => ({
  id,
  patterns,
  matchType: 'contains',
  category: 'chain',
})

export const INDUSTRY_CONFIGS: Record<string, IndustryConfig> = {
  カフェ: {
    id: 'カフェ',
    searchKeywords: ['カフェ', 'コーヒー'],
    placesTypes: ['cafe', 'coffee_shop'],
    blacklist: CAFE_BLACKLIST,
  },

  焼肉: {
    id: '焼肉',
    searchKeywords: ['焼肉', 'ホルモン'],
    // yakiniku_restaurant は実データで確認済みの専用タイプ（2026-07 名古屋中区の全件がこれ）
    placesTypes: ['yakiniku_restaurant', 'barbecue_restaurant', 'korean_restaurant', 'restaurant'],
    blacklist: [
      chain('gyukaku', '牛角'),
      chain('anrakutei', '安楽亭'),
      chain('yakinikuking', '焼肉きんぐ'),
      chain('jojoen', '叙々苑'),
      chain('anan', '安安', '七輪焼肉安安'),
      chain('jonetsu-horumon', '情熱ホルモン'),
      chain('shichirinbo', '七輪房'),
      chain('karubi-taisho', 'カルビ大将'),
      chain('gyudon', '吉野家', 'すき家', '松屋'),
      chain('warayakiya', 'ワタミ'),
    ],
  },

  中華: {
    id: '中華',
    searchKeywords: ['中華料理', '町中華'],
    placesTypes: ['chinese_restaurant', 'ramen_restaurant', 'restaurant'],
    blacklist: [
      chain('ohsho', '餃子の王将', '大阪王将'),
      chain('bamiyan', 'バーミヤン'),
      chain('hidakaya', '日高屋'),
      chain('kourakuen', '幸楽苑'),
      chain('benitora', '紅虎餃子房'),
      chain('ringerhut', 'リンガーハット'),
      chain('gyozanomanshu', '餃子の満洲'),
    ],
  },

  イタリアン: {
    id: 'イタリアン',
    searchKeywords: ['イタリアン', 'ピザ'],
    placesTypes: ['italian_restaurant', 'pizza_restaurant', 'restaurant'],
    blacklist: [
      chain('saizeriya', 'サイゼリヤ'),
      chain('capricciosa', 'カプリチョーザ'),
      chain('pizzala', 'ピザーラ'),
      chain('dominos', 'ドミノ', 'domino'),
      chain('pizzahut', 'ピザハット'),
      chain('goemon', '五右衛門'),
      chain('jolly-pasta', 'ジョリーパスタ'),
      chain('popolamama', 'ポポラマーマ'),
    ],
  },

  フレンチ: {
    id: 'フレンチ',
    searchKeywords: ['フレンチ', 'ビストロ'],
    placesTypes: ['french_restaurant', 'restaurant'],
    // フレンチは大手チェーンが少なく基本は個店採用
    blacklist: [],
  },

  美容サロン: {
    id: '美容サロン',
    searchKeywords: ['美容室', 'ネイルサロン', 'エステ'],
    placesTypes: ['hair_salon', 'beauty_salon', 'nail_salon', 'hair_care'],
    blacklist: [
      chain('qbhouse', 'qbハウス', 'qbhouse'),
      chain('taya', 'taya', '田谷'),
      chain('ash', 'ash'),
      chain('earth', 'earth', 'アース'),
      chain('agu', 'agu'),
      chain('11cut', '11cut', 'イレブンカット'),
      chain('plage', 'プラージュ'),
      chain('cutfactory', 'カットファクトリー'),
      chain('choki', 'チョキペタ'),
    ],
  },
}

export function getIndustryConfig(industry: string): IndustryConfig | null {
  return INDUSTRY_CONFIGS[industry] ?? null
}

export function availableIndustries(): string[] {
  return Object.keys(INDUSTRY_CONFIGS)
}
