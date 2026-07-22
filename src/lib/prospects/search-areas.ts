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
  // 全国主要都市（高級業態が集中する繁華街ベース）
  'japan-major': [
    { id: 'ginza', label: '銀座', group: 'tokyo', maxCount: 200 },
    { id: 'roppongi', label: '六本木', group: 'tokyo', maxCount: 200 },
    { id: 'azabu', label: '麻布', group: 'tokyo', maxCount: 200 },
    { id: 'omotesando', label: '表参道', group: 'tokyo', maxCount: 200 },
    { id: 'ebisu', label: '恵比寿', group: 'tokyo', maxCount: 200 },
    { id: 'marunouchi', label: '丸の内', group: 'tokyo', maxCount: 200 },
    { id: 'nihonbashi', label: '日本橋', group: 'tokyo', maxCount: 200 },
    { id: 'akasaka', label: '赤坂', group: 'tokyo', maxCount: 200 },
    { id: 'shinjuku', label: '新宿', group: 'tokyo', maxCount: 200 },
    { id: 'shibuya', label: '渋谷', group: 'tokyo', maxCount: 200 },
    { id: 'kagurazaka', label: '神楽坂', group: 'tokyo', maxCount: 200 },
    { id: 'yokohama', label: '横浜', group: 'kanagawa', maxCount: 120 },
    { id: 'sapporo', label: '札幌', group: 'hokkaido', maxCount: 120 },
    { id: 'sendai', label: '仙台', group: 'tohoku', maxCount: 100 },
    { id: 'kanazawa', label: '金沢', group: 'hokuriku', maxCount: 100 },
    { id: 'karuizawa', label: '軽井沢', group: 'nagano', maxCount: 60 },
    { id: 'nagoya-sakae', label: '名古屋市 栄', group: 'nagoya', maxCount: 100 },
    { id: 'nagoya-meieki', label: '名古屋市 名駅', group: 'nagoya', maxCount: 100 },
    { id: 'kyoto-gion', label: '京都 祇園', group: 'kyoto', maxCount: 150 },
    { id: 'kyoto-shijo', label: '京都 四条', group: 'kyoto', maxCount: 150 },
    { id: 'osaka-kitashinchi', label: '大阪 北新地', group: 'osaka', maxCount: 150 },
    { id: 'osaka-umeda', label: '大阪 梅田', group: 'osaka', maxCount: 150 },
    { id: 'osaka-shinsaibashi', label: '大阪 心斎橋', group: 'osaka', maxCount: 150 },
    { id: 'kobe-sannomiya', label: '神戸 三宮', group: 'hyogo', maxCount: 100 },
    { id: 'hiroshima', label: '広島', group: 'chugoku', maxCount: 100 },
    { id: 'takamatsu', label: '高松', group: 'shikoku', maxCount: 60 },
    { id: 'fukuoka-tenjin', label: '福岡 天神', group: 'fukuoka', maxCount: 120 },
    { id: 'fukuoka-hakata', label: '福岡 博多', group: 'fukuoka', maxCount: 120 },
    { id: 'kumamoto', label: '熊本', group: 'kyushu', maxCount: 60 },
    { id: 'kagoshima', label: '鹿児島', group: 'kyushu', maxCount: 60 },
    { id: 'naha', label: '那覇', group: 'okinawa', maxCount: 60 },
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
