/**
 * Claude APIを使わない営業文生成ロジック。
 * HP取得・キーワード分析結果を、固定テンプレートに差し込んで文章化する。
 */

import type { Tone } from '@/types/messages'
import type { MessageTemplate, UserSettings } from '@/types/settings'
import { generateCtaWithDates } from '@/lib/date-utils'
import { wrapGeneratedText } from '@/lib/message-formatting'
import type { HpAnalysis } from '@/lib/hp-analyzer'
import type { StructuredHpContent } from '@/lib/hp-fetcher'

type LeadLike = Record<string, string | null | undefined>

interface GenerateFreeMessageInput {
  lead: LeadLike
  tone: Tone
  customInstructions?: string
  settings: UserSettings
  template?: MessageTemplate | null
  hpContent?: StructuredHpContent | null
  hpAnalysis?: HpAnalysis | null
}

interface FeatureRule {
  keywords: string[]
  phrase: string
}

interface ResearchSignal {
  keywords: string[]
  evidence: string
  interpretation: string
  bridge: string
}

const FEATURE_RULES: FeatureRule[] = [
  { keywords: ['再び人々が集える空間', '人々が集える空間'], phrase: '再び人々が集える空間をつくるという想い' },
  { keywords: ['治する', '食する', '育む'], phrase: '治する・食する・育むという施設コンセプト' },
  { keywords: ['地下1,000m', '地下 1,000m', '地下1000m', '大深度'], phrase: '地下1,000mの大深度から湧出する温泉' },
  { keywords: ['潮風'], phrase: '潮風を感じるロケーション' },
  { keywords: ['ドライサウナ', '水風呂'], phrase: 'ドライサウナと水風呂を含めた温浴導線' },
  { keywords: ['ライブラリーカフェ', 'OCHACCO'], phrase: '湯上がりにくつろげるカフェ空間' },
  { keywords: ['塩化物・炭酸水素塩泉', '炭酸水素塩泉', 'なめらかでしっとり'], phrase: 'なめらかでしっとりとした湯ざわり' },
  { keywords: ['立山連峰', '富山湾'], phrase: '立山連峰や富山湾を望める眺望' },
  { keywords: ['ヤマ', 'ウミ', 'YAMASIDE', 'UMISIDE'], phrase: '山側と海側で異なる景色を楽しめる浴場設計' },
  { keywords: ['絶景サウナ'], phrase: '景色そのものを体験価値にした絶景サウナ' },
  { keywords: ['瞑想サウナ'], phrase: '内面に集中できる瞑想サウナ' },
  { keywords: ['令和の銭湯'], phrase: '令和の銭湯という明確なコンセプト' },
  { keywords: ['オートロウリュ'], phrase: '定期的なオートロウリュ' },
  { keywords: ['不感温度'], phrase: '不感温度帯の水風呂' },
  { keywords: ['インフィニティ水風呂'], phrase: '景色を眺めながら入れるインフィニティ水風呂' },
  { keywords: ['外気浴'], phrase: 'サウナ後の外気浴まで考えられた動線' },
  { keywords: ['アートワーク', '現代美術', 'アート'], phrase: 'アートと温浴を融合させた非日常感' },
  { keywords: ['無料のドリンクバー', 'ドリンクバー'], phrase: 'スパ前後に使えるラウンジのドリンクバー' },
  { keywords: ['ラウンジ'], phrase: 'スパ前後もくつろげるラウンジ空間' },
  { keywords: ['湯食処', '食事処', 'レストラン'], phrase: '食事処を含めた滞在体験' },
  { keywords: ['サ飯', 'サウナ飯'], phrase: 'サウナ後の食事体験' },
  { keywords: ['24時間'], phrase: 'いつでも利用しやすい24時間営業' },
  { keywords: ['カプセル'], phrase: '宿泊まで一体で楽しめるカプセルホテル併設の体験' },
  { keywords: ['漫画', 'マンガ'], phrase: '長く滞在したくなる休憩スペース' },
  { keywords: ['露天風呂'], phrase: '開放感のある露天風呂' },
  { keywords: ['貸切'], phrase: '貸切利用にも対応できる特別感' },
  { keywords: ['手ぶら'], phrase: '手ぶらで利用できる気軽さ' },
  { keywords: ['ReFa', 'OSAJI', '妥協'], phrase: 'アメニティ一つにも妥協しない姿勢' },
]

