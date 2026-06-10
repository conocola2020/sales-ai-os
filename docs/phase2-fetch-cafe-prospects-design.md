# Phase 2 設計書: fetch-cafe-prospects.ts

> **Codex 向け実装指示書**
> 本ドキュメントは Codex が `scripts/fetch-cafe-prospects.ts` を実装するための
> 仕様書である。設計事項は確定済み。本書に従って実装すること。
> ⚠️ 既存スクリプト（`scripts/send-forms.ts`, `scripts/detect-contacts.ts`,
> `scripts/scrape-sauna-ikitai.ts`）のコーディングスタイル・ログ書式・
> 引数パース・エラーハンドリングを厳密に踏襲すること。

---

## 変更履歴

| 版 | 日付 | 変更内容 |
| --- | --- | --- |
| v1.0 | 2026-05-12 | 初版作成 |
| v1.1 | 2026-05-12 | Google Places API (New) の SKU 階層認識を訂正（Essentials / Pro / Enterprise の3階層、最高SKU 1つ分のみ課金）。Vol.1 として目標を 2,000件 → **1,000件**（Enterprise SKU 無料枠内）へ縮小。三重・岐阜・静岡への自動拡張ロジックを削除。1,000件の戦略的配分（名古屋700件・豊田80件・岡崎60件・一宮30件・春日井30件・豊橋50件・その他50件）を確定。「課金監視」セクションと `MAX_API_REQUESTS=200` セーフガードを追加。Vol.1 完了後の反応率を見て Vol.2 を別途検討する方針。 |
| v1.2 | 2026-06-10 | 無料枠の課金単位の認識を訂正（無料枠は「リクエスト数」単位、1リクエスト=最大20店舗。当初の2,000件でも $0 だったため、1,000件は課金制約ではなく営業キャパ・効果検証母数としての判断と明記）。**カテゴリフィルタ**（types に cafe/coffee_shop を含まない店を除外）と**営業状態フィルタ**（OPERATIONAL 以外を除外）をデータフローに追加、`filters.ts` を新設。**目標カウントを websiteUri あり採用店のみ**に変更（フォーム送信可能な母数を確保。HPなし採用店は保存するが目標に数えない）。グループ上限到達時のページング打ち切りを追加。クエリ数固定50のため理論上限150リクエスト＝無料枠超過は構造的に不可能であることを明記。 |

---

## 概要

### 目的
Google Places API (New) から愛知県のカフェ情報を取得し、Supabase の
`cafe_prospects` テーブルに保存する。

### 確定済み要件

| 項目 | 値 |
| --- | --- |
| 取得対象 | カテゴリ `cafe` + `coffee_shop`（**types によるクライアント側フィルタで担保**。検索結果に混ざるレストラン・パン屋等は除外） |
| 検索エリア | 愛知県のみ（名古屋市16区＋主要数市）。**他県への拡張は行わない** |
| 営業状態 | `OPERATIONAL` のみ採用。閉業・休業は `status='excluded'`（reason=`closed`） |
| 目標件数 | **1,000件** = `status='new'` かつ **websiteUri あり**の店舗数。HPなし採用店は保存するが目標にカウントしない（フォーム送信可能な母数を確保するため） |
| 課金SKU | **Enterprise SKU を含む fieldMask**（最高SKU 1つ分のみ課金。3階層分の課金は発生しない） |
| 実行環境 | Mac mini M4（24時間稼働）。Node.js + TypeScript |
| 配置 | `scripts/fetch-cafe-prospects.ts` |
| 認証 | `process.env.GOOGLE_PLACES_API_KEY` + `SUPABASE_SERVICE_ROLE_KEY` |
| IP制限 | API キーは自宅IPに固定。本スクリプトは Mac mini 以外から実行不可 |

### 出力先テーブル

`cafe_prospects`（migration `017_create_cafe_prospects.sql` 適用済み・本番に存在）。
スキーマの詳細は実装前に必ず本番から確認すること（後述「Supabase保存」セクション参照）。

---

## ファイル構成

### 新規作成

```
scripts/
└── fetch-cafe-prospects.ts          # メインスクリプト（エントリポイント）

src/lib/cafe-prospects/
├── places-client.ts                  # Google Places API (New) クライアント
├── blacklist.ts                      # ブラックリスト判定ロジック
├── filters.ts                        # カテゴリ・営業状態・website 判定（v1.2 追加）
├── search-areas.ts                   # 愛知県エリア定義（Vol.1 配分）
└── types.ts                          # 共通型定義
```

> **配置方針の根拠**
> - メインスクリプトは `scripts/` 直下（`send-forms.ts`等と同様）。
> - ロジックは `src/lib/cafe-prospects/` にモジュール化し、再利用性を担保。
>   既存パターン（`src/lib/form-sender.ts`, `src/lib/contact-detector.ts`）と同様。
> - すべて TypeScript。`tsconfig.json` をそのまま使う。

### 参照する既存コード

| 既存ファイル | 参照する目的 |
| --- | --- |
| `scripts/send-forms.ts` | 引数パース、Supabase初期化、ログ書式の手本 |
| `scripts/detect-contacts.ts` | `--limit`, `--prefecture` 系オプションの手本 |
| `scripts/scrape-sauna-ikitai.ts` | リトライ付き fetch、`getArg`/`hasFlag` ヘルパ、絵文字ログ |
| `scripts/enrich-company-url.ts` | Supabase REST直叩きパターン（@supabase/supabase-js が使えない場合のフォールバック） |

### npm script 追加（package.json）

```jsonc
"scripts": {
  // 既存に追記:
  "fetch:cafe": "node --env-file=.env.local --import tsx scripts/fetch-cafe-prospects.ts"
}
```

実行例:
```bash
npm run fetch:cafe -- --area nagoya-naka --limit 50           # Step 3-1（本番テスト）
npm run fetch:cafe -- --area aichi-vol1 --target 1000         # Step 3-2（Vol.1 本番）
npm run fetch:cafe -- --area aichi-vol1 --dry-run             # dry-run
```

---

## 関数仕様

### 1. `scripts/fetch-cafe-prospects.ts`（メイン）

```ts
async function main(): Promise<void>
```

**役割**: エントリポイント。引数解析→検索→フィルタ→保存→サマリー出力。

**引数（CLI）**:
| フラグ | 型 | 既定値 | 説明 |
| --- | --- | --- | --- |
| `--area <name>` | string | `nagoya-naka` | 検索エリア識別子（`nagoya-naka` / `aichi-vol1` のいずれか） |
| `--limit <n>` | number | なし（無制限） | 取得上限件数（API呼び出し総数の打ち切り） |
| `--target <n>` | number | `1000` | 採用件数がこの値に達したら処理を終了する |
| `--dry-run` | flag | OFF | API呼び出しなし、Supabase INSERT もしない |
| `--no-blacklist-save` | flag | OFF | ブラックリストヒット店を `status='excluded'` で保存しない（破棄のみ） |
| `--user-id <uuid>` | string | env から取得 | 所有者の `user_id`。未指定時は `OWNER_USER_ID` env を使用 |
| `--verbose` | flag | OFF | スキップ理由を1件ずつログ出力 |
| `--yes` | flag | OFF | `MAX_API_REQUESTS` 到達時の続行確認プロンプトを自動 yes |

**戻り値**: なし。終了コード `0`=正常、`1`=設定エラー、`2`=API致命エラー。

