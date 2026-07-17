import type { SearchAreaConfig } from './types'
import type { IndustryConfig } from './industry-configs'

export const NAGOYA_WARDS = [
  '千種区', '東区', '北区', '西区', '中村区', '中区', '昭和区', '瑞穂区',
  '熱田区', '中川区', '港区', '南区', '守山区', '緑区', '名東区', '天白区',
] as const

export const AICHI_MAJOR_CITIES_VOL1 = [
  '豊田市', '岡崎市', '一宮市', '春日井市', '豊橋市',
  '瀬戸市', '刈谷市', '安城市', '小牧市',
] as const

interface AreaLocation {
  id: string
  label: string
  group: string
  maxCount: number
}

/** エリアセット（業種非依存のロケーション定義） */
const AREA_LOCATIONS: Record<string, AreaLocation[]> = {
  'nagoya-naka': [
    { id: 'nagoya-naka', label: '名古屋市中区', group: 'nagoya-naka', maxCount: 50 },
  ],
  'aichi-vol1': [
    ...NAGOYA_WARDS.map(ward => ({
      id: `nagoya-${ward}`,
      label: `名古屋市${ward}`,
      group: 'nagoya',
      maxCount: 700,
    })),
    { id: 'toyota', label: '豊田市', group: 'toyota', maxCount: 80 },
    { id: 'okazaki', label: '岡崎市', group: 'okazaki', maxCount: 60 },
    { id: 'ichinomiya', label: '一宮市', group: 'ichinomiya', maxCount: 30 },
    { id: 'kasugai', label: '春日井市', group: 'kasugai', maxCount: 30 },
    { id: 'toyohashi', label: '豊橋市', group: 'toyohashi', maxCount: 50 },
    { id: 'seto', label: '瀬戸市', group: 'other', maxCount: 50 },
    { id: 'kariya', label: '刈谷市', group: 'other', maxCount: 50 },
    { id: 'anjo', label: '安城市', group: 'other', maxCount: 50 },
    { id: 'komaki', label: '小牧市', group: 'other', maxCount: 50 },
  ],
}

export function availableAreas(): string[] {
  return Object.keys(AREA_LOCATIONS)
}

/**
 * 業種の検索キーワード × エリアのロケーションで検索クエリ一覧を生成する。
 * 例: 焼肉 × aichi-vol1 → 「焼肉 名古屋市中区」「ホルモン 名古屋市中区」...
 */
export function buildSearchAreas(industry: IndustryConfig, areaKey: string): SearchAreaConfig[] | null {
  const locations = AREA_LOCATIONS[areaKey]
  if (!locations) return null

  return locations.flatMap(location =>
    industry.searchKeywords.map((keyword, index) => ({
      id: index === 0 ? location.id : `${location.id}-k${index + 1}`,
      prefecture: '愛知県',
      textQuery: `${keyword} ${location.label}`,
      group: location.group,
      maxCount: location.maxCount,
    }))
  )
}
