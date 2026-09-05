# Phase 2-B 設計書: リスト収集の全業種対応（ドラフト v0.1）

> **Codex 向け実装指示書（ドラフト）**
> Phase 2 のカフェ収集（`fetch-cafe-prospects.ts`）を **13業種で使える汎用収集** に一般化する。
> カフェ版は動作実証済み（実データ10件・バグ修正済み）。その構造を壊さず「業種設定」で切り替える。

---

## 概要

### 目的
Google Places API から、指定した**業種**の店舗を愛知（将来は全国）で収集し、
`prospects` テーブルに **`industry` タグ付き**で保存する。業種は Phase 4 の
文面テンプレ自動選択にそのまま連動する。

### 対象13業種
サウナ / 美容サロン / カフェ / 中華 / 焼肉 / フレンチ / イタリアン /
キッチンカー / 雑貨屋 / スーパーマーケット / 百貨店 / 高級食品スーパー / お土産屋

### 設計方針
- **カフェ版の3モジュールを業種で差し替え可能にする**（新エンジンは作らない）
- 業種ごとの違いは **1ファイルの設定（IndustryConfig）に集約**
- Places API のフィールドマスク・ページング・安全装置・dry-run は Phase 2 のまま流用

---

## DB 変更

### テーブル名の判断（重要）
現状 `cafe_prospects`（本番11件・UIなし）。13業種を入れるなら名前が不適切。

- **推奨**: いま `prospects` にリネーム + `industry` 追加（11件・UI無しの今なら低コスト）
- 代替: 名前はそのまま `cafe_prospects` に `industry` 追加（リネーム回避・ただし誤称が残る）

→ **推奨案でいく前提**で以下を記述。リネームしない場合はテーブル名を読み替え。

### migration `019_rename_cafe_prospects_and_add_industry.sql`
```sql
alter table if exists public.cafe_prospects rename to prospects;
alter table public.prospects add column if not exists industry text;
create index if not exists prospects_industry_idx on public.prospects(user_id, industry);
-- 既存11件はカフェ収集分なので industry を 'カフェ' で埋める
update public.prospects set industry = 'カフェ' where industry is null;
```
> ⚠️ リネームに伴い Phase 2 の `CafeProspectRow` の参照テーブル名・型名も更新が必要。
> `status` の CHECK 制約（untouched/verified/excluded/promoted）はそのまま流用。

---

## ファイル構成（一般化）

```
src/lib/prospects/
├── industry-configs.ts   # ★業種ごとの設定（キーワード・Placesタイプ・ブラックリスト）
├── filters.ts            # isTargetType(types, primaryType, config) に一般化
├── blacklist.ts          # 判定ロジックは共通、リストは config から受け取る
├── search-areas.ts       # エリア定義（業種非依存。Phase 2 のものを流用）
├── places-client.ts      # Phase 2 のまま（fieldMask 変更なし）
└── types.ts              # ProspectRow に industry を追加

scripts/
└── fetch-prospects.ts    # 一般化版（fetch-cafe-prospects.ts を汎用化）
```

### npm script
```jsonc
"fetch:prospects": "node --env-file=.env.local --import tsx scripts/fetch-prospects.ts"
```
実行例:
```bash
npm run fetch:prospects -- --industry 焼肉 --area aichi-vol1 --target 500
npm run fetch:prospects -- --industry 美容サロン --area nagoya-naka --limit 50 --dry-run
```

---

## IndustryConfig（設計の心臓部）

```ts
import type { BlacklistEntry } from './blacklist'
import type { Industry } from '@/lib/industries'

export interface IndustryConfig {
  id: Industry
  /** テキスト検索に使うキーワード（各エリア × 各keywordでクエリ発行） */
  searchKeywords: string[]
  /** 採用対象とする Google Places の type（primaryType/types に含まれれば採用） */
  placesTypes: string[]
  /** この業種の除外チェーン（大手・非対象） */
  blacklist: BlacklistEntry[]
  /** 収集ソース: 'places'（既定） or 'external'（Places非対応業種） */
  source?: 'places' | 'external'
  /** Placesタイプで絞りきれない業種向けの補助キーワード（名前に含めば採用/除外の判断補助） */
  nameMustIncludeAny?: string[]
}

export const INDUSTRY_CONFIGS: Record<Industry, IndustryConfig> = { /* 下記 */ }
```

`filters.ts` の一般化:
```ts
export function isTargetType(
  types: string[] | undefined,
  primaryType: string | null | undefined,
  config: IndustryConfig,
): boolean {
  const set = new Set(config.placesTypes)
  if (primaryType && set.has(primaryType)) return true
  return (types || []).some(t => set.has(t))
}
```

---

## 業種 → Places タイプ / キーワード 対応表

> ⚠️ Places API (New) の type 名は変わりうるので**実装前に最新の type 一覧を確認**すること。
> 「収集しやすさ」列は正直な難易度。

| 業種 | searchKeywords | placesTypes（候補） | 収集しやすさ |
| --- | --- | --- | --- |
| カフェ | カフェ, コーヒー | cafe, coffee_shop | ◎（実証済み） |
| 焼肉 | 焼肉, ホルモン | barbecue_restaurant, korean_restaurant | ◎ |
| 中華 | 中華, 中華料理 | chinese_restaurant | ◎ |
| フレンチ | フレンチ, フランス料理 | french_restaurant | ◎ |
| イタリアン | イタリアン, パスタ, ピザ | italian_restaurant, pizza_restaurant | ◎ |
| 美容サロン | 美容室, ヘアサロン, ネイル, エステ | hair_salon, beauty_salon, nail_salon | ◎ |
| スーパーマーケット | スーパー, 食品スーパー | supermarket, grocery_store | ○ |
| 百貨店 | 百貨店, デパート | department_store | ○（数が少ない） |
| 雑貨屋 | 雑貨, セレクトショップ, ギフト | gift_shop, store, home_goods_store | △（typeが広く要名前フィルタ） |
| お土産屋 | お土産, 土産, 物産 | gift_shop, store | △（type弱→nameMustIncludeAny併用） |
| 高級食品スーパー | 高級スーパー, 成城石井, 紀ノ国屋 等 | supermarket, grocery_store | △（typeで“高級”を判別不可→名前/ブランドで） |
| キッチンカー | キッチンカー, フードトラック, 移動販売 | （該当typeなし） | ✕（Places不向き。SNS/専用サイト等 別ソース推奨） |
| サウナ | サウナ, 温浴 | spa ほか（sauna type有無は要確認） | △（既に sauna-ikitai 収集資産あり→そちら流用推奨） |