**エラーハンドリング方針**:
- 環境変数不足 → `console.error` + `process.exit(1)`（既存スクリプト準拠）。
- 個別の店舗保存失敗 → ログ出力して継続（`scripts/send-forms.ts` と同方針）。
- Places API レート上限・5xx → 指数バックオフでリトライ（後述）。
- Ctrl+C → graceful shutdown。中断時点で取得済みの件数をサマリー表示。

---

### 2. `src/lib/cafe-prospects/types.ts`

```ts
/** Google Places API (New) の Place レスポンス（取得フィールドのみ抜粋） */
export interface RawPlace {
  id: string
  displayName?: { text: string; languageCode?: string }
  formattedAddress?: string
  addressComponents?: AddressComponent[]
  location?: { latitude: number; longitude: number }
  types?: string[]
  primaryType?: string
  nationalPhoneNumber?: string
  websiteUri?: string
  rating?: number
  userRatingCount?: number
  businessStatus?: 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY'
}

export interface AddressComponent {
  longText: string
  shortText: string
  types: string[]   // ['administrative_area_level_1'] 等
}

/** Supabase に保存する正規化済みデータ */
export interface CafeProspectRow {
  user_id: string
  place_id: string                      // RawPlace.id
  name: string                          // displayName.text
  formatted_address: string | null
  prefecture: string | null             // addressComponents から抽出
  city: string | null                   // 同上
  latitude: number | null
  longitude: number | null
  primary_type: string | null
  types: string[] | null
  phone: string | null
  website_url: string | null
  rating: number | null
  user_rating_count: number | null
  business_status: string | null
  status: 'new' | 'excluded'            // フィルタ・ブラックリストヒットは 'excluded'
  excluded_reason: string | null        // 'blacklist:starbucks' | 'not_cafe_type' | 'closed' 等
  raw_data: unknown                     // RawPlace そのものを jsonb で保存
}

export interface SearchAreaConfig {
  id: string                            // 'nagoya-naka'
  prefecture: string                    // '愛知県'
  textQuery: string                     // 'カフェ 名古屋市中区'
  /** このエリアグループで採用する上限件数（status='new' のみカウント） */
  maxCount?: number
  /** 同じ maxCount を共有するエリアグループの識別子（複数クエリで合算判定） */
  group?: string
  /** searchNearby を併用する場合のみ指定 */
  locationBias?: {
    circle: { center: { latitude: number; longitude: number }; radius: number }
  }
}

export interface FetchStats {
  totalApiCalls: number
  rawCount: number             // 重複排除前の取得件数
  uniqueCount: number          // place_id 重複排除後
  notCafeTypeCount: number     // カテゴリ外除外（excluded_reason='not_cafe_type'）
  closedCount: number          // 閉業・休業除外（excluded_reason='closed'）
  blacklistedCount: number     // ブラックリスト除外
  adoptedWithWebsite: number   // status='new' かつ websiteUri あり ← 目標カウント対象
  adoptedWithoutWebsite: number // status='new' かつ websiteUri なし（保存はする）
  savedCount: number           // INSERT 成功（new + excluded 合計）
  errorCount: number
}
```

---

### 3. `src/lib/cafe-prospects/places-client.ts`

```ts
export interface SearchTextOptions {
  textQuery: string
  pageToken?: string
  languageCode?: string  // 'ja' 固定
  regionCode?: string    // 'JP' 固定
}

export interface SearchTextResponse {
  places: RawPlace[]
  nextPageToken?: string
}

/**
 * Places API (New) Text Search を1ページ取得する。
 * - エンドポイント: POST https://places.googleapis.com/v1/places:searchText
 * - ヘッダ:
 *   - X-Goog-Api-Key: <GOOGLE_PLACES_API_KEY>
 *   - X-Goog-FieldMask: <FIELD_MASK 定数>
 *   - Content-Type: application/json
 * - リクエストボディ:
 *   { textQuery, languageCode: 'ja', regionCode: 'JP', pageToken? }
 * - 429/5xx は指数バックオフ（後述）。
 * - 4xx（429除く）は即エラー throw。
 */
export async function searchText(opts: SearchTextOptions): Promise<SearchTextResponse>

/**
 * nextPageToken が無くなるまで全ページ自動取得。
 * Places API (New) では最大3ページ（合計60件）が上限。
 */
export async function searchTextAll(textQuery: string): Promise<RawPlace[]>
```

**fieldMask 定数（必須・厳守）**:
```ts
export const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.addressComponents',
  'places.location',
  'places.types',
  'places.primaryType',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.businessStatus',
  'nextPageToken',
].join(',')
```

> ⚠️ **絶対に追加してはいけないフィールド**（別途課金が跳ね上がる Atmosphere/Enterprise Plus 系）:
> `places.reviews`, `places.photos`, `places.editorialSummary`,
> `places.regularOpeningHours`, `places.priceLevel`, `places.currentOpeningHours`,
> `places.servesCoffee`, `places.takeout` 等。
>
> 📌 **SKU上の正しい認識**（2025年3月以降の Text Search New）:
>
> - **Essentials SKU**（無料枠 10,000件/月）:
>   `places.id`, `places.formattedAddress`, `places.addressComponents`,
>   `places.location`, `places.types`
> - **Pro SKU**（無料枠 5,000件/月）:
>   `places.displayName`, `places.businessStatus`, `places.primaryType`,
>   `places.primaryTypeDisplayName`
> - **Enterprise SKU**（無料枠 **1,000件/月**）:
>   `places.nationalPhoneNumber`, `places.websiteUri`, `places.rating`,
>   `places.userRatingCount`
>
> 本設計の fieldMask は Enterprise SKU フィールドを含むため、
> **1リクエストにつき Enterprise SKU で課金される**（最高SKU適用ルール）。
>
> ⚠️ **重要**: 3階層分が別々に課金されるわけではない。最高SKU 1つ分のみ。
>
> Vol.1 では **Enterprise SKU の無料枠 1,000件/月の範囲内**で完結させる。
> Codex は fieldMask を**変更しないこと**（追加も削除も）。

**リクエスト例**:
```json
{
  "textQuery": "カフェ 名古屋市中区",
  "languageCode": "ja",
  "regionCode": "JP"
}
```

---

### 4. `src/lib/cafe-prospects/blacklist.ts`

```ts
/**
 * ブラックリスト判定結果
 * - matched: true なら除外対象
 * - reason: 'blacklist:starbucks' 形式（status='excluded' の excluded_reason に保存）
 */
export interface BlacklistResult {
  matched: boolean
  reason: string | null
}

/**
 * 店舗名 + types[] からブラックリスト判定。
 * 表記揺れ正規化（後述）を内部で行う。
 */
export function isBlacklisted(name: string, types?: string[]): BlacklistResult

/**
 * 名前正規化:
 *   - NFKC 正規化（全角→半角、全角英数→半角英数、全角スペース→半角）
 *   - 大文字小文字を統一（小文字化）
 *   - 連続空白を1つに圧縮、前後トリム
 *   - 記号削除（中黒・ハイフン・スペース・@・%・'・"）
 * 例: "ｽﾀｰﾊﾞｯｸｽ" → "スターバックス", "Café de Crié" → "cafedecrie"
 */
export function normalizeName(name: string): string
```

#### ブラックリスト構造

