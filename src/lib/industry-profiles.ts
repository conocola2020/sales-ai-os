/**
 * 業種別メッセージプロファイル（Phase 4）
 *
 * 無料生成エンジン（free-message-generator）に業種ごとの「提案の型」を供給する。
 * 出典: docs/phase4-industry-templates-design.md の13業種テンプレート。
 *
 * サウナは従来のHP解析ロジック（FEATURE_RULES / RESEARCH_SIGNALS）をそのまま使うため
 * isSauna = true とし、文言は free-message-generator 内の既存実装が担当する。
 */

import { normalizeIndustry, type Industry } from '@/lib/industries'

export interface IndustryMessageProfile {
  industry: Industry
  /** 相手の呼び方（貴施設 / 貴店 / 貴社） */
  honorific: string
  /** サウナ専用のHP解析・文面ロジックを使うか */
  isSauna: boolean
  /** 件名 */
  subject: (company: string) => string
  /** HPから特徴を拾えなかったときの褒めポイント */
  defaultFeature: string
  /** 書き出しの結び（この店はこういう所だと感じて連絡した、の一文） */
  openingFallback: string
  /** 自社紹介（商品をこの業種向けにどう名乗るか）。{company} {rep} を置換 */
  companyIntro: string
  /** 主提案（「だからこそ〜」に相当する完結した一文） */
  proposalSentence: string
  /** 商品説明・導入障壁の低さ */
  productDetail: string
  /** 実績・信頼材料 */
  proofLine: string
  /** 第2提案（OEM等）。不要なら null */
  secondProposal: string | null
  /**
   * Instagram DM の文面（1通目）。
   * ルール: 150〜250字・リンク禁止（DMリクエストでは開けずスパム判定リスク）・
   * 相手が一言で返せる質問で締める・サウナ文脈を出さない
   */
  dmMessage: (name: string) => string
}

const BRAND_BASE =
  '無添加・無着色、10種類以上のスパイスと生薬で仕込むクラフトコーラ「サウナーコーラ」を製造・販売しております'

