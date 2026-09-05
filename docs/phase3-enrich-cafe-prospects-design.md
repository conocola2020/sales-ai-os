# Phase 3 設計書: enrich-cafe-prospects.ts（連絡先抽出）

> **実装済み（v1.0, 2026-07-03）** — 本書の設計どおり実装し、実データで検証済み。
> 実装時に判明した設計外の知見は末尾「実装時の学び」を参照。

> **Codex 向け実装指示書（ドラフト v0.1）**
> Phase 2 で収集した `cafe_prospects`（HP・電話あり）の各店舗HPを巡回し、
> **メール / 問い合わせフォームURL / Instagram** を抽出して DB を埋める。
> ⚠️ 最重要方針: **新規ロジックを書かない**。既存の連絡先検出コードを再利用する。

---

## 概要

### 目的
`cafe_prospects` の `website`（HP）を起点に、各サイトを巡回して連絡手段を特定し、
以下のカラムを埋める：
- `email`（問い合わせ用メール）
- `contact_form_url`（問い合わせフォームのURL）
- `instagram_url`（店舗のInstagram）
- `contact_method`（`form` / `email` / `instagram` / `manual` / `none`）

これにより「営業可能な連絡先リスト」が完成し、既存の送信フロー
（フォーム送信 / メール / Instagram DM）に流し込める状態になる。

### 前提（Phase 2 完了済み）
- `cafe_prospects` に愛知のカフェが保存済み（`status='untouched'`, `website` あり多数）
- `website` が null の行は対象外（HPがないと巡回できない）

### スコープ外（やらないこと）
- フォーム送信そのもの（Phase 2 とは別の既存パイプライン）
- 電話番号の追加取得（Phase 2 で `phone` 取得済み）
- HPがない店のInstagram探索（Google検索等は本Phaseでは行わない）

---

## 既存コードの再利用（最重要）

| 既存資産 | 場所 | Phase 3 での役割 |
| --- | --- | --- |
| `detectContact(url)` | `src/lib/contact-detector.ts` | **中核**。HP取得→メール抽出→フォーム検出→recaptcha判定を一括実行 |
| `extractEmails(html)` | 同上（export済み） | `detectContact` 内部で使用。単体でも利用可 |
| `findInstagramUrl(url)` | `scripts/find-instagram-from-hp.ts` | Instagram URL 抽出。**共通モジュールへ切り出して再利用** |
| `detect-contacts.ts` のループ構造 | `scripts/detect-contacts.ts` | 同時実行制御・進捗ログ・引数パースの手本 |

### `detectContact` の戻り値（既存）

```ts
interface ContactDetectionResult {
  method: 'form' | 'email' | 'none'
  contactUrl?: string      // フォームのURL
  email?: string           // 検出メール（先頭1件）
  hasRecaptcha?: boolean   // フォームにrecaptchaがあるか
  error?: string
}
```

→ これに **Instagram 抽出**を足すだけで Phase 3 の判定材料が揃う。

### リファクタ提案（小）
`scripts/find-instagram-from-hp.ts` 内の `findInstagramUrl()` を
`src/lib/instagram-detector.ts` に切り出し、Phase 3 と既存スクリプトの両方から
import できるようにする（重複実装を避ける）。

---

## ファイル構成

### 新規作成
```
scripts/
└── enrich-cafe-prospects.ts        # メインスクリプト

src/lib/
└── instagram-detector.ts           # findInstagramUrl を切り出し（リファクタ）
```

### npm script 追加
```jsonc
"enrich:cafe": "node --env-file=.env.local --import tsx scripts/enrich-cafe-prospects.ts"
```

実行例:
```bash
npm run enrich:cafe -- --limit 20 --dry-run     # 20件、DB更新せず結果表示のみ
npm run enrich:cafe -- --limit 50               # 50件、本番更新
npm run enrich:cafe                              # 未処理を全件
```

---

## 関数仕様

### `scripts/enrich-cafe-prospects.ts`

```ts
interface CliOptions {
  limit: number | null     // 処理上限（既定: なし=全件）
  dryRun: boolean          // DB更新せずコンソール出力のみ
  force: boolean           // 検出済み(contact_method != null)も再処理
  userId: string           // OWNER_USER_ID
  verbose: boolean
}

async function main(): Promise<void>
```

### 連絡手段の統合判定（新規・薄いロジック）