const RESEARCH_SIGNAL_RULES: ResearchSignal[] = [
  {
    keywords: ['東日本大震災', '再び人々が集える空間', '集団移転跡地', '新たな賑わい'],
    evidence: '東日本大震災で大きな被害を受けた藤塚地区に、再び人々が集える空間をつくるという想い',
    interpretation: '単なる温浴施設ではなく、地域にもう一度人の流れと賑わいを生み出す場所として設計されている点',
    bridge: 'その大切な体験価値に関わる商品だからこそ、ただ売れるだけでなく、施設の想いに自然に馴染むことを重視したいと感じました。',
  },
  {
    keywords: ['治する', '食する', '育む'],
    evidence: '人の営みに欠かせない「治する」「食する」「育む」という言葉',
    interpretation: '温泉で心身を整え、食で活力を得て、人や地域のつながりを育むという一連の体験を大切にされている点',
    bridge: 'サウナーコーラは「治する」後の一杯として、冷凍サ飯は「食する」体験の選択肢として、貴施設のコンセプトに沿ってご提案できると考えています。',
  },
  {
    keywords: ['地下1,000m', '地下 1,000m', '地下1000m', '大深度', '塩化物・炭酸水素塩泉', 'なめらかでしっとり'],
    evidence: '地下1,000mの大深度から湧出する温泉と、塩化物・炭酸水素塩泉によるなめらかな湯ざわり',
    interpretation: '温泉そのものの質感から湯上がりの余韻まで丁寧に設計されている点',
    bridge: 'その余韻に合わせる一杯も、強い刺激だけではなく、サウナ後の身体に寄り添う設計であることが大切だと感じました。',
  },
  {
    keywords: ['潮風', 'ドライサウナ', '地下水', '水風呂', 'ライブラリーカフェ', 'OCHACCO'],
    evidence: '潮風を感じるロケーション、ドライサウナ、地下水を使った水風呂、湯上がりのカフェ',
    interpretation: '温泉・サウナ・水風呂・カフェを通じて、心身をゆっくり整える流れを作られている点',
    bridge: 'サウナ後に選ぶドリンクもその流れの一部になるため、館内導線に自然に馴染む商品としてご提案できると考えています。',
  },
  {
    keywords: ['リラクゼーション', 'ラクシス', '心とからだ', 'おもてなし'],
    evidence: 'リラクゼーションまで備えた心とからだに寄り添うおもてなし',
    interpretation: '一度の入浴で終わらず、滞在全体を癒しの時間として設計されている点',
    bridge: '無添加・無着色でスパイスと生薬の余韻を残すサウナーコーラは、その癒しの文脈にも合わせやすい一杯です。',
  },
  {
    keywords: ['立山連峰', '富山湾', '地上40m'],
    evidence: '立山連峰や富山湾を望める眺望',
    interpretation: 'サウナ後の外気浴や休憩時間そのものを、非日常の体験価値に変えている点',
    bridge: 'その余韻に合わせる一杯は、単なる喉を潤す飲み物ではなく、体験を締めくくる商品として設計する価値があると感じました。',
  },
  {
    keywords: ['絶景サウナ', '瞑想サウナ', 'アートワーク', '令和の銭湯'],
    evidence: '絶景サウナ・瞑想サウナ・浴室アートワークを組み合わせた世界観',
    interpretation: 'サウナを設備ではなく、感覚を整える一連の体験として設計されている点',
    bridge: '弊社のサウナーコーラも、サウナ後の感覚に寄り添うためにスパイスと生薬の余韻を設計しており、思想の近さを感じました。',
  },
  {
    keywords: ['ReFa', 'OSAJI', 'アメニティ', '妥協'],
    evidence: 'アメニティ一つにも妥協しない姿勢',
    interpretation: '身体に触れるもの、体験を左右する細部まで大切にされている点',
    bridge: '無添加・無着色でサウナ後の身体に寄り添う弊社商品は、その細部へのこだわりに自然に馴染むと考えています。',
  },
  {
    keywords: ['無料のドリンクバー', 'ドリンクバー', 'ラウンジ'],
    evidence: 'スパ前後に使えるラウンジやドリンクバー',
    interpretation: '入浴前後の滞在時間まで施設体験として設計されている点',
    bridge: '無料ドリンクとは別の「選びたくなる一杯」を置くことで、満足度を損なわずに客単価を上げる導線が作れると感じました。',
  },
  {
    keywords: ['湯食処', '食事処', 'レストラン', 'サ飯', 'カレー', '定食'],
    evidence: 'サウナ後の食事まで含めた滞在体験',
    interpretation: 'ととのった後にゆっくり過ごす時間を、施設の収益機会にもつなげられている点',
    bridge: '食事と一緒に選ばれるサウナ後ドリンクとして提案しやすく、既存メニューの体験価値を高められる可能性があります。',
  },
  {
    keywords: ['24時間', 'カプセル', '宿泊'],
    evidence: '24時間利用や宿泊まで含めた受け皿',
    interpretation: '短時間利用だけでなく、長く滞在するお客様の満足度を大切にされている点',
    bridge: '時間帯を問わず提供しやすいボトル/ドリンク商品は、宿泊・休憩を含む施設導線と相性がよいと考えています。',
  },
  {
    keywords: ['貸切', 'プライベート', '個室'],
    evidence: '貸切やプライベート利用にも対応する特別感',
    interpretation: 'お客様に「自分たちだけの体験」として記憶してもらう設計をされている点',
    bridge: '限定感のあるサウナ後ドリンクを合わせることで、体験の記憶に残る接点をもう一つ増やせると感じました。',
  },
  {
    keywords: ['ロウリュ', 'アウフグース', '熱波'],
    evidence: 'ロウリュやアウフグースを含む熱体験',
    interpretation: '発汗後のリカバリーや余韻まで含めて、お客様の満足度が決まる施設である点',
    bridge: 'スパイスと生薬の余韻があるサウナーコーラは、熱体験後の一杯として自然に提案しやすい商品です。',
  },
]

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword))
}

