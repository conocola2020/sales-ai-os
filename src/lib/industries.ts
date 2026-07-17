/**
 * 業種マスタと表記揺れの正規化。
 *
 * leads.industry は自由テキストなので、「サウナ・温浴施設」「喫茶店」のような
 * 揺れを正規名に変換してから業種別の文面プロファイルを選択する。
 */

export const INDUSTRIES = [
  'サウナ', '美容サロン', 'カフェ', '中華', '焼肉', 'フレンチ', 'イタリアン',
  'キッチンカー', '雑貨屋', 'スーパーマーケット', '百貨店', '高級食品スーパー',
  'お土産屋',
] as const

export type Industry = (typeof INDUSTRIES)[number]

/**
 * シノニム（部分一致）。順序が重要:
 * - 「高級食品スーパー」は「スーパーマーケット」より先に判定
 * - 「スーパー銭湯」が「スーパー」に食われないよう、サウナ系はスーパーより先
 * - 汎用的な語（サロン・スーパー等）を含むグループほど後ろに置く
 */
const SYNONYM_GROUPS: Array<[Industry, string[]]> = [
  ['高級食品スーパー', ['高級スーパー', '高級食品', 'グルメスーパー']],
  ['サウナ', ['サウナ', '温浴', 'スーパー銭湯', '銭湯', 'スパ', '温泉']],
  ['キッチンカー', ['キッチンカー', 'フードトラック', '移動販売', '屋台']],
  ['カフェ', ['カフェ', '喫茶', '珈琲', 'コーヒー', 'coffee', 'cafe']],
  ['中華', ['中華', '中国料理', '餃子', '点心', '町中華']],
  ['焼肉', ['焼肉', '焼き肉', 'ホルモン']],
  ['フレンチ', ['フレンチ', 'フランス料理', 'ビストロ']],
  ['イタリアン', ['イタリアン', 'イタリア料理', 'ピザ', 'パスタ', 'トラットリア', 'ピッツェリア']],
  ['雑貨屋', ['雑貨', 'セレクトショップ', 'ギフトショップ', 'ライフスタイルショップ']],
  ['百貨店', ['百貨店', 'デパート']],
  ['お土産屋', ['土産', '物産', '観光売店', 'アンテナショップ']],
  ['美容サロン', ['美容', 'ヘアサロン', 'エステ', 'ネイル', 'まつげ', 'リラクゼーション', 'マッサージ', 'サロン']],
  ['スーパーマーケット', ['スーパー', '食品スーパー', 'マーケット']],
]

/**
 * 表記揺れを正規名に変換。マッチしなければ null（呼び出し側で汎用扱いにする）。
 */
export function normalizeIndustry(raw: string | null | undefined): Industry | null {
  if (!raw) return null
  const normalized = raw.normalize('NFKC').toLowerCase().trim()
  if (!normalized) return null

  for (const industry of INDUSTRIES) {
    if (normalized === industry.toLowerCase()) return industry
  }
  for (const [industry, synonyms] of SYNONYM_GROUPS) {
    if (synonyms.some(synonym => normalized.includes(synonym.toLowerCase()))) {
      return industry
    }
  }
  return null
}