export const INDUSTRY_PROFILES: Partial<Record<Industry, IndustryMessageProfile>> = {
  カフェ: {
    industry: 'カフェ',
    honorific: '貴店',
    isSauna: false,
    subject: company => `${company}様のドリンクメニューに合う無添加クラフトコーラのご提案`,
    defaultFeature: '一杯ずつ丁寧に淹れるコーヒーと居心地の良い空間づくり',
    openingFallback: 'コーヒーと空間へのこだわりを大切にされているお店だと感じ、ご連絡いたしました。',
    companyIntro: `私は{company}の{rep}と申します。名古屋で${BRAND_BASE}。`,
    proposalSentence:
      'コーヒーへのこだわりはそのままに、「コーヒー以外の一杯」を求めるお客様（ノンカフェイン派・お連れ様・お子様連れ）の受け皿として、クラフトコーラをドリンクメニューに加えていただけないかと考えております。',
    productDetail:
      '無添加・無着色なので健康志向のお客様にも自信を持ってお出しいただけ、瓶のまま提供できるためオペレーションの負担もほとんどありません。SNSでの写真映えから新規のお客様のきっかけにもなっています。',
    proofLine: '現在、全国60以上の店舗・施設で継続的にお取り扱いいただいております。',
    secondProposal:
      'また、店名入りのオリジナルクラフトコーラを小ロットからお作りするOEMも承っており、物販やギフトとして展開いただくことも可能です。',
    dmMessage: name =>
      `はじめまして、CONOCOLAの河野です！${name}さんの投稿、素敵な雰囲気で拝見しました☕ 名古屋で無添加・スパイス10種のクラフトコーラを作っていて、コーヒー以外の一杯としてカフェさんでの導入が増えています。ドリンクメニューの追加ってご検討されることありますか？`,
  },

  美容サロン: {
    industry: '美容サロン',
    honorific: '貴店',
    isSauna: false,
    subject: company => `${company}様のレジ横物販のご提案（無添加クラフトコーラ）`,
    defaultFeature: 'お客様一人ひとりに向き合う施術とサロンの世界観づくり',
    openingFallback: '美意識の高いお客様に長く愛されているサロンだと感じ、ご連絡いたしました。',
    companyIntro: `私は{company}の{rep}と申します。名古屋で${BRAND_BASE}。`,
    proposalSentence:
      '施術後の「自分をいたわる」気分そのままにお持ち帰りいただける物販商品として、レジ横・待合スペースでのクラフトコーラの販売をご提案したく、ご連絡いたしました。',
    productDetail:
      '無添加・無着色・生薬10種の「ご褒美ドリンク」として美容意識の高いお客様と相性がよく、瓶・常温保存のため在庫リスクも小さい商品です。低単価なので施術後の「ついで買い」が起きやすく、物販の入り口としてもお使いいただけます。',
    proofLine: 'NHKをはじめメディア掲載多数、2024年にはパリコレクションでの提供実績もございます。',
    secondProposal:
      'また、サロン名入りのオリジナルラベルを小ロットからお作りするOEMもございます。自店ブランドの物販商品としてご活用いただけます。',
    dmMessage: name =>
      `はじめまして、CONOCOLAの河野です！${name}さんの投稿、素敵な世界観で拝見しました✨ 名古屋で無添加・生薬10種のクラフトコーラを作っていて、施術後の「ご褒美ドリンク」としてサロンのレジ横物販で人気です。物販アイテムって増やされるご予定ありますか？`,
  },

  中華: {
    industry: '中華',
    honorific: '貴店',
    isSauna: false,
    subject: company => `${company}様の食中ドリンクに合うクラフトコーラのご提案`,
    defaultFeature: '看板メニューへのこだわりと活気ある店づくり',
    openingFallback: '地元で愛される確かな味を守られているお店だと感じ、ご連絡いたしました。',
    companyIntro: `私は{company}の{rep}と申します。名古屋で${BRAND_BASE}。`,
    proposalSentence:
      '餃子とコーラに代表されるように、中華とコーラは食中の定番の組み合わせです。10種のスパイスを使ったクラフトコーラなら、料理の味を引き立てながら「ここでしか飲めない一杯」としてドリンク単価を上げられると考えております。',
    productDetail:
      'お車のお客様やお子様連れのノンアルコール需要の受け皿になり、無添加・無着色なのでご家族にも安心してお出しいただけます。瓶提供のためオペレーション負担はほとんどありません。',
    proofLine: '現在、全国60以上の店舗・施設で継続的にお取り扱いいただいております。',
    secondProposal:
      'また、店名入りオリジナルコーラのOEM（小ロット対応）も承っております。',
    dmMessage: name =>
      `はじめまして、CONOCOLAの河野です！${name}さんの投稿、どのお料理も本当に美味しそうで拝見しました🥟 名古屋で無添加・スパイス10種のクラフトコーラを作っていて、餃子や中華との相性が良く食中ドリンクとして導入いただいています。ドリンクメニューの追加ってご検討されることありますか？`,
  },

  焼肉: {
    industry: '焼肉',
    honorific: '貴店',
    isSauna: false,
    subject: company => `${company}様の食中ドリンクに合うクラフトコーラのご提案`,
    defaultFeature: 'お肉の質へのこだわりとお客様をもてなす店づくり',
    openingFallback: 'お肉と向き合い続けてこられたお店だと感じ、ご連絡いたしました。',
    companyIntro: `私は{company}の{rep}と申します。名古屋で${BRAND_BASE}。`,
    proposalSentence:
      '焼肉とコーラは食中ドリンクの鉄板の組み合わせです。どこにでもある大手のコーラではなく、スパイス香るクラフトコーラに置き換えることで、「ドリンクまでこだわる店」としての差別化と単価アップを同時に実現できると考えております。',
    productDetail:
      'お車でのご来店やご家族連れのノンアルコール需要をしっかり受け止められ、無添加・無着色なのでお子様にも安心です。瓶提供のためホールのオペレーションもほぼ変わりません。',
    proofLine: '現在、全国60以上の店舗・施設で継続的にお取り扱いいただいております。',
    secondProposal:
      'また、店名入りオリジナルコーラのOEM（小ロット対応）もございます。記念日のお客様への一本や手土産需要にもお使いいただけます。',
    dmMessage: name =>
      `はじめまして、CONOCOLAの河野です！${name}さんの投稿、お肉の焼き色まで美味しそうで見入ってしまいました🔥 名古屋で無添加・スパイス10種のクラフトコーラを作っていて、焼肉との相性抜群でノンアル需要の受け皿として導入が増えています。ドリンクメニューの追加ってご検討されることありますか？`,
  },

  フレンチ: {
    industry: 'フレンチ',
    honorific: '貴店',
    isSauna: false,
    subject: company => `${company}様のノンアルコールペアリングに関するご提案`,
    defaultFeature: 'コースに込められた哲学と細部まで行き届いたおもてなし',
    openingFallback: '一皿一皿に真摯に向き合われているレストランだと感じ、ご連絡いたしました。',
    companyIntro: `私は{company}の{rep}と申します。名古屋で${BRAND_BASE}。`,
    proposalSentence:
      'ご妊娠中のお客様やお車のお客様への「大人のノンアルコール選択肢」として、生薬とスパイスの複雑味を持つクラフトコーラをペアリングに加えていただけないかと考えております。記念日利用の多いお店ほど、お酒を飲めない方への一杯がご満足度を左右すると感じております。',
    productDetail:
      '10種以上のスパイスと生薬による奥行きのある味わいで、コース料理との相性を考えた提供方法（グラス・温度帯）もご相談可能です。',
    proofLine:
      '2024年にはパリコレクションでの提供実績があり、2026年には高級外資系ホテルへの導入も予定しております。',
    secondProposal:
      'また、レストランオリジナルレシピのOEMも承っており、コースの世界観に合わせた一杯を共同開発することも可能です。',
    dmMessage: name =>
      `はじめまして、CONOCOLAの河野と申します。${name}さんのお料理の投稿を拝見し、ご連絡いたしました。名古屋で生薬とスパイス10種のクラフトコーラを作っており、2024年にはパリコレクションでの提供実績もございます。お酒を飲まれないお客様へのノンアルコールペアリングとして、ご興味ございませんか？`,
  },

  イタリアン: {
    industry: 'イタリアン',
    honorific: '貴店',
    isSauna: false,
    subject: company => `${company}様の食中ドリンクに合うクラフトコーラのご提案`,
    defaultFeature: '素材へのこだわりと気取らない美味しさの追求',
    openingFallback: '素材と味に実直に向き合われているお店だと感じ、ご連絡いたしました。',
    companyIntro: `私は{company}の{rep}と申します。名古屋で${BRAND_BASE}。`,
    proposalSentence:
      'ピッツァやパスタと相性のよいスパイス感のあるクラフトコーラを、ランチセットやディナーの食中ドリンクに加えていただくことで、ファミリー層・ノンアルコール需要の満足度とドリンク単価の両方を高められると考えております。',
    productDetail:
      '無添加・無着色でお子様にも安心してお出しいただけ、瓶のまま提供できるためオペレーションはほとんど変わりません。SNS映えする見た目も好評です。',
    proofLine: '現在、全国60以上の店舗・施設で継続的にお取り扱いいただいております。',
    secondProposal: 'また、店名入りオリジナルコーラのOEM（小ロット対応）も承っております。',
    dmMessage: name =>
      `はじめまして、CONOCOLAの河野です！${name}さんの投稿、素敵な雰囲気で拝見しました🍕 名古屋で無添加・スパイス10種のクラフトコーラを作っていて、ピッツァやパスタとの相性が良くイタリアンでの導入が増えています。ノンアルのドリンクメニューって強化されるご予定ありますか？`,
  },

  キッチンカー: {
    industry: 'キッチンカー',
    honorific: '貴店',
    isSauna: false,
    subject: company => `${company}様の出店メニューに合う瓶クラフトコーラのご提案`,
    defaultFeature: '限られたスペースで最大限の体験を届ける工夫',
    openingFallback: 'イベントを盛り上げる存在感のある出店をされていると感じ、ご連絡いたしました。',
    companyIntro: `私は{company}の{rep}と申します。名古屋で${BRAND_BASE}。`,
    proposalSentence:
      '「注ぐだけ・栓を開けるだけ」で提供できる瓶クラフトコーラは、スペースとオペレーションが限られるキッチンカーにこそ向いている高利益ドリンクだと考えております。瓶のデザイン性で行列のお客様の目も引きます。',
    productDetail:
      '常温保存できるため在庫管理が楽で、設備投資もゼロ。屋外イベントでは1日20杯以上の販売実績もあり、フード待ちのお客様への「もう一品」として売上を積み増せます。',
    proofLine: '現在、全国60以上の店舗・施設で継続的にお取り扱いいただいております。',
    secondProposal: 'また、車体ブランド名入りのオリジナルコーラOEM（小ロット対応）もございます。',
    dmMessage: name =>
      `はじめまして、CONOCOLAの河野です！${name}さんの出店投稿、いつも賑わっていて素敵です🚚 名古屋で瓶のクラフトコーラを作っていて、注ぐだけ・場所を取らない高利益ドリンクとしてキッチンカーでの導入が増えています。ドリンクの一品追加ってご検討されることありますか？`,
  },

  雑貨屋: {
    industry: '雑貨屋',
    honorific: '貴店',
    isSauna: false,
    subject: company => `${company}様のセレクトに加えていただきたい名古屋発クラフトコーラのご紹介`,
    defaultFeature: '一つひとつの商品に込められたセレクトの審美眼',
    openingFallback: '「物語のあるもの」を丁寧に選ばれているお店だと感じ、ご連絡いたしました。',
    companyIntro: `私は{company}の{rep}と申します。名古屋で${BRAND_BASE}。`,
    proposalSentence:
      'デザイン性のある瓶ボトルと「名古屋発・スパイスと生薬のクラフトコーラ」というストーリーで、棚に置くだけでお客様との会話が生まれる商品として、お取り扱いをご提案したくご連絡いたしました。',
    productDetail:
      '小ロットから卸に対応しており、常温保存のため在庫リスクも小さい商品です。ギフト需要との相性がよく、NHKなどメディア掲載も多いため接客での説明もしやすいと好評です。',
    proofLine: '全国60以上の店舗・施設での導入実績と、多数のメディア掲載実績がございます。',
    secondProposal:
      'また、店名入りオリジナルラベルのOEM（小ロット対応）で、自店ブランド商品として展開いただくことも可能です。',
    dmMessage: name =>
      `はじめまして、CONOCOLAの河野です！${name}さんのセレクト、どれも素敵で拝見しました✨ 名古屋で瓶のクラフトコーラを作っていて、デザインと名古屋発のストーリーで「置くだけで語れる商品」として雑貨屋さんでのお取り扱いが増えています。小ロットからの仕入れって、ご興味ありますか？`,
  },

  スーパーマーケット: {
    industry: 'スーパーマーケット',
    honorific: '貴社',
    isSauna: false,
    subject: company => `${company}様の地元商品コーナーへのご提案（名古屋発クラフトコーラ）`,
    defaultFeature: '地域のお客様の毎日を支える売場づくり',
    openingFallback: '地元に根ざした品揃えを大切にされていると感じ、ご連絡いたしました。',
    companyIntro: `私は{company}の{rep}と申します。名古屋で${BRAND_BASE}。`,
    proposalSentence:
      '「名古屋発・メディア掲載多数」の地元クラフトコーラとして、地場商品・ご当地コーナーでのお取り扱いをご提案したく、ご連絡いたしました。',
    productDetail:
      'NHK・東海テレビなどの露出による指名買いが期待でき、話題性のある地元商品として回転が見込めます。小ロットからの納品・柔軟な取引条件に対応しております。',
    proofLine: '全国60以上の店舗・施設での導入実績と、継続率の高さが強みです。',
    secondProposal: null,
    dmMessage: name =>
      `はじめまして、CONOCOLAの河野と申します。${name}さんの売場づくりの投稿を拝見し、ご連絡いたしました。名古屋発・メディア掲載多数のクラフトコーラを作っており、地元商品コーナーでのお取り扱いが増えています。地場商品の新規お取り扱いって、ご検討されることありますか？`,
  },

  百貨店: {
    industry: '百貨店',
    honorific: '貴店',
    isSauna: false,
    subject: company => `${company}様の催事・地元名品コーナーに関するご提案`,
    defaultFeature: 'お客様の期待を超える催事と売場の企画力',
    openingFallback: '地元の良品を丁寧に発掘・紹介されていると感じ、ご連絡いたしました。',
    companyIntro: `私は{company}の{rep}と申します。名古屋で${BRAND_BASE}。`,
    proposalSentence:
      '名古屋発のブランドストーリーとメディア実績を持つクラフトコーラとして、催事出店または地元名品コーナーでのお取り扱いをご提案したく、ご連絡いたしました。ギフト・お中元お歳暮の文脈でもご提案可能です。',
    productDetail:
      '2024年パリコレクションでの提供、2026年の高級外資系ホテル導入予定、アニメIP・球場とのコラボ実績など、催事の集客につながる話題性をご用意できます。',
    proofLine: 'NHKをはじめとするメディア掲載多数、全国60以上の店舗・施設での導入実績がございます。',
    secondProposal: 'また、百貨店様限定パッケージのOEMもご相談可能です。',
    dmMessage: name =>
      `はじめまして、CONOCOLAの河野と申します。${name}様の催事や地元名品の取り組みを拝見し、ご連絡いたしました。名古屋発のクラフトコーラで、パリコレクション提供やメディア掲載の実績がございます。催事やギフトの文脈でご紹介の機会をいただくことは可能でしょうか？`,
  },

  高級食品スーパー: {
    industry: '高級食品スーパー',
    honorific: '貴店',
    isSauna: false,
    subject: company => `${company}様の品揃えに合うプレミアムクラフトコーラのご提案`,
    defaultFeature: 'バイヤーの確かな目利きによる品揃え',
    openingFallback: '「良いものを知るお客様」に選ばれ続けているお店だと感じ、ご連絡いたしました。',
    companyIntro: `私は{company}の{rep}と申します。名古屋で${BRAND_BASE}。`,
    proposalSentence:
      '無添加・無着色・生薬10種のプレミアムクラフトコーラとして、健康志向・ギフト需要のお客様に向けたお取り扱いをご提案したく、ご連絡いたしました。',
    productDetail:
      '2024年パリコレクションでの提供実績、2026年の高級外資系ホテル導入予定など、価格帯に見合うブランドストーリーを備えています。瓶のデザイン性からギフト・手土産用途でも動きやすい商品です。',
    proofLine: 'NHKをはじめとするメディア掲載多数、全国60以上の店舗・施設での導入実績がございます。',
    secondProposal: 'また、店舗限定ラベルのOEMもご相談可能です。',
    dmMessage: name =>
      `はじめまして、CONOCOLAの河野と申します。${name}さんの品揃えの投稿を拝見し、ご連絡いたしました。名古屋で無添加・生薬10種のプレミアムクラフトコーラを作っており、パリコレクション提供などの実績もございます。ギフト向け商品の新規お取り扱いって、ご検討されることありますか？`,
  },

  お土産屋: {
    industry: 'お土産屋',
    honorific: '貴店',
    isSauna: false,
    subject: company => `${company}様のご当地商品に関するご提案（名古屋発クラフトコーラ・OEM）`,
    defaultFeature: '土地の魅力を持ち帰れるかたちにする品揃え',
    openingFallback: '観光のお客様の「ここでしか買えないもの」を大切にされていると感じ、ご連絡いたしました。',
    companyIntro: `私は{company}の{rep}と申します。名古屋で${BRAND_BASE}。`,
    proposalSentence:
      '「名古屋発クラフトコーラ」としてのご当地性と、瓶の持ち帰りやすさ・ギフト性を活かし、お土産の新定番としてのお取り扱いをご提案したく、ご連絡いたしました。',
    productDetail:
      'さらに、その土地の名前や素材を使った「ご当地オリジナルコーラ」を小ロットからOEMでお作りできます。アニメIPや時代劇とのコラボ商品の実績もあり、他店にない限定商品を低リスクで展開いただけます。',
    proofLine: 'NHKをはじめとするメディア掲載多数、全国60以上の店舗・施設での導入実績がございます。',
    secondProposal: null,
    dmMessage: name =>
      `はじめまして、CONOCOLAの河野です！${name}さんの投稿を拝見し、ご連絡しました。名古屋発のクラフトコーラを作っていて、その土地の名前や素材で作る「ご当地オリジナルコーラ」のOEMも小ロットから承っています。他にはない限定商品って、ご興味ありますか？`,
  },

  高級レストラン: {
    industry: '高級レストラン',
    honorific: '貴店',
    isSauna: false,
    subject: company => `${company}様のノンアルコールペアリングに関するご提案`,
    defaultFeature: 'お料理とおもてなしに対する妥協のない姿勢',
    openingFallback: '特別な時間を提供され続けているお店だと感じ、ご連絡いたしました。',
    companyIntro: `私は{company}の{rep}と申します。名古屋で${BRAND_BASE}。`,
    proposalSentence:
      'ご妊娠中のお客様やお車のお客様への「大人のノンアルコール選択肢」として、生薬とスパイス10種の複雑味を持つクラフトコーラをペアリングに加えていただけないかと考えております。記念日のご利用が多いお店ほど、お酒を召し上がらないお客様への一杯がご満足度を左右すると感じております。',
    productDetail:
      '無添加・無着色で、コースに合わせた提供方法（グラス・温度帯・炭酸の強さ）もご相談可能です。',
    proofLine:
      '2024年のパリコレクションでの提供実績があり、2026年には高級外資系ホテルへの導入も予定しております。',
    secondProposal:
      'また、お店オリジナルレシピのOEMも承っており、コースの世界観に合わせた一杯を共同開発することも可能です。',
    dmMessage: name =>
      `はじめまして、CONOCOLAの河野と申します。${name}さんのお料理の投稿を拝見し、ご連絡いたしました。名古屋で生薬とスパイス10種のクラフトコーラを作っており、パリコレクションでの提供実績もございます。お酒を召し上がらないお客様へのノンアルコールペアリングとして、ご興味ございませんか？`,
  },
}

/**
 * 業種からプロファイルを取得。
 * サウナ・未知業種・null は null を返し、呼び出し側で従来のサウナ向けロジックを使う。
 */
export function getIndustryProfile(industry: Industry | null): IndustryMessageProfile | null {
  if (!industry || industry === 'サウナ') return null
  return INDUSTRY_PROFILES[industry] ?? null
}

/**
 * 業種の生テキスト（表記揺れ可）から Instagram DM 文面を返す。
 * サウナ・未知業種は null（呼び出し側の従来ロジックにフォールバック）。
 */
export function getIndustryDmMessage(industryRaw: string | null | undefined, name: string): string | null {
  const profile = getIndustryProfile(normalizeIndustry(industryRaw))
  return profile ? profile.dmMessage(name) : null
}