function joinContent(content?: StructuredHpContent | null): string {
  if (!content) return ''
  return [
    content.title,
    content.description,
    ...content.facilityInfo,
    ...content.menuInfo,
    ...content.additionalPages.map((page) => page.text),
    content.bodyText,
  ].filter(Boolean).join('\n')
}

function pickFeatures(content?: StructuredHpContent | null, analysis?: HpAnalysis | null): string[] {
  const text = joinContent(content)
  const features = FEATURE_RULES
    .filter((rule) => includesAny(text, rule.keywords))
    .map((rule) => rule.phrase)

  if (features.length > 0) return [...new Set(features)].slice(0, 3)

  const fallback: string[] = []
  if (analysis?.facilityType) fallback.push(`${analysis.facilityType}としてのサウナ体験`)
  if (analysis?.hasFoodMenu) fallback.push('サウナ後の食事体験')
  if (analysis?.hasDrinkMenu) fallback.push('ドリンクメニューを含めた滞在体験')
  if (content?.title) fallback.push(content.title.replace(/\s+/g, ' ').trim())
  return fallback.slice(0, 3)
}

function pickResearchSignals(content?: StructuredHpContent | null): ResearchSignal[] {
  const text = joinContent(content)
  if (!text) return []
  return RESEARCH_SIGNAL_RULES
    .filter((rule) => includesAny(text, rule.keywords))
    .slice(0, 3)
}