```ts
interface BlacklistEntry {
  id: string                  // 'starbucks' 等の安定ID（reasonに使う）
  patterns: string[]          // 正規化後の照合文字列（複数表記を網羅）
  matchType: 'exact' | 'contains'
  category: 'chain' | 'fastfood' | 'regional' | 'mall' | 'manga' | 'concept' | 'animal' | 'bookcafe'
}
```

**63項目の定義**（厳守。漏れ・順序入れ替え禁止）:

```ts
export const BLACKLIST: BlacklistEntry[] = [
  // A. 大手コーヒーチェーン（全国） - contains 判定
  { id: 'starbucks',      patterns: ['スターバックス', 'starbucks'],          matchType: 'contains', category: 'chain' },
  { id: 'doutor',         patterns: ['ドトール', 'doutor'],                   matchType: 'contains', category: 'chain' },
  { id: 'tullys',         patterns: ['タリーズ', 'tullys', "tully's"],        matchType: 'contains', category: 'chain' },
  { id: 'komeda',         patterns: ['コメダ珈琲店', 'コメダ珈琲', 'komeda'], matchType: 'contains', category: 'chain' },
  { id: 'ueshima',        patterns: ['上島珈琲店', '上島珈琲', 'ucc'],         matchType: 'contains', category: 'chain' },
  { id: 'veloce',         patterns: ['ベローチェ', 'veloce', 'caffeveloce'],  matchType: 'contains', category: 'chain' },
  { id: 'sanmarc',        patterns: ['サンマルクカフェ', 'サンマルク'],         matchType: 'contains', category: 'chain' },
  { id: 'excelsior',      patterns: ['エクセルシオール', 'excelsior'],         matchType: 'contains', category: 'chain' },
  { id: 'pronto',         patterns: ['プロント', 'pronto'],                    matchType: 'contains', category: 'chain' },
  { id: 'renoir',         patterns: ['ルノアール', 'renoir'],                  matchType: 'contains', category: 'chain' },
  { id: 'hoshino',        patterns: ['星乃珈琲店', '星乃珈琲'],                 matchType: 'contains', category: 'chain' },
  { id: 'tsubakiya',      patterns: ['椿屋珈琲店', '椿屋珈琲'],                 matchType: 'contains', category: 'chain' },
  { id: 'cafedecrie',     patterns: ['カフェドクリエ', 'cafedecrie'],          matchType: 'contains', category: 'chain' },
  { id: 'segafredo',      patterns: ['セガフレード', 'segafredo'],             matchType: 'contains', category: 'chain' },
  { id: 'bluebottle',     patterns: ['ブルーボトル', 'bluebottle'],            matchType: 'contains', category: 'chain' },
  { id: 'arabica',        patterns: ['arabica', 'アラビカ'],                   matchType: 'contains', category: 'chain' },
  { id: 'chatnoir',       patterns: ['シャノアール'],                          matchType: 'contains', category: 'chain' },
  { id: 'kannocoffee',    patterns: ['神乃珈琲'],                              matchType: 'contains', category: 'chain' },

  // B. ファストフード・コンビニ系
  { id: 'mcdonalds',      patterns: ['マクドナルド', 'mcdonalds', 'マックカフェ', 'mccafe'], matchType: 'contains', category: 'fastfood' },
  { id: 'misterdonut',    patterns: ['ミスタードーナツ', 'ミスド', 'misterdonut'], matchType: 'contains', category: 'fastfood' },
  { id: 'kfc',            patterns: ['ケンタッキー', 'kfc'],                   matchType: 'contains', category: 'fastfood' },
  { id: 'familymart',     patterns: ['ファミリーマート', 'familymart'],         matchType: 'contains', category: 'fastfood' },
  { id: 'seveneleven',    patterns: ['セブンイレブン', '7eleven', 'seveneleven'], matchType: 'contains', category: 'fastfood' },
  { id: 'lawson',         patterns: ['ローソン', 'lawson'],                    matchType: 'contains', category: 'fastfood' },

  // C. 地域チェーン
  { id: 'kurashiki',      patterns: ['倉式珈琲店', '倉式珈琲'],                 matchType: 'contains', category: 'regional' },
  { id: 'lamp',           patterns: ['コーヒーショップらんぷ', '喫茶らんぷ'],     matchType: 'contains', category: 'regional' },

  // D. 大型商業施設系
  { id: 'aeon',           patterns: ['イオン'],                                matchType: 'contains', category: 'mall' },
  { id: 'parco',          patterns: ['パルコ'],                                matchType: 'contains', category: 'mall' },

  // E. 漫画喫茶・ネカフェ系
  { id: 'kaikatsu',       patterns: ['快活club', '快活クラブ', '快活フロンティア'], matchType: 'contains', category: 'manga' },
  { id: 'jiyukukan',      patterns: ['自遊空間'],                              matchType: 'contains', category: 'manga' },
  { id: 'manboo',         patterns: ['マンボー'],                              matchType: 'contains', category: 'manga' },
  { id: 'popeye',         patterns: ['メディアカフェポパイ', 'ポパイ'],          matchType: 'contains', category: 'manga' },
  { id: 'apresio',        patterns: ['アプレシオ'],                            matchType: 'contains', category: 'manga' },
  { id: 'geragera',       patterns: ['ゲラゲラ'],                              matchType: 'contains', category: 'manga' },
  { id: 'dice',           patterns: ['dice'],                                  matchType: 'exact',    category: 'manga' },
  { id: 'anettai',        patterns: ['亜熱帯'],                                matchType: 'contains', category: 'manga' },
  { id: 'netroom',        patterns: ['ネットルーム', 'マンガ喫茶', 'インターネットカフェ'], matchType: 'contains', category: 'manga' },

  // F. コンセプトカフェ系（カテゴリ的キーワード = contains 推奨）
  { id: 'maidcafe',       patterns: ['メイドカフェ', 'メイリッシュ', 'ほーむカフェ', 'キュアメイドカフェ'], matchType: 'contains', category: 'concept' },
  { id: 'cosplaycafe',    patterns: ['コスプレカフェ'],                        matchType: 'contains', category: 'concept' },
  { id: 'animatecafe',    patterns: ['アニメイトカフェ'],                      matchType: 'contains', category: 'concept' },
  { id: 'pokemoncafe',    patterns: ['ポケモンカフェ'],                        matchType: 'contains', category: 'concept' },
  { id: 'charactercafe',  patterns: ['キャラクターカフェ'],                    matchType: 'contains', category: 'concept' },

  // G. 動物カフェ系（contains 必須）
  { id: 'animalcafe',     patterns: ['猫カフェ', 'ドッグカフェ', 'うさぎカフェ', 'ふくろうカフェ', 'ハリネズミカフェ', '鳥カフェ', '爬虫類カフェ', '小動物カフェ'], matchType: 'contains', category: 'animal' },

  // H. ブックカフェ系
  { id: 'tsutaya',        patterns: ['蔦屋書店', 'tsutaya', 'shibuyatsutaya'], matchType: 'contains', category: 'bookcafe' },
  { id: 'bookcafe',       patterns: ['ブックカフェ'],                          matchType: 'contains', category: 'bookcafe' },
  { id: 'junkudo',        patterns: ['ジュンク堂カフェ'],                      matchType: 'contains', category: 'bookcafe' },
  { id: 'kinokuniya',     patterns: ['紀伊國屋書店カフェ', '紀伊国屋書店カフェ'], matchType: 'contains', category: 'bookcafe' },
  { id: 'maruzen',        patterns: ['丸善カフェ', 'maruzen'],                 matchType: 'contains', category: 'bookcafe' },
  { id: 'libro',          patterns: ['リブロカフェ'],                          matchType: 'contains', category: 'bookcafe' },
]
```