```ts
interface EnrichResult {
  email: string | null
  contactFormUrl: string | null
  instagramUrl: string | null
  contactMethod: 'form' | 'email' | 'instagram' | 'manual' | 'none'
  hasRecaptcha: boolean
}

/**
 * detectContact() + findInstagramUrl() を呼び、統合判定する。
 */
async function enrichOne(website: string): Promise<EnrichResult>
```

---

## データフロー

```
[1] 対象取得
    cafe_prospects から website is not null かつ
    （force でなければ contact_method is null）の行を取得
        ↓
[2] 各店舗を順次処理（同時実行は控えめ: CONCURRENCY=2〜3）
    enrichOne(website):
      a. detectContact(website)  → method, contactUrl, email, hasRecaptcha
      b. findInstagramUrl(website) → instagram_url
        ↓
[3] contact_method を決定（後述ロジック）
        ↓
[4] DB更新（1件ずつ or 小バッチ）
    email / contact_form_url / instagram_url / contact_method を更新
        ↓
[5] サイト間で待機（1.5〜2秒、相手サーバー負荷に配慮）
        ↓
[6] サマリー出力（営業可能件数の内訳）
```

### 件数の目安（HPあり店が対象）
- HPあり店のうち、フォーム検出率: 体感 40〜60%
- メール検出率: 20〜40%
- Instagram検出率: 30〜50%（個人カフェはInstagram率高い）
- いずれも取れない `none`: 10〜25%

---

## contact_method 決定ロジック

`cafe_prospects.contact_method` の CHECK 制約は
`('form', 'email', 'instagram', 'manual', 'none')`。

優先順位（既存パイプラインの送りやすさ順）:

```ts
function decideContactMethod(r: {
  contactFormUrl: string | null
  hasRecaptcha: boolean
  email: string | null
  instagramUrl: string | null
}): 'form' | 'email' | 'instagram' | 'manual' | 'none' {
  // フォームあり & recaptchaなし → 自動フォーム送信可能
  if (r.contactFormUrl && !r.hasRecaptcha) return 'form'
  // フォームあり & recaptchaあり → 自動送信不可、手動/Chrome経由 → 'manual'
  if (r.contactFormUrl && r.hasRecaptcha) return 'manual'
  // メールあり → メール送信
  if (r.email) return 'email'
  // Instagramのみ → DM（手動/Chrome）
  if (r.instagramUrl) return 'instagram'
  return 'none'
}
```

> 補足: `manual` は「フォームはあるが recaptcha で自動送信できない」ケース。
> 既存の送信方式2（Claude in Chrome）で送る対象になる。

---

## 対象選定（どの行を処理するか）

```sql
select id, website
from cafe_prospects
where user_id = :owner
  and website is not null
  and status = 'untouched'        -- excluded（チェーン等）は連絡先不要
  and contact_method is null      -- 未処理のみ（--force で無視）
order by created_at
limit :limit;
```

- `status='excluded'` の行（チェーン・閉業等）は**処理しない**（営業対象外）
- `contact_method` が既に入っている行はスキップ（`--force` で再処理可）
- HP（website）がない行は対象外

---

## レート制限・マナー

- **これは外部サイト（各カフェの自社HP）への GET アクセス**。POSTや送信は一切しない。
- 相手サーバーに配慮:
  - サイト間待機: **1.5〜2秒**
  - 同時実行: **2〜3** まで（`detect-contacts.ts` は CONCURRENCY=3）
  - User-Agent は既存 `contact-detector.ts` のものを踏襲（一般的なブラウザUA）
- タイムアウト: `detectContact` 内部の `FETCH_TIMEOUT`（既存60秒）に準拠
- robots.txt: 連絡先ページの軽量な閲覧であり、既存 `detect-contacts.ts` と同方針

---

## エラーハンドリング

- HPにアクセスできない（タイムアウト/404/SSLエラー）→ `contact_method='none'` で記録、継続
- `detectContact` は内部で try/catch 済み（`{ method:'none', error }` を返す）
- 1件失敗しても**残りは継続**（既存スクリプト同方針）
- 連続失敗が多い場合もそのまま継続（外部サイト都合のため）

---

## DB保存

```ts
await supabase
  .from('cafe_prospects')
  .update({
    email: result.email,
    contact_form_url: result.contactFormUrl,
    instagram_url: result.instagramUrl,
    contact_method: result.contactMethod,
    updated_at: new Date().toISOString(),
  })
  .eq('id', prospectId)
  .eq('user_id', opts.userId)   // 複合スコープで安全に
```