function extractConceptQuote(content?: StructuredHpContent | null): string | null {
  const text = joinContent(content).replace(/\s+/g, ' ')
  if (!text) return null

  if (
    text.includes('絶景サウナ') &&
    text.includes('瞑想サウナ') &&
    text.includes('浴室アートワーク') &&
    text.includes('令和の銭湯')
  ) {
    return '絶景サウナ・瞑想サウナ・浴室アートワーク、その全てが融合した令和の銭湯'
  }

  if (
    text.includes('再び人々が集える空間') &&
    text.includes('治する') &&
    text.includes('食する') &&
    text.includes('育む')
  ) {
    return '再び人々が集える空間をつくる、治する・食する・育む'
  }

  const conceptPatterns = [
    /再び人々が集える空間[^。.\n]{0,80}/,
    /治する[^。.\n]{0,12}食する[^。.\n]{0,12}育む/,
    /絶景サウナ.{0,80}瞑想サウナ.{0,120}浴室アートワーク.{0,120}令和の銭湯/,
    /こだわりの空間.{0,180}令和の銭湯/,
    /大人のオトコのための[^。.\n]{0,24}/,
  ]

  for (const pattern of conceptPatterns) {
    const match = text.match(pattern)
    if (match?.[0]) return match[0].replace(/[。,.、]+$/g, '').trim()
  }

  return null
}

function buildOpening(
  company: string,
  features: string[],
  tone: Tone,
  content?: StructuredHpContent | null,
  signals: ResearchSignal[] = []
): string {
  const first = features[0] ?? 'サウナ後まで含めた滞在体験づくり'
  const second = features[1]
  const third = features[2]
  const conceptQuote = extractConceptQuote(content)
  const primarySignal = signals[0]
  const secondarySignal = signals[1]

  const featureText = [first, second, third].filter(Boolean).join('、')

  if (tone === 'フレンドリー') {
    return [
      `${company} ご担当者様`,
      '',
      conceptQuote
        ? `貴施設のHPで「${conceptQuote}」という言葉を拝見し、思わず引き込まれました。`
        : `貴施設のHPを拝見し、${featureText}がとても魅力的だと感じました。`,
      primarySignal
        ? `${primarySignal.evidence}から、${primarySignal.interpretation}が伝わってきました。`
        : 'サウナそのものだけでなく、ととのった後の余韻まで大切にされている施設だと感じ、ご連絡しました。',
    ].join('\n')
  }

  if (tone === '簡潔') {
    return [
      `${company} ご担当者様`,
      '',
      conceptQuote
        ? `貴施設のHPで「${conceptQuote}」というコンセプトを拝見し、ご連絡いたしました。`
        : `貴施設のHPを拝見し、${featureText}が印象的でした。`,
      primarySignal
        ? `${primarySignal.evidence}に、${primarySignal.interpretation}を感じました。`
        : 'サウナ後の体験価値をさらに高めるご提案として、ご連絡いたしました。',
    ].join('\n')
  }

  if (conceptQuote) {
    return [
      `${company} ご担当者様`,
      '',
      `貴施設のHPで「${conceptQuote}」というコンセプトを拝見し、深く惹かれてご連絡いたしました。`,
      primarySignal
        ? `${primarySignal.evidence}から、${primarySignal.interpretation}が強く伝わってまいりました。`
        : `${featureText}は、数あるサウナ施設の中でも貴施設ならではの唯一無二の体験だと感じております。`,
      secondarySignal
        ? `さらに、${secondarySignal.evidence}にも、貴施設が細部まで体験を磨かれている姿勢を感じております。`
        : primarySignal
          ? `${featureText}は、数あるサウナ施設の中でも貴施設ならではの唯一無二の体験だと感じております。`
          : 'その一つひとつの設計に、貴施設ならではの体験価値を感じております。',
      'そのこだわり抜かれた非日常空間に、もう一つの「サウナ後の特別感」を添えられるのではないかと思い、ご提案いたしました。',
    ].join('\n')
  }

  return [
    `${company} ご担当者様`,
    '',
    `貴施設のHPを拝見し、${featureText}に深く惹かれてご連絡いたしました。`,
    primarySignal
      ? `${primarySignal.interpretation}が伝わってきました。`
      : 'サウナそのものの満足度に加え、入浴後の過ごし方まで丁寧に設計されている点に強く惹かれ、ご連絡いたしました。',
  ].join('\n')
}

function getProductName(settings: UserSettings): string {
  const product = settings.products?.find((item) => item.name.includes('コーラ')) ?? settings.products?.[0]
  return product?.name || 'サウナ専用コーラ'
}