> **Codex 補足**:
> - パターンは `normalizeName()` を通した後の文字列で記述している。
>   照合時は店舗名側も同じ正規化を適用する。
> - `matchType: 'exact'` は完全一致のみ（"DICE" のような短い単語が誤爆しないように）。
> - `matchType: 'contains'` は部分一致。
> - **types[] による補助判定（任意）**: Google の types に
>   `'fast_food_restaurant'` が含まれていれば追加で `'blacklist:fastfood_type'` として除外
>   してよい（任意実装、推奨）。

---

### 5. `src/lib/cafe-prospects/filters.ts`（v1.2 追加）

```ts
/**
 * types / primaryType が cafe または coffee_shop を含むか。
 * テキスト検索はレストラン・パン屋・ホテルラウンジ等も返すため、
 * 採用前に必ずこの判定を通す。
 */
export function isCafeType(
  types: string[] | undefined,
  primaryType: string | null | undefined
): boolean
// 実装: const CAFE_TYPES = new Set(['cafe', 'coffee_shop'])
// primaryType が CAFE_TYPES に含まれる、または types のいずれかが
// CAFE_TYPES に含まれれば true

/**
 * 営業中か。'OPERATIONAL' のみ true。
 * undefined（情報欠落）は true 扱い（除外しすぎを防ぐ）。
 * 'CLOSED_PERMANENTLY' / 'CLOSED_TEMPORARILY' は false。
 */
export function isOperational(businessStatus: string | undefined): boolean

/**
 * フォーム送信可能か = 目標カウント対象か。
 * websiteUri が非空文字列なら true。
 */
export function hasWebsite(place: RawPlace): boolean
```

#### 除外判定マトリクス（適用順）

| 順 | 条件 | status | excluded_reason |
| --- | --- | --- | --- |
| 1 | `isCafeType()` = false | `excluded` | `not_cafe_type` |
| 2 | `isOperational()` = false | `excluded` | `closed` |
| 3 | `isBlacklisted()` = matched | `excluded` | `blacklist:<id>` |
| — | 全通過 + websiteUri あり | `new` | null（**目標カウント対象**） |
| — | 全通過 + websiteUri なし | `new` | null（保存のみ、目標カウント外） |

---

### 6. `src/lib/cafe-prospects/search-areas.ts`

```ts
export const NAGOYA_WARDS = [
  '千種区', '東区', '北区', '西区', '中村区', '中区', '昭和区', '瑞穂区',
  '熱田区', '中川区', '港区', '南区', '守山区', '緑区', '名東区', '天白区',
] as const

/** Vol.1 で使う主要市のみ（全36市から絞り込み） */
export const AICHI_MAJOR_CITIES_VOL1 = [
  '豊田市', '岡崎市', '一宮市', '春日井市', '豊橋市',
  // バッファ用（合計50件枠、店舗密度の高い順に取得）
  '瀬戸市', '刈谷市', '安城市', '小牧市',
] as const

export const SEARCH_AREAS: Record<string, SearchAreaConfig[]> = {
  // Step 3-1: 名古屋市中区のみ（本番テスト用、--limit 50 で運用）
  'nagoya-naka': [
    { id: 'nagoya-naka',         prefecture: '愛知県', textQuery: 'カフェ 名古屋市中区',     group: 'nagoya-naka', maxCount: 50 },
    { id: 'nagoya-naka-coffee',  prefecture: '愛知県', textQuery: 'コーヒー 名古屋市中区',   group: 'nagoya-naka', maxCount: 50 },
  ],

  // Step 3-2: 愛知 Vol.1（1,000件配分）
  'aichi-vol1': [
    // ── 名古屋16区: 合計700件（group='nagoya', 全区合算で700件まで採用） ──
    ...NAGOYA_WARDS.flatMap(ward => [
      { id: `nagoya-${ward}`,        prefecture: '愛知県', textQuery: `カフェ 名古屋市${ward}`,   group: 'nagoya', maxCount: 700 },
      { id: `nagoya-${ward}-coffee`, prefecture: '愛知県', textQuery: `コーヒー 名古屋市${ward}`, group: 'nagoya', maxCount: 700 },
    ]),

    // ── 豊田市: 80件 ──
    { id: 'toyota',         prefecture: '愛知県', textQuery: 'カフェ 豊田市',     group: 'toyota', maxCount: 80 },
    { id: 'toyota-coffee',  prefecture: '愛知県', textQuery: 'コーヒー 豊田市',   group: 'toyota', maxCount: 80 },

    // ── 岡崎市: 60件 ──
    { id: 'okazaki',        prefecture: '愛知県', textQuery: 'カフェ 岡崎市',     group: 'okazaki', maxCount: 60 },
    { id: 'okazaki-coffee', prefecture: '愛知県', textQuery: 'コーヒー 岡崎市',   group: 'okazaki', maxCount: 60 },

    // ── 一宮市: 30件 ──
    { id: 'ichinomiya',        prefecture: '愛知県', textQuery: 'カフェ 一宮市',   group: 'ichinomiya', maxCount: 30 },
    { id: 'ichinomiya-coffee', prefecture: '愛知県', textQuery: 'コーヒー 一宮市', group: 'ichinomiya', maxCount: 30 },

    // ── 春日井市: 30件 ──
    { id: 'kasugai',        prefecture: '愛知県', textQuery: 'カフェ 春日井市',   group: 'kasugai', maxCount: 30 },
    { id: 'kasugai-coffee', prefecture: '愛知県', textQuery: 'コーヒー 春日井市', group: 'kasugai', maxCount: 30 },

    // ── 豊橋市: 50件 ──
    { id: 'toyohashi',        prefecture: '愛知県', textQuery: 'カフェ 豊橋市',   group: 'toyohashi', maxCount: 50 },
    { id: 'toyohashi-coffee', prefecture: '愛知県', textQuery: 'コーヒー 豊橋市', group: 'toyohashi', maxCount: 50 },

    // ── その他主要市: 合計50件（group='other', 4市合算で50件まで） ──
    { id: 'seto',          prefecture: '愛知県', textQuery: 'カフェ 瀬戸市',   group: 'other', maxCount: 50 },
    { id: 'seto-coffee',   prefecture: '愛知県', textQuery: 'コーヒー 瀬戸市', group: 'other', maxCount: 50 },
    { id: 'kariya',        prefecture: '愛知県', textQuery: 'カフェ 刈谷市',   group: 'other', maxCount: 50 },
    { id: 'kariya-coffee', prefecture: '愛知県', textQuery: 'コーヒー 刈谷市', group: 'other', maxCount: 50 },
    { id: 'anjo',          prefecture: '愛知県', textQuery: 'カフェ 安城市',   group: 'other', maxCount: 50 },
    { id: 'anjo-coffee',   prefecture: '愛知県', textQuery: 'コーヒー 安城市', group: 'other', maxCount: 50 },
    { id: 'komaki',        prefecture: '愛知県', textQuery: 'カフェ 小牧市',   group: 'other', maxCount: 50 },
    { id: 'komaki-coffee', prefecture: '愛知県', textQuery: 'コーヒー 小牧市', group: 'other', maxCount: 50 },
  ],
}
```

#### Vol.1 配分テーブル

