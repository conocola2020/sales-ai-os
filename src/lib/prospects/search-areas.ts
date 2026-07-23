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

  // 全国カバー第2弾: japan-major に含まれない残り30県の中心都市
  'japan-pref-rest': [
    { id: 'aomori', label: '青森市', group: 'aomori', maxCount: 60 },
    { id: 'morioka', label: '盛岡', group: 'iwate', maxCount: 60 },
    { id: 'akita', label: '秋田市', group: 'akita', maxCount: 60 },
    { id: 'yamagata', label: '山形市', group: 'yamagata', maxCount: 60 },
    { id: 'koriyama', label: '郡山', group: 'fukushima', maxCount: 60 },
    { id: 'mito', label: '水戸', group: 'ibaraki', maxCount: 60 },
    { id: 'utsunomiya', label: '宇都宮', group: 'tochigi', maxCount: 60 },
    { id: 'takasaki', label: '高崎', group: 'gunma', maxCount: 60 },
    { id: 'omiya', label: 'さいたま市 大宮', group: 'saitama', maxCount: 80 },
    { id: 'chiba', label: '千葉市', group: 'chiba', maxCount: 80 },
    { id: 'niigata', label: '新潟市', group: 'niigata', maxCount: 80 },
    { id: 'toyama', label: '富山市', group: 'toyama', maxCount: 60 },
    { id: 'fukui', label: '福井市', group: 'fukui', maxCount: 60 },
    { id: 'kofu', label: '甲府', group: 'yamanashi', maxCount: 60 },
    { id: 'gifu', label: '岐阜市', group: 'gifu', maxCount: 60 },
    { id: 'shizuoka', label: '静岡市', group: 'shizuoka', maxCount: 60 },
    { id: 'hamamatsu', label: '浜松', group: 'shizuoka', maxCount: 60 },
    { id: 'yokkaichi', label: '四日市', group: 'mie', maxCount: 60 },
    { id: 'otsu', label: '大津', group: 'shiga', maxCount: 60 },
    { id: 'nara', label: '奈良市', group: 'nara', maxCount: 60 },
    { id: 'wakayama', label: '和歌山市', group: 'wakayama', maxCount: 60 },
    { id: 'tottori', label: '鳥取市', group: 'tottori', maxCount: 60 },
    { id: 'matsue', label: '松江', group: 'shimane', maxCount: 60 },
    { id: 'okayama', label: '岡山市', group: 'okayama', maxCount: 80 },
    { id: 'shimonoseki', label: '下関', group: 'yamaguchi', maxCount: 60 },
    { id: 'tokushima', label: '徳島市', group: 'tokushima', maxCount: 60 },
    { id: 'matsuyama', label: '松山', group: 'ehime', maxCount: 60 },
    { id: 'kochi', label: '高知市', group: 'kochi', maxCount: 60 },
    { id: 'saga', label: '佐賀市', group: 'saga', maxCount: 60 },
    { id: 'nagasaki', label: '長崎市', group: 'nagasaki', maxCount: 60 },
    { id: 'oita', label: '大分市', group: 'oita', maxCount: 60 },
    { id: 'miyazaki', label: '宮崎市', group: 'miyazaki', maxCount: 60 },
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
