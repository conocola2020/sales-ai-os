export interface BlacklistResult {
  matched: boolean
  reason: string | null
}

interface BlacklistEntry {
  id: string
  patterns: string[]
  matchType: 'exact' | 'contains'
  category: 'chain' | 'fastfood' | 'regional' | 'mall' | 'manga' | 'concept' | 'animal' | 'bookcafe'
}

export const BLACKLIST: BlacklistEntry[] = [
  { id: 'starbucks', patterns: ['スターバックス', 'starbucks'], matchType: 'contains', category: 'chain' },
  { id: 'doutor', patterns: ['ドトール', 'doutor'], matchType: 'contains', category: 'chain' },
  { id: 'tullys', patterns: ['タリーズ', 'tullys', "tully's"], matchType: 'contains', category: 'chain' },
  { id: 'komeda', patterns: ['コメダ珈琲店', 'コメダ珈琲', 'komeda'], matchType: 'contains', category: 'chain' },
  { id: 'ueshima', patterns: ['上島珈琲店', '上島珈琲', 'ucc'], matchType: 'contains', category: 'chain' },
  { id: 'veloce', patterns: ['ベローチェ', 'veloce', 'caffeveloce'], matchType: 'contains', category: 'chain' },
  { id: 'sanmarc', patterns: ['サンマルクカフェ', 'サンマルク'], matchType: 'contains', category: 'chain' },
  { id: 'excelsior', patterns: ['エクセルシオール', 'excelsior'], matchType: 'contains', category: 'chain' },
  { id: 'pronto', patterns: ['プロント', 'pronto'], matchType: 'contains', category: 'chain' },
  { id: 'renoir', patterns: ['ルノアール', 'renoir'], matchType: 'contains', category: 'chain' },
  { id: 'hoshino', patterns: ['星乃珈琲店', '星乃珈琲'], matchType: 'contains', category: 'chain' },
  { id: 'tsubakiya', patterns: ['椿屋珈琲店', '椿屋珈琲'], matchType: 'contains', category: 'chain' },
  { id: 'cafedecrie', patterns: ['カフェドクリエ', 'cafedecrie'], matchType: 'contains', category: 'chain' },
  { id: 'segafredo', patterns: ['セガフレード', 'segafredo'], matchType: 'contains', category: 'chain' },
  { id: 'bluebottle', patterns: ['ブルーボトル', 'bluebottle'], matchType: 'contains', category: 'chain' },
  { id: 'arabica', patterns: ['arabica', 'アラビカ'], matchType: 'contains', category: 'chain' },
  { id: 'chatnoir', patterns: ['シャノアール'], matchType: 'contains', category: 'chain' },
  { id: 'kannocoffee', patterns: ['神乃珈琲'], matchType: 'contains', category: 'chain' },

  { id: 'mcdonalds', patterns: ['マクドナルド', 'mcdonalds', 'マックカフェ', 'mccafe'], matchType: 'contains', category: 'fastfood' },
  { id: 'misterdonut', patterns: ['ミスタードーナツ', 'ミスド', 'misterdonut'], matchType: 'contains', category: 'fastfood' },
  { id: 'kfc', patterns: ['ケンタッキー', 'kfc'], matchType: 'contains', category: 'fastfood' },
  { id: 'familymart', patterns: ['ファミリーマート', 'familymart'], matchType: 'contains', category: 'fastfood' },
  { id: 'seveneleven', patterns: ['セブンイレブン', '7eleven', 'seveneleven'], matchType: 'contains', category: 'fastfood' },
  { id: 'lawson', patterns: ['ローソン', 'lawson'], matchType: 'contains', category: 'fastfood' },

  { id: 'kurashiki', patterns: ['倉式珈琲店', '倉式珈琲'], matchType: 'contains', category: 'regional' },
  { id: 'lamp', patterns: ['コーヒーショップらんぷ', '喫茶らんぷ'], matchType: 'contains', category: 'regional' },

  { id: 'aeon', patterns: ['イオン'], matchType: 'contains', category: 'mall' },
  { id: 'parco', patterns: ['パルコ'], matchType: 'contains', category: 'mall' },

  { id: 'kaikatsu', patterns: ['快活club', '快活クラブ', '快活フロンティア'], matchType: 'contains', category: 'manga' },
  { id: 'jiyukukan', patterns: ['自遊空間'], matchType: 'contains', category: 'manga' },
  { id: 'manboo', patterns: ['マンボー'], matchType: 'contains', category: 'manga' },
  { id: 'popeye', patterns: ['メディアカフェポパイ', 'ポパイ'], matchType: 'contains', category: 'manga' },
  { id: 'apresio', patterns: ['アプレシオ'], matchType: 'contains', category: 'manga' },
  { id: 'geragera', patterns: ['ゲラゲラ'], matchType: 'contains', category: 'manga' },
  { id: 'dice', patterns: ['dice'], matchType: 'exact', category: 'manga' },
  { id: 'anettai', patterns: ['亜熱帯'], matchType: 'contains', category: 'manga' },
  { id: 'netroom', patterns: ['ネットルーム', 'マンガ喫茶', 'インターネットカフェ'], matchType: 'contains', category: 'manga' },

  { id: 'maidcafe', patterns: ['メイドカフェ', 'メイリッシュ', 'ほーむカフェ', 'キュアメイドカフェ'], matchType: 'contains', category: 'concept' },
  { id: 'cosplaycafe', patterns: ['コスプレカフェ'], matchType: 'contains', category: 'concept' },
  { id: 'animatecafe', patterns: ['アニメイトカフェ'], matchType: 'contains', category: 'concept' },
  { id: 'pokemoncafe', patterns: ['ポケモンカフェ'], matchType: 'contains', category: 'concept' },
  { id: 'charactercafe', patterns: ['キャラクターカフェ'], matchType: 'contains', category: 'concept' },

  { id: 'animalcafe', patterns: ['猫カフェ', 'ドッグカフェ', 'うさぎカフェ', 'ふくろうカフェ', 'ハリネズミカフェ', '鳥カフェ', '爬虫類カフェ', '小動物カフェ'], matchType: 'contains', category: 'animal' },

  { id: 'tsutaya', patterns: ['蔦屋書店', 'tsutaya', 'shibuyatsutaya'], matchType: 'contains', category: 'bookcafe' },
  { id: 'bookcafe', patterns: ['ブックカフェ'], matchType: 'contains', category: 'bookcafe' },
  { id: 'junkudo', patterns: ['ジュンク堂カフェ'], matchType: 'contains', category: 'bookcafe' },
  { id: 'kinokuniya', patterns: ['紀伊國屋書店カフェ', '紀伊国屋書店カフェ'], matchType: 'contains', category: 'bookcafe' },
  { id: 'maruzen', patterns: ['丸善カフェ', 'maruzen'], matchType: 'contains', category: 'bookcafe' },
  { id: 'libro', patterns: ['リブロカフェ'], matchType: 'contains', category: 'bookcafe' },
]

export function normalizeName(name: string): string {
  return name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[·・ー－—\-‐_ /\\@%'"`{}[\]()（）「」『』、。,.!?！？]/g, '')
    .replace(/\s+/g, '')
    .trim()
}

export function isBlacklisted(name: string, types?: string[]): BlacklistResult {
  const normalized = normalizeName(name)

  for (const entry of BLACKLIST) {
    for (const pattern of entry.patterns) {
      const normalizedPattern = normalizeName(pattern)
      if (entry.matchType === 'exact' && normalized === normalizedPattern) {
        return { matched: true, reason: `blacklist:${entry.id}` }
      }
      if (entry.matchType === 'contains' && normalized.includes(normalizedPattern)) {
        return { matched: true, reason: `blacklist:${entry.id}` }
      }
    }
  }

  if (types?.includes('fast_food_restaurant')) {
    return { matched: true, reason: 'blacklist:type_fastfood' }
  }

  return { matched: false, reason: null }
}