| エリアグループ | group ID | 採用上限 | クエリ数 | 備考 |
| --- | --- | --- | --- | --- |
| 名古屋市16区 | `nagoya` | 700件（16区合計） | 32 | 個人カフェ密度最高、各区平均 約44件目安 |
| 豊田市 | `toyota` | 80件 | 2 | |
| 岡崎市 | `okazaki` | 60件 | 2 | |
| 一宮市 | `ichinomiya` | 30件 | 2 | |
| 春日井市 | `kasugai` | 30件 | 2 | |
| 豊橋市 | `toyohashi` | 50件 | 2 | |
| その他主要市（瀬戸・刈谷・安城・小牧） | `other` | 50件（4市合算） | 8 | バッファ |
| **合計** | — | **1,000件** | **50** | |

#### main() 側に必要なロジック

```ts
// グループ別の採用カウンタを保持
// ⚠️ カウント対象は「status='new' かつ websiteUri あり」のみ（v1.2）
const groupCounts = new Map<string, number>()  // group ID → websiteあり採用件数

for (const area of areas) {
  const groupKey = area.group ?? area.id
  const already = groupCounts.get(groupKey) ?? 0
  if (area.maxCount && already >= area.maxCount) {
    log(`⏭️  グループ ${groupKey} は上限 ${area.maxCount} 達成済み。スキップ: ${area.id}`)
    continue
  }
  // ... 検索実行（ページング中もグループ上限到達を検知したら打ち切り）...
  // websiteUri あり採用件数のみ加算
  groupCounts.set(groupKey, already + adoptedWithWebsiteInThisQuery)

  // --target 達成で全体終了（websiteあり採用の総数で判定）
  if (totalAdoptedWithWebsite >= target) {
    log(`🎯 目標 ${target}件（websiteあり）に到達。処理終了。`)
    break
  }
}
```

> **Codex 補足**:
> - `--target 1000` に達した時点で **必ず処理終了**。残クエリは実行しない。
>   目標・グループ上限ともに「**status='new' かつ websiteUri あり**」の件数でカウントする。
> - HPなしの採用店（status='new', website_url=null）も**保存はする**が、
>   target / maxCount のカウントには含めない。
> - 各グループ採用上限に達した場合、そのグループに属する未実行クエリは
>   ループ内で連続スキップされる（追加の API 呼び出しは発生しない）。
>   ページング途中で上限到達が確定した場合も nextPageToken を追わず打ち切る。
> - 全50クエリを消化しても target 未達の場合は、その件数で**正常終了**し
>   サマリーに「目標未達（xxx/1000）」を明記。エリアの自動追加はしない
>   （追加エリアは設計書改訂 = Vol.1.1 としてユーザー判断で行う）。
> - 重複は `place_id` で必ず排除される（同セッション Set + DB の UNIQUE 制約）。
> - 「カフェ」「コーヒー」の2クエリで取得網羅性を担保。同店舗の重複は許容。

---

## データフロー

```
[1] 検索エリア展開
    --area で SearchAreaConfig[] を取得
        ↓
[2] テキスト検索（ページング込み）
    各エリアで searchTextAll() を呼ぶ
    1クエリあたり最大60件（20件×3ページ）
    ※グループの maxCount 到達が確定したら nextPageToken を追わず打ち切り（リクエスト節約）
        ↓
[3] 重複排除（メモリ上）
    place_id で Set 管理。同セッション内で既に取得済みなら破棄
        ↓
[4] カテゴリフィルタ（v1.2 追加）
    isCafeType(types, primaryType) が false
    → status='excluded', excluded_reason='not_cafe_type'
        ↓
[5] 営業状態フィルタ（v1.2 追加）
    businessStatus が 'OPERATIONAL' 以外（undefined は通す）
    → status='excluded', excluded_reason='closed'
        ↓
[6] ブラックリスト判定
    isBlacklisted(name, types) を全件に適用
    matched=true → status='excluded', excluded_reason='blacklist:xxx'
    全フィルタ通過 → status='new'
        ↓
[7] DB 既存チェック（任意・推奨）
    place_id IN (...) で既に DB に存在するかをバルクで確認
    存在するなら upsert で raw_data だけ更新
        ↓
[8] Supabase upsert
    100件単位でバッチ upsert（onConflict='place_id'）
        ↓
[9] 目標到達チェック
    websiteUri あり採用件数（status='new' かつ website_url 非null）が
    --target（既定1000）に達したら処理終了
    全50クエリを消化しても未達の場合はその件数で正常終了し、
    サマリーに「目標未達（xxx/1000）」を明記。**他県への拡張・エリア自動追加は行わない**
        ↓
[10] サマリー出力
```

> フィルタの適用順序（[4]→[5]→[6]）は excluded_reason の優先順位を兼ねる。
> 複数条件に該当する場合、先に判定された reason が保存される。

### 件数の目安

| 段階 | 件数イメージ |
| --- | --- |
| 名古屋市中区（カフェ+コーヒー2クエリ） | 取得約100〜120件 → 重複排除後 60〜80件 |
| 愛知 Vol.1（50クエリ） | 取得約2,500〜3,000件 → 重複排除後 1,500〜2,000件 → 各フィルタ・ブラックリスト除外後 採用 1,200〜1,600件 → うち **websiteUri あり 1,000件で打ち切り** |
| カテゴリ外・閉業除外率 | 全体の 10〜20% 程度（テキスト検索はレストラン等も返すため） |
| ブラックリスト除外率 | 全体の 5〜15% 程度 |
| websiteUri なし率（採用店中） | 個人カフェでは 30〜50% 見込み。保存はするが目標カウント外 |

### nextPageToken のページング処理

- 1回目のレスポンスに `nextPageToken` がある場合、**2秒以上待ってから**
  次リクエストを送る（Google 側で token が有効化されるまでのラグ）。
- token が無効化されている場合 `INVALID_ARGUMENT` が返るので 1回だけ
  追加で 3秒待ってリトライ。それでも失敗ならそのページは諦める。
- 最大3ページ（合計60件）で打ち切り。

---

## ブラックリスト判定

### 表記揺れ正規化（必須）

`normalizeName()` の処理順序:

1. **NFKC 正規化**: `'ｽﾀｰﾊﾞｯｸｽ'` → `'スターバックス'`, `'ＡＢＣ'` → `'ABC'`,
   全角スペース→半角スペース。
   ```ts
   s = s.normalize('NFKC')
   ```