### 収集しにくい業種の扱い（正直な設計）
- **キッチンカー**: Places に適切な type がない。→ 本Phaseの対象外にし、別ソース（Instagram/専用アプリ/イベント出店情報）を Phase 別で検討
- **サウナ**: 既存の `scrape-sauna-ikitai.ts` が専門的で精度が高い。**Placesで取り直さず既存パイプラインを使い**、収集後 `industry='サウナ'` を付与
- **お土産/雑貨/高級食品**: type だけでは絞れない → `nameMustIncludeAny` と `blacklist` を厚めにして精度を担保。初回は件数控えめ + 目視レビュー前提

---

## ブラックリスト戦略（業種別）

判定ロジック（NFKC正規化・exact/contains）は Phase 2 の `blacklist.ts` を共通利用。
**リスト（BlacklistEntry[]）を業種ごとに config で持つ**。

初期の代表チェーン（各業種、まずはこの粒度で。運用しながら追加）:

- 焼肉: 牛角, 安楽亭, 焼肉きんぐ, 叙々苑, 安安, 情熱ホルモン, 七輪房, カルビ大将
- 中華: 餃子の王将, 大阪王将, バーミヤン, 日高屋, 幸楽苑, 紅虎餃子房
- イタリアン: サイゼリヤ, カプリチョーザ, ピザーラ, ドミノ, ピザハット, 五右衛門
- フレンチ: （大手チェーン少。ビストロ系の全国チェーンのみ。基本は個店採用）
- 美容サロン: QBハウス, 田谷, TAYA, Ash, EARTH, Agu, 11cut, プラージュ, カットファクトリー
- スーパー: イオン, マックスバリュ, アピタ, ピアゴ, バロー, ヤマナカ, フェルナ, 業務スーパー, 西友, イトーヨーカドー
- 百貨店: 高島屋, 三越, 伊勢丹, 松坂屋, 名鉄百貨店, JR名古屋タカシマヤ（※百貨店は“大手そのもの”が対象になり得る→除外は要検討）
- 高級食品スーパー: （逆に成城石井・紀ノ国屋・DEAN&DELUCA等は**対象にしたい**ケースあり→除外ではなくホワイトリスト的扱いも検討）
- 雑貨: 無印良品, ニトリ, 3COINS, フランフラン, ロフト, 東急ハンズ, セリア, ダイソー, キャンドゥ
- お土産: （空港/駅ナカの大手売店チェーン。多くは個店・観光施設が対象）
- カフェ: Phase 2 の63項目をそのまま流用

> ⚠️ 業種により「チェーン＝除外」が必ずしも正しくない（百貨店・高級食品スーパーは大手こそ商談価値がある）。
> **除外か対象かは業種戦略で変わる**ので、config にコメントで方針を明記する。

---

## データフロー（Phase 2 と同じ + industry）

```
--industry 焼肉 --area aichi-vol1
   ↓
INDUSTRY_CONFIGS['焼肉'] を取得
   ↓
各エリア × searchKeywords でテキスト検索（Phase 2 のページング/安全装置そのまま）
   ↓
重複排除 → isTargetType(config) → 営業状態 → blacklist(config)
   ↓
prospects に upsert（industry='焼肉' 付き、onConflict: user_id,place_id）
```

---

## CLI（Phase 2 を拡張）

Phase 2 の全フラグ（--area/--limit/--target/--dry-run/--verbose/--yes）に加え:
- `--industry <業種名>` … **必須**。INDUSTRY_CONFIGS のキー（正規名）
  - 不正な業種名なら利用可能一覧を出して終了

---

## 段階的導入

1. migration 019（リネーム + industry）+ Phase 2 コードのテーブル名更新
2. `industry-configs.ts` に **まず飲食4業種（焼肉・中華・イタリアン・カフェ）** を実装
3. `fetch-prospects.ts` に一般化（`--industry` 追加、config 経由に）
4. `--industry 焼肉 --area nagoya-naka --limit 50 --dry-run` で分類ロジック確認
5. 実収集を小さく → Supabase で目視 → 問題なければ残り業種の config を追加
6. Places不向きの キッチンカー/サウナ は別扱い（上記）

---

## Phase 4（業種別テンプレ）との連動
- 収集時に付与した `prospects.industry` が、昇格後 `leads.industry` に引き継がれ、
  Phase 4 の `resolveTemplate` が業種テンプレを自動選択する
- **収集 → 業種タグ → 業種別文面** が一気通貫でつながる

---

## 未確定事項
1. テーブルを `prospects` にリネームするか（推奨）／`cafe_prospects` のまま industry 追加か
2. Places type 名の最新確認（barbecue_restaurant 等の正確な type 名）
3. キッチンカーの収集ソース（別Phase）
4. 百貨店・高級食品スーパーは「大手を除外しない」方針でよいか（要確認）
5. 全業種を一度に作るか、飲食から段階投入か → **段階投入を推奨**