function buildProposalContext(content?: StructuredHpContent | null, analysis?: HpAnalysis | null): string {
  const text = joinContent(content)
  if (text.includes('治する') && text.includes('食する') && text.includes('育む')) {
    return '「治する」後の一杯、そして「食する」体験を広げる選択肢として'
  }
  if (text.includes('無料のドリンクバー') || text.includes('ドリンクバー')) {
    return '既存の無料ドリンクバーとは別に、サウナ後に選びたくなる有料の目玉商品として'
  }
  if (text.includes('ライブラリーカフェ') || text.includes('OCHACCO') || text.includes('リラクゼーション') || text.includes('ラクシス')) {
    return 'ライブラリーカフェやリラクゼーションと合わせて、湯上がりに選びたくなる特別なドリンクとして'
  }
  if (analysis?.hasFoodMenu || text.includes('食事') || text.includes('レストラン') || text.includes('湯食処')) {
    return '食事やラウンジ利用と合わせて、サウナ後の追加注文につながる商品として'
  }
  if (text.includes('貸切') || text.includes('プライベート')) {
    return '貸切利用や特別な来館体験に添える一杯として'
  }
  if (text.includes('SNS') || text.includes('Instagram') || text.includes('インスタ')) {
    return 'SNSでも紹介しやすいサウナー向けの目玉商品として'
  }
  return '通常のドリンクに加える、サウナ後専用の特別な一杯として'
}

function buildPhilosophyBridge(content?: StructuredHpContent | null): string | null {
  const text = joinContent(content)
  if (text.includes('ReFa') || text.includes('OSAJI') || text.includes('妥協')) {
    return '「からだに触れるところだから妥協できない」という姿勢は、無添加・無着色でサウナ後の身体に寄り添う弊社商品の考え方とも重なると感じています。'
  }
  if (text.includes('アートワーク') || text.includes('現代美術') || text.includes('非日常')) {
    return '景色や空間そのものを体験価値にされている貴施設だからこそ、ドリンクも単なる飲料ではなく、余韻を深める体験の一部としてご提案できると考えています。'
  }
  if (text.includes('食事') || text.includes('ラウンジ') || text.includes('休憩')) {
    return 'サウナ後にゆっくり過ごす時間を大切にされている貴施設だからこそ、その時間に選ばれる一杯として相性がよいと感じています。'
  }
  return null
}

function buildSincereBridge(signals: ResearchSignal[], content?: StructuredHpContent | null): string | null {
  const text = joinContent(content)
  if (text.includes('再び人々が集える空間') && text.includes('治する') && text.includes('食する')) {
    return '御社が大切にされる「治する・食する・育む」という体験価値と、弊社のサウナーコーラ・サ飯を掛け合わせることで、藤塚の湯でのサウナ後のひとときをさらに豊かな体験として演出できると考えています。'
  }

  if (
    text.includes('地下1,000m') &&
    text.includes('ドライサウナ') &&
    (text.includes('ライブラリーカフェ') || text.includes('OCHACCO'))
  ) {
    return '藤塚の湯様のように、温泉・サウナ・水風呂・カフェを通じて心身をゆっくり整える施設では、湯上がりに選ぶ一杯も体験の一部になると考えています。'
  }

  const first = signals[0]
  const second = signals[1]
  if (first && second) {
    return `${first.bridge}\n${second.bridge}`
  }
  if (first) return first.bridge
  return buildPhilosophyBridge(content)
}

function buildProof(settings: UserSettings): string {
  const proof = settings.social_proof || ''
  if (proof.includes('全国60施設')) {
    return '全国60施設以上で導入が広がっており、中型施設でも1日20〜40杯の販売実績がございます。'
  }
  if (proof.trim()) {
    return proof.split('\n').find((line) => line.trim())?.replace(/^【[^】]+】/, '')?.trim()
      || '複数の温浴・サウナ施設様で導入いただいております。'
  }
  return '複数の温浴・サウナ施設様で導入いただいております。'
}