2. **小文字化**: `s = s.toLowerCase()`
3. **記号削除**: `'·・ー－—-‐_ /\\@%\'\"`{}[]()（）「」『』、。,.!?！？'` を全て削除。
   ```ts
   s = s.replace(/[·・ー－—\-‐_ \/\\@%'"`{}\[\]()（）「」『』、。,.!?！？]/g, '')
   ```
4. **連続空白圧縮 → 前後トリム**: `s.replace(/\s+/g, '').trim()`

これにより:
- `'Café de Crié 名駅店'` → `'cafedecrie名駅店'`
- `'スターバックスコーヒー 栄店'` → `'スターバックスコーヒー栄店'`
- `'@ほーむカフェ'` → `'ほーむカフェ'`

### 完全一致 vs 部分一致の使い分け

| ケース | 判定 |
| --- | --- |
| `'DICE'`（短い英単語。"dice cafe" 等で誤爆しやすい） | `exact` |
| `'スターバックス'` | `contains`（"スターバックスコーヒー○○店" を捕捉） |
| `'猫カフェ'` | `contains`（"癒し猫カフェ○○" 等を捕捉） |
| `'ブックカフェ'` | `contains`（カテゴリ的キーワード） |

> ⚠️ **誤爆対策**: 一般語が含まれるパターンを追加するときは慎重に。
> 例えば「カフェ」「珈琲」だけでは絶対にブラックリスト化しない（個人店が消える）。

### カテゴリ的キーワードの検出

「猫カフェ」「ブックカフェ」のような業態名は `contains` 一発で捕捉する。
ユーザー指示の F〜H グループはすべてこの方式。

### 判定アルゴリズム（疑似コード）

```ts
function isBlacklisted(name: string, types?: string[]): BlacklistResult {
  const normalized = normalizeName(name)
  for (const entry of BLACKLIST) {
    for (const pattern of entry.patterns) {
      if (entry.matchType === 'exact') {
        if (normalized === pattern) return { matched: true, reason: `blacklist:${entry.id}` }
      } else {
        if (normalized.includes(pattern)) return { matched: true, reason: `blacklist:${entry.id}` }
      }
    }
  }
  // 任意: types[] による補助判定
  if (types?.includes('fast_food_restaurant')) {
    return { matched: true, reason: 'blacklist:type_fastfood' }
  }
  return { matched: false, reason: null }
}
```

---

## 検索戦略

### クエリ順序

1. `nagoya-naka` 系 → `aichi-all`（名古屋16区→主要36市の順）
2. 各エリアごとに「カフェ」「コーヒー」の2クエリを連続発行
3. クエリ間に **1秒** スリープ（API レート制限緩和 + 自宅 IP のバーストを避ける）

### テキスト検索 vs 場所バイアス検索

- **基本はテキスト検索（`places:searchText`）のみ**を使う。
  Pro SKU 課金の予測が容易（1リクエスト = 1ページ単位課金）。
- `searchNearby` は使わない（カバレッジが悪化するケースが多く、料金見積もりが
  ややこしくなるため Phase 2 では採用しない）。

### 重複防止

- セッション内: `Set<string>` で `place_id` を管理。同一セッション内の
  2回目以降の出現は破棄。
- セッション間: Supabase `cafe_prospects.place_id` の UNIQUE 制約 +
  `upsert` で重複登録を防ぐ。

---

## エラーハンドリング

### Google Places API レート制限

- HTTP `429 Too Many Requests` → 指数バックオフでリトライ（最大5回）。
  待機時間: `2^attempt * 1000ms + random(0, 500)ms`（1s, 2s, 4s, 8s, 16s）。
- HTTP `5xx` → 同様にリトライ（最大3回）。
- HTTP `4xx`（429除く） → 即エラー throw、エラーログ記録、当該クエリを諦めて次へ。

### 致命エラー

| 状況 | 動作 |
| --- | --- |
| `GOOGLE_PLACES_API_KEY` 未設定 | 起動時に `process.exit(1)` |
| `SUPABASE_SERVICE_ROLE_KEY` 未設定 | 起動時に `process.exit(1)` |
| `OWNER_USER_ID` 未設定 かつ `--user-id` 未指定 | 起動時に `process.exit(1)` |
| API キー認証エラー（HTTP 401/403） | 即終了 `process.exit(2)`、ログに「IP制限の可能性」と明記 |
| Supabase 接続エラー（連続10件失敗） | 終了 `process.exit(2)` |

### エラーログ

- すべての異常は `console.error` + 日本語メッセージ + 絵文字（❌, ⚠️）。
- スキップした店舗は `--verbose` 時のみ理由付きでログ出力。
- ⚠️ **ログに API キーや認証情報を絶対に含めないこと**（マスキングは不要、
  そもそも一切出力しない）。

### リトライ実装イメージ

```ts
async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { retries: number; baseMs: number; retryOn: (err: unknown) => boolean }
): Promise<T> {
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    try { return await fn() }
    catch (err) {
      if (attempt === opts.retries || !opts.retryOn(err)) throw err
      const delay = Math.pow(2, attempt) * opts.baseMs + Math.floor(Math.random() * 500)
      await sleep(delay)
    }
  }
  throw new Error('unreachable')
}
```

---

## Supabase 保存

### スキーマ確認（実装前に必須）

Codex は実装着手前に以下のクエリを `mcp__cab03130-...__execute_sql` または
psql で実行し、本番の `cafe_prospects` テーブル定義を確認すること:

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'cafe_prospects'
ORDER BY ordinal_position;
```

期待する主要カラム（migration 017 で作成済み想定）:
- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id)`
- `place_id text not null unique`
- `name text not null`
- `formatted_address text`
- `prefecture text`, `city text`
- `latitude numeric`, `longitude numeric`
- `primary_type text`, `types text[]`
- `phone text`, `website_url text`
- `rating numeric`, `user_rating_count int`
- `business_status text`
- `status text not null default 'new'` （`'new' | 'excluded' | 'reviewed' | 'converted'` 等）
- `excluded_reason text`
- `raw_data jsonb`
- `created_at timestamptz default now()`, `updated_at timestamptz default now()`

> **本書のカラム名と本番スキーマが食い違った場合**、Codex は本番スキーマを優先し、
> 本書を更新する PR コメントを残すこと。

### upsert 戦略

```ts
const { error } = await supabase
  .from('cafe_prospects')
  .upsert(rows, {
    onConflict: 'place_id',
    ignoreDuplicates: false,  // 既存も raw_data を最新化する
  })
```

- バッチサイズ: **100件/回**（Supabase の REST API 制限を踏まえて安全側）。
- 1バッチ失敗時はその100件を 10件単位で再投入して原因切り分け。

### raw_data に保存する内容

- `RawPlace` オブジェクトをそのまま JSON にして保存。
- **保存禁止**:
  - API キー、リクエストヘッダ、認証情報（JWT等）
  - Supabase の service role key
  - 検索クエリそのもの（漏洩リスク低だが念のため保存しない）
- `raw_data` は将来の再分析用のスナップショット。書き換え禁止のつもりで扱う。

### user_id の取得方法

優先順位:
1. CLI 引数 `--user-id <uuid>`
2. 環境変数 `OWNER_USER_ID`
3. 上記いずれも無ければ `process.exit(1)`

> Codex 補足: 既存の `user_settings` テーブルから1行目を取って自動採用するような
> 推測ロジックは入れない（本人以外の user_id を誤って使うリスクを排除）。

`.env.local` 追記例（実装時にユーザーに案内）:
```bash
GOOGLE_PLACES_API_KEY=AIza...           # IP制限あり、自宅IPで発行済み
OWNER_USER_ID=00000000-0000-0000-0000-000000000000  # Supabase auth.users.id
```

---

## 段階的実行

### Step 3-1: 名古屋市中区のみ（50件、本番テスト）

```bash
npm run fetch:cafe -- --area nagoya-naka --limit 50
```

- API キー疎通確認
- ブラックリスト判定の動作確認
- Supabase upsert の動作確認
- 取得結果50件を目視レビュー

### Step 3-2: 愛知 Vol.1 本番（1,000件目標）

```bash
npm run fetch:cafe -- --area aichi-vol1 --target 1000
```

- Vol.1 配分（名古屋700件＋豊田80件＋岡崎60件＋一宮30件＋春日井30件＋豊橋50件＋その他50件）で計1,000件取得
- 目標・配分のカウント対象は **status='new' かつ websiteUri あり**の店舗のみ
- **Enterprise SKU 無料枠 1,000リクエスト/月の範囲内（理論上限150リクエスト）、課金 $0**
- **他県への拡張は行わない**。全クエリ消化後も未達の場合はその件数で正常終了し、
  サマリーに未達を明記（エリア追加は設計書改訂のうえユーザー判断）
- 完了まで推定 20〜30分

### 中間モード（任意）

```bash
npm run fetch:cafe -- --area aichi-vol1 --target 500
```

500件で打ち切り。レビュー後に続きを実行可能（既存 place_id は upsert で自然にスキップ）。

---

## ログ仕様

### 起動時ヘッダ

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
☕ カフェ見込み顧客取得（Google Places API）
   エリア: aichi-all
   目標件数: 2000
   自動拡張: ON
   モード: 本番
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 進捗ログ（クエリごと）

```
🔍 [3/52] "カフェ 名古屋市中区" 検索中...
   ページ1: 20件取得
   ページ2: 20件取得
   ページ3: 12件取得
   ✓ 52件取得（うち重複11、ブラックリスト4 → 採用37件）
