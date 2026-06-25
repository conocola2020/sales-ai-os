import type { SearchAreaConfig } from './types'

export const NAGOYA_WARDS = [
  '千種区', '東区', '北区', '西区', '中村区', '中区', '昭和区', '瑞穂区',
  '熱田区', '中川区', '港区', '南区', '守山区', '緑区', '名東区', '天白区',
] as const

export const AICHI_MAJOR_CITIES_VOL1 = [
  '豊田市', '岡崎市', '一宮市', '春日井市', '豊橋市',
  '瀬戸市', '刈谷市', '安城市', '小牧市',
] as const

export const SEARCH_AREAS: Record<string, SearchAreaConfig[]> = {
  'nagoya-naka': [
    { id: 'nagoya-naka', prefecture: '愛知県', textQuery: 'カフェ 名古屋市中区', group: 'nagoya-naka', maxCount: 50 },
    { id: 'nagoya-naka-coffee', prefecture: '愛知県', textQuery: 'コーヒー 名古屋市中区', group: 'nagoya-naka', maxCount: 50 },
  ],

  'aichi-vol1': [
    ...NAGOYA_WARDS.flatMap(ward => [
      { id: `nagoya-${ward}`, prefecture: '愛知県', textQuery: `カフェ 名古屋市${ward}`, group: 'nagoya', maxCount: 700 },
      { id: `nagoya-${ward}-coffee`, prefecture: '愛知県', textQuery: `コーヒー 名古屋市${ward}`, group: 'nagoya', maxCount: 700 },
    ]),
    { id: 'toyota', prefecture: '愛知県', textQuery: 'カフェ 豊田市', group: 'toyota', maxCount: 80 },
    { id: 'toyota-coffee', prefecture: '愛知県', textQuery: 'コーヒー 豊田市', group: 'toyota', maxCount: 80 },
    { id: 'okazaki', prefecture: '愛知県', textQuery: 'カフェ 岡崎市', group: 'okazaki', maxCount: 60 },
    { id: 'okazaki-coffee', prefecture: '愛知県', textQuery: 'コーヒー 岡崎市', group: 'okazaki', maxCount: 60 },
    { id: 'ichinomiya', prefecture: '愛知県', textQuery: 'カフェ 一宮市', group: 'ichinomiya', maxCount: 30 },
    { id: 'ichinomiya-coffee', prefecture: '愛知県', textQuery: 'コーヒー 一宮市', group: 'ichinomiya', maxCount: 30 },
    { id: 'kasugai', prefecture: '愛知県', textQuery: 'カフェ 春日井市', group: 'kasugai', maxCount: 30 },
    { id: 'kasugai-coffee', prefecture: '愛知県', textQuery: 'コーヒー 春日井市', group: 'kasugai', maxCount: 30 },
    { id: 'toyohashi', prefecture: '愛知県', textQuery: 'カフェ 豊橋市', group: 'toyohashi', maxCount: 50 },
    { id: 'toyohashi-coffee', prefecture: '愛知県', textQuery: 'コーヒー 豊橋市', group: 'toyohashi', maxCount: 50 },
    { id: 'seto', prefecture: '愛知県', textQuery: 'カフェ 瀬戸市', group: 'other', maxCount: 50 },
    { id: 'seto-coffee', prefecture: '愛知県', textQuery: 'コーヒー 瀬戸市', group: 'other', maxCount: 50 },
    { id: 'kariya', prefecture: '愛知県', textQuery: 'カフェ 刈谷市', group: 'other', maxCount: 50 },
    { id: 'kariya-coffee', prefecture: '愛知県', textQuery: 'コーヒー 刈谷市', group: 'other', maxCount: 50 },
    { id: 'anjo', prefecture: '愛知県', textQuery: 'カフェ 安城市', group: 'other', maxCount: 50 },
    { id: 'anjo-coffee', prefecture: '愛知県', textQuery: 'コーヒー 安城市', group: 'other', maxCount: 50 },
    { id: 'komaki', prefecture: '愛知県', textQuery: 'カフェ 小牧市', group: 'other', maxCount: 50 },
    { id: 'komaki-coffee', prefecture: '愛知県', textQuery: 'コーヒー 小牧市', group: 'other', maxCount: 50 },
  ],
}