- `status` は変えない（`untouched` のまま。精査は人間/別Phase）
- `notes` も変えない（Phase 2 の除外理由用）
- `raw_data` は触らない

---

## 段階的実行

- **Step 1**: `--limit 10 --dry-run` … 抽出ロジックの目視確認（DB更新なし）
- **Step 2**: `--limit 30` … 本番更新を小さく試す → Supabase で結果確認
- **Step 3**: 全件 … `npm run enrich:cafe`

---

## ログ仕様

### 進捗（1件ごと）
```
[12/50] CAFE TOLAND（https://...）
   → form（recaptchaなし） / email: info@... / IG: あり
```

### サマリー
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 連絡先抽出 完了
   処理: 50件
   ├ form（自動送信可）: 22件
   ├ manual（フォーム+recaptcha）: 6件
   ├ email: 9件
   ├ instagram: 8件
   └ none（連絡手段なし）: 5件
   営業可能（none以外）: 45件 / 50件
   所要時間: 3分20秒
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 環境変数

Phase 2 と同じ。追加なし。
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OWNER_USER_ID`
- （Google Places API キーは Phase 3 では**不要**。HP巡回のみ）

---

## セキュリティ・注意

- 抽出したメール/URLのみ保存。認証情報は保存しない。
- 外部サイトへのアクセスは GET のみ。フォーム送信は行わない（別パイプライン）。
- 検出メールのノイズ除外は既存 `NOISE_EMAIL_DOMAINS` を踏襲。
- ⚠️ `contact_method` が決まっても、それは「連絡手段の候補」であり、
  実際の送信可否は送信時に既存パイプラインが最終判断する。

---

## 既存フローとの接続（このPhaseの出口）

```
Phase 2: カフェ収集（website・phone）
   ↓
Phase 3: 連絡先抽出（email・form・instagram・contact_method）← 本設計
   ↓
精査/昇格: cafe_prospects → leads へ昇格（status: untouched→verified→promoted）
   ↓
既存パイプライン: 文面生成 → フォーム送信 / メール / Instagram DM
```

> 「精査/昇格」（cafe_prospects → leads）の仕組みは未設計。
> Phase 3 完了後、Phase 4 として「昇格UI/スクリプト」を別途検討する。

---

## 実装時の学び（v1.0 で判明・対応済み）

実データ（愛知カフェ Vol.1）で初めて見えた、設計書に無かった問題:

1. **`website` が自社HPとは限らない**（最重要）
   - Google Places の websiteUri が Instagram プロフィールのカフェが多数（初回サンプルでは10件中5件）
   - 食べログ / ホットペッパー / Twitter が websiteUri のケースもあり、
     これを巡回すると**ログインフォーム等を問い合わせフォームと誤検出**する
   - → `classifyWebsite()` を追加。ドメインで振り分け:
     - `instagram.com` → それ自体を `instagram_url` に採用（巡回不要・即 instagram 判定）
     - SNS（twitter/x/facebook/line/tiktok/youtube）→ 巡回しない（none 扱い）
     - グルメポータル（tabelog/hotpepper/retty/gnavi/ubereats/demae-can）→ 巡回しない（none 扱い）
   - 効果: 営業可能率が 3/10 → 7/10 に改善、誤検出ゼロに

2. **`contact_method` のデフォルト値問題**
   - migration 017 で `default 'none'` が付いていたため、収集直後の行が
     「処理済み(none)」に見え、対象取得が0件になった
   - → migration 018 でデフォルトを外し、既存行を null（=未処理）にリセット

3. **カフェは Instagram 比率が想定より高い**
   - 設計時の想定「Instagram検出率 30〜50%」に対し、実測は約50%（instagram 判定 + form/email の副次IG検出）
   - Phase 3-IG（Instagram DM 送信）の価値が想定より大きい

## 未確定事項（実装前に確認）

1. 昇格フロー（cafe_prospects → leads）はこのPhaseに含めるか別Phaseか
   → **別Phase（Phase 4）を推奨**。Phase 3 は連絡先抽出に専念。
2. `instagram_url` 抽出を `detectContact` に統合するか、別関数のままか
   → 別関数（`findInstagramUrl`）のままにし、`enrichOne` で束ねるのが疎結合で良い。
3. recaptcha ありフォームを `manual` にするか `form` のままにするか
   → `manual` 推奨（自動送信パイプラインに渡さないため）。要ユーザー確認。