```

### スキップログ（--verbose 時のみ）

```
⏭️  スキップ: スターバックスコーヒー 栄店（blacklist:starbucks）
⏭️  スキップ: 猫カフェ もふもふ（blacklist:animalcafe）
```

### 最終サマリー

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 完了
   総API呼び出し数: 138
   取得（重複排除前）: 2,612件
   重複排除後: 1,694件
   カテゴリ外除外: 142件（excluded_reason='not_cafe_type'）
   閉業・休業除外: 38件（excluded_reason='closed'）
   ブラックリスト除外: 214件（excluded_reason='blacklist:*'）
   採用（status='new'）: 1,300件
     ├ websiteUri あり: 1,000件 ← 目標カウント対象 🎯 目標達成
     └ websiteUri なし: 300件（保存済み、目標カウント外）
   保存成功: 1,694件（new 1,300 + excluded 394）
   保存失敗: 0件
   所要時間: 28分40秒
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

目標未達で全クエリを消化した場合は `🎯 目標達成` の代わりに
`⚠️ 目標未達（842/1000）` を表示する。

---

## 環境変数

### `.env.local` に必要なキー

| 変数名 | 必須 | 説明 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase プロジェクト URL（既存） |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | service_role キー（既存）。RLS bypass で `cafe_prospects` に書き込み |
| `GOOGLE_PLACES_API_KEY` | ✅ | Google Cloud で発行、IP制限ON、Places API (New) のみ許可 |
| `OWNER_USER_ID` | ✅ | 自身の `auth.users.id`（`--user-id` で上書き可能） |

### env 読み込み方式

既存 npm script と同様 `node --env-file=.env.local --import tsx ...` を使う。
`dotenv` パッケージ追加は不要。

---

## dry-run モード

### 動作仕様

`--dry-run` フラグ指定時:

| ステップ | 動作 |
| --- | --- |
| Google Places API 呼び出し | ❌ 行わない。代わりに `src/lib/cafe-prospects/__fixtures__/sample-places.json`（後述）から読み込む |
| 重複排除 | ✅ 通常通り実施 |
| ブラックリスト判定 | ✅ 通常通り実施 |
| Supabase upsert | ❌ 行わない。代わりにコンソールに「[DRY] 保存予定: ○○」のように出力 |
| サマリー出力 | ✅ 通常通り |

### サンプルデータの用意

`src/lib/cafe-prospects/__fixtures__/sample-places.json` に 20〜30件分の
`RawPlace[]` JSON をコミットしておく。少なくとも以下を含めること:
- スターバックス系（ブラックリストでヒット）
- 猫カフェ系（ブラックリストでヒット）
- 一般的な個人カフェ（status='new'、websiteUri あり → 目標カウント対象）
- websiteUri なしの個人カフェ（status='new' だが目標カウント外）
- カテゴリ外の店（types が restaurant のみ → excluded_reason='not_cafe_type'）
- 閉業店（businessStatus='CLOSED_PERMANENTLY' → excluded_reason='closed'）
- 「ドトール」「コメダ」など各カテゴリ代表

> Codex 補足: 実 API レスポンスから1回だけ取得してマスキング（電話番号・URL等を
> ダミー化）して保存するのが簡単。

---

## 課金監視

### 予算アラート

- Google Cloud Billing で予算アラート **¥3,000/月** 設定済み
- アラートしきい値: 50%, 90%, 100%（既定）
- Vol.1 想定課金額: **$0**（Enterprise SKU 無料枠 1,000件/月の範囲内）

### スクリプト側のセーフガード（`MAX_API_REQUESTS = 200`）

`scripts/fetch-cafe-prospects.ts` の冒頭で以下の定数を定義し、main() に
セーフガードロジックを組み込むこと:

```ts
/**
 * Vol.1 想定の上限値。これを超えたら必ず一時停止する（暴走防止）。
 * クエリ数は固定50・1クエリ最大3ページなので理論上限は150。
 * 200 はバグ（無限ループ等）への保険であり、正常動作では到達しない。
 */
const MAX_API_REQUESTS = 200
```

#### 実装すべきセーフガード（3種）

**1. リクエスト総数の上限チェック**

```ts
let apiRequestCount = 0  // 実 API 呼び出しの累積カウント（dry-run 中はインクリメントしない）

async function callPlacesApi(...): Promise<...> {
  apiRequestCount++

  if (apiRequestCount > MAX_API_REQUESTS) {
    console.warn(`⚠️  API 呼び出しが ${MAX_API_REQUESTS} 件を超えました（現在 ${apiRequestCount} 件）`)
    console.warn('   想定: 約125〜150件（50クエリ×最大3ページ） / Enterprise SKU 無料枠: 1,000件/月')

    if (!argv.yes) {
      const ok = await promptUser('   続行しますか？ [y/N]: ')
      if (!ok) {
        console.log('🛑 ユーザー判断により処理を停止しました。')
        await printSummary()
        process.exit(0)
      }
    }
  }
  // ... 実際の fetch 処理 ...
}
```

- `--yes` フラグ指定時のみ確認をスキップ（CI 用、対話なし環境）
- プロンプトは標準入力から1文字読む（`readline` または `process.stdin.once('data', ...)` で実装）
- ⚠️ dry-run 時は `apiRequestCount` をインクリメントしないこと（実 API を呼ばないため）

**2. nextPageToken の予想超過検知（満杯ページ連続検知）**

```ts
let consecutiveFullPages = 0  // 連続で3ページ満杯になったクエリの数