function buildCompanyIntro(settings: UserSettings, content?: StructuredHpContent | null): string {
  const text = joinContent(content)
  if (text.includes('治する') && text.includes('食する')) {
    return `私は、${settings.company_name}の${settings.representative}と申します。世界初のサウナ専用クラフトコーラ「サウナーコーラ」の開発・販売と、本格スパイスカレーの冷凍卸（サ飯）を手がけております。`
  }
  return `弊社は、サウナ後に飲むことを前提に開発した「${getProductName(settings)}」を展開している${settings.company_name}です。`
}

function buildProductDetail(content?: StructuredHpContent | null): string {
  const text = joinContent(content)
  if (text.includes('治する') && text.includes('食する')) {
    return 'サウナーコーラは10種類以上のスパイスと生薬を無添加・無着色でブレンドしており、身体への真摯なこだわりという点で貴施設のコンセプトとも親和性が高いと感じております。また、冷凍サ飯は温めるだけで本格スパイスカレーをご提供いただけるため、調理スタッフや特別な設備なしに「食する」体験を追加いただけます。'
  }
  return '設備投資や大きなオペレーション変更なしで導入しやすく、客単価アップやSNSでの話題づくりにもつなげやすい商品です。'
}

function buildCta(settings: UserSettings): string {
  return settings.cta_text?.trim() || generateCtaWithDates()
}

function buildSignature(settings: UserSettings): string {
  const lines = [
    settings.company_name,
    [settings.representative_title, settings.representative].filter(Boolean).join(' '),
    settings.company_email ? `Mail: ${settings.company_email}` : null,
    settings.company_website ? `Web: ${settings.company_website}` : null,
  ].filter(Boolean)

  return lines.join('\n')
}

function buildSubject(company: string, features: string[], template?: MessageTemplate | null): string {
  if (template?.name.includes('コラボ')) {
    return `${company}様とのサウナ後ドリンク企画のご相談`
  }
  if (features.some((feature) => feature.includes('絶景'))) {
    return `${company}様の絶景サウナ後体験に合う専用ドリンクのご提案`
  }
  return `${company}様のサウナ後体験に合う専用ドリンクのご提案`
}

function compactInstructions(customInstructions?: string): string {
  const text = customInstructions?.trim()
  if (!text) return ''
  return text.length > 120 ? `${text.slice(0, 120)}...` : text
}

export function generateFreeSalesMessage({
  lead,
  tone,
  customInstructions,
  settings,
  template,
  hpContent,
  hpAnalysis,
}: GenerateFreeMessageInput): { subject: string; body: string; text: string } {
  const company = lead.company_name?.trim() || '貴施設'
  const features = pickFeatures(hpContent, hpAnalysis)
  const researchSignals = pickResearchSignals(hpContent)
  const subject = buildSubject(company, features, template)
  const proposalContext = buildProposalContext(hpContent, hpAnalysis)
  const proof = buildProof(settings)
  const instructions = compactInstructions(customInstructions)

  const intro = buildOpening(company, features, tone, hpContent, researchSignals)
  const sincereBridge = buildSincereBridge(researchSignals, hpContent)
  const companyIntro = tone === '簡潔'
    ? `弊社は、サウナ後に飲むことを前提に開発した「${getProductName(settings)}」を展開しております。`
    : buildCompanyIntro(settings, hpContent)
  const productDetail = buildProductDetail(hpContent)

  const proposal = [
    companyIntro,
    '',
    sincereBridge,
    `だからこそ、${proposalContext}サウナーコーラをご活用いただけるのではないかと考えました。`,
    productDetail,
    '',
    proof,
  ].filter((line): line is string => line !== null)

  if (template?.name.includes('コラボ')) {
    proposal.splice(3, 1, '施設オリジナルラベルや限定企画として展開することで、貴施設らしいサウナ後体験づくりにも活用いただけます。')
  }

  if (instructions) {
    proposal.push('', `なお、${instructions}`)
  }

  const body = wrapGeneratedText([
    intro,
    '',
    ...proposal,
    '',
    buildCta(settings),
    '',
    buildSignature(settings),
  ].join('\n'))

  return {
    subject,
    body,
    text: `件名：${subject}\n---\n${body}`,
  }
}