// 1クエリ完了後に判定
if (query.pagesFetched === 3 && query.lastPageResults === 20) {
  consecutiveFullPages++
  console.log(`⚠️  満杯ページ（3ページ×20件）: ${query.id} - ${consecutiveFullPages}クエリ連続`)
  if (consecutiveFullPages >= 10) {
    console.warn('⚠️  満杯ページが10クエリ連続。想定より店舗密度が高い可能性あり。')
    console.warn('   このまま続行すると API 呼び出し数が想定を上回ります。注意して進めます。')
    // 処理は継続（停止はしない、注意喚起のみ）
    consecutiveFullPages = 0  // リセットして次の10連続をまた検知できるように
  }
} else {
  consecutiveFullPages = 0
}
```

**3. 異常終了時の課金影響レポート**

`process.on('SIGINT', ...)`, `process.on('uncaughtException', ...)`,
および main() の `finally` で**必ず**以下を出力する:

```ts
function printSummary() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`📊 課金影響レポート`)
  console.log(`   総 API 呼び出し数: ${apiRequestCount}`)
  console.log(`   SKU 階層: Enterprise（最高SKU適用）`)
  console.log(`   無料枠（1,000件/月）使用率: ${(apiRequestCount / 1000 * 100).toFixed(1)}%`)
  console.log(`   想定課金額: ${apiRequestCount <= 1000 ? '$0（無料枠内）' : `約 $${((apiRequestCount - 1000) * 0.035).toFixed(2)}（無料枠超過分）`}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}
```

これにより、Ctrl+C 中断時・エラー終了時・正常終了時すべてで課金影響が
ログに残り、Cloud Billing と照合可能になる。

### Cloud Billing alerts での検知方法

- 予算アラートメールが届いたら **即座に本スクリプトを停止**
- `ps aux | grep fetch-cafe` で実行中プロセスを確認、必要なら `kill`
- Supabase 側の保存件数も併せて確認（途中までは正常データとして残る）
- アラート受信時の保存済みデータは Vol.1 として有効活用可能（部分達成OK）

### Vol.2 への移行判断

Vol.1（1,000件）の **反応率を測定後**、追加取得の要否を判断する。

判断材料:
- フォーム送信成功率（送信できた件数 / 1,000件）
- 返信率（返信あり件数 / 送信件数）
- 商談化率（商談化件数 / 返信件数）
- ブラックリスト除外率の妥当性検証
- HPなし採用店の比率（Instagram DM 営業など別チャネル開拓の検討材料）

Vol.2 のコスト見通し: 無料枠の残り約85%（約850リクエスト ≒ 最大17,000店舗分）が
**$0 のまま**利用可能。Vol.2 の制約は課金ではなく営業キャパ（送信・対応可能数）。

Vol.2 で取得する場合:
1. 本設計書を改訂し新版（v2.0）として管理
2. 課金見積もりを再計算（Enterprise SKU 無料枠超過分の単価で）
3. 取得対象エリア・件数を確定（Vol.1 で取りこぼした地域 or 別カテゴリ）
4. ユーザー承認を得てから実行

⚠️ Vol.2 は **必ずユーザーの明示的な承認**を得てから実行すること。
Codex が自動で Vol.2 を起動することは禁止。

---

## セキュリティ

### 厳守事項

1. **API キーをコード・コメント・ログに含めない**
   - `process.env.GOOGLE_PLACES_API_KEY` の参照のみ。値の console.log 禁止。
2. **`raw_data` には Google Places API レスポンスのみ**
   - 認証情報（JWT、API key、service_role key）を絶対に含めない。
3. **`.env.local` を git に追加しない**
   - 既存 `.gitignore` に含まれていることを確認。
4. **IP 制限の確認**
   - Mac mini 以外（出張先、ノートPC）から実行すると HTTP 403 で即終了する
     ことを CLI 起動時のヘッダコメントに明記する。
   - 自宅 IP が変わった場合は Google Cloud Console で再設定が必要、と
     README に明記。
5. **`SUPABASE_SERVICE_ROLE_KEY` の取り扱い**
   - スクリプト内のみで使用。フロントエンドへの漏洩を絶対に避ける
     （本スクリプトは `scripts/` 配下にあるため Next.js バンドル対象外）。
6. **ログのスクリーンショット時の注意**
   - サマリーログにはAPI キー・認証情報が含まれないこと。
   - `place_id` は機密ではないので出力してよい。

### コードレビュー時のチェックリスト

- [ ] `console.log(process.env.GOOGLE_PLACES_API_KEY)` などが残っていないか
- [ ] エラースタックトレース出力時にリクエストヘッダが含まれていないか
- [ ] `raw_data` に保存する直前に "Authorization" 等のキーが入っていないか
- [ ] dry-run モードで実行して API 呼び出しが本当にゼロか確認

---

## 実装順序（Codex 向け）

1. `src/lib/cafe-prospects/types.ts` を作成
2. `src/lib/cafe-prospects/blacklist.ts` を作成 + 単体テスト的に dry-run で動作確認
3. `src/lib/cafe-prospects/filters.ts` を作成（カテゴリ・営業状態・website 判定）
4. `src/lib/cafe-prospects/search-areas.ts` を作成
5. `src/lib/cafe-prospects/places-client.ts` を作成（先に `--dry-run` で動作確認）
6. `scripts/fetch-cafe-prospects.ts` 本体を作成
7. `package.json` に `fetch:cafe` script 追加
8. `.env.local` に `GOOGLE_PLACES_API_KEY`, `OWNER_USER_ID` を追加（ユーザーに案内）
9. **Step 3-1**: `npm run fetch:cafe -- --area nagoya-naka --limit 50` で本番テスト
10. 結果を Supabase Table Editor で目視確認
11. 問題なければ **Step 3-2**: Vol.1 実行（`--area aichi-vol1 --target 1000`）

---

## 未確定事項・確認すべき点

実装着手前に Codex がユーザーに確認すべき点:

1. `cafe_prospects` テーブルの実カラム名・型（migration 017 のソースが
   本ワークツリーに無い）。`SELECT * FROM information_schema.columns` で確認。
2. `status` カラムの取り得る値（`'new' | 'excluded' | ...` 以外に
   `'reviewed' | 'converted'` 等の状態遷移があるか）。
3. RLS ポリシー: service_role で書き込めるか（できない場合は migration で
   `WITH CHECK (true)` などの INSERT ポリシーが必要）。
4. `OWNER_USER_ID` の値（実行者のSupabase auth.users.id）。

---

## 付録: 想定 API コスト

Google Places API (New) Text Search の料金（2025年3月以降）:

### Vol.1 想定

- **Enterprise SKU 単価**: $0.035 / リクエスト（無料枠 1,000件/月超過後）
- 1ページ = 1リクエスト = 最大20件取得
- 1クエリ最大3ページ = 1クエリあたり最大3リクエスト

### Vol.1 推定リクエスト数

- 50クエリ × 平均2.5ページ ≒ **約 125 リクエスト**（理論上限: 50×3 = **150**）
- Enterprise SKU 無料枠: **1,000 リクエスト/月**
- → Vol.1 完了時点で無料枠の約 **12.5〜15%** を消費
- → **想定課金額: $0**

> 📌 **無料枠の単位に注意**（v1.2 で認識訂正）: 無料枠は「リクエスト数」単位で、
> 1リクエスト = 最大20店舗。当初計画の2,000店舗（約250リクエスト）でも $0 だった。
> Vol.1 を 1,000件 とするのは課金制約ではなく、フォーム送信キャパと
> 効果検証母数としての営業上の判断。

### 無料枠を超えた場合の単価（参考、Vol.2 以降の検討材料）

- Enterprise SKU: $0.035/req（最初の100,000req後は段階的割引）
- クエリ数が固定50のため理論上限は150リクエスト。**無料枠超過は構造的に不可能**
- `MAX_API_REQUESTS = 200` は理論上限150への保険（バグによる無限ループ対策）
- 無料枠の残り約85%（約850リクエスト ≒ 最大17,000店舗分）は Vol.2 で $0 のまま利用可能

> ⚠️ Codex は Google Cloud Console の課金ダッシュボードを **起動前後で必ず確認**し、
> 概算と乖離があればユーザーに即報告すること（特に Step 3-2 完了時）。

