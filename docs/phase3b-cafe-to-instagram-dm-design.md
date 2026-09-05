# 設計書: カフェ → Instagram DM 橋渡し（Phase 3-IG）ドラフト v0.1

> **結論を先に**: 「安全に Instagram DM を送る仕組み」は**既に完成している**。
> 本設計でやるのは「収集したカフェを既存 Instagram 基盤に流し込む“橋渡し”」だけ。
> 新規に作る送信機能・安全機能は**ない**。

---

## 背景（実データで判明したこと）

Phase 2 で収集したカフェの「website」を調べたところ:
- 個人カフェは**独自HPを持たず Instagram を公式サイトにしている**ケースが非常に多い
- メール収集の歩留まりは低い → **カフェ営業の本命チャネルは Instagram DM**

→ なので「カフェ → Instagram DM」を主軸に据える。

---

## 既存の Instagram DM 基盤（再利用するもの・新規開発しない）

| 既存資産 | 場所 | 役割 |
| --- | --- | --- |
| `instagram_targets` テーブル | migration 007/008 | DM対象管理（status, dm_sent, dm_replied 等） |
| `instagram_safety_settings` | migration 015 | **BAN対策**（日次上限20・間隔5分・ウォームアップ） |
| `instagram_activity_log` | migration 014 | dm_sent/like/follow の記録（安全カウント用） |
| `instagram-safety.ts` | src/lib | ウォームアップ（週1:5→週2:10→週3:15→通常20）・間隔制御 |
| Instagram ダッシュボード | `src/app/dashboard/instagram` | 対象一覧・統計・安全表示 |
| `DmModal.tsx` | src/components/instagram | **AI生成→コピー→ig.me/m/{username}でDM画面直行→送信済み記録** |
| `NextTargetSuggestion.tsx` | 同上 | 安全枠内で「次に誰にDMすべきか」提案 |
| `bulkCreateTargets()` | dashboard/instagram/actions.ts | **一括インポート**（onConflict: user_id,username で重複排除） |
| `/api/generate-dm` | src/app/api | DM文面のAI生成 |

### 既存DM送信フロー（変更不要・優秀）
```
対象を開く → AIでDM生成 → コピー → 「Instagramで送る」(ig.me/m/username)
→ Instagramで貼り付け送信 → 「DM送信済みにする」
   （安全システムが日次上限/間隔に達したら送信ボタンを自動ロック）
```
> Instagram は API で勝手にDMを送れない（送るとBAN）。この「半自動＋ウォームアップ」が
> アカウントを守る正しいやり方。**この仕組みをそのまま使う**。

---

## 設計の肝：cafe_prospects → instagram_targets の橋渡し

```
Phase 2: カフェ収集（website に instagram.com/... が入っている店が多数）
   ↓  ★本設計：橋渡し
instagram_targets に登録（username + カフェ情報）
   ↓
既存 Instagram ダッシュボードでそのままDM運用（AI生成・安全送信・追跡）
```

### 実装方式（2案、併用可）
- **A. スクリプト** `scripts/bridge-cafe-to-instagram.ts`（まず作るならこれ）
  - `cafe_prospects` から Instagram を持つ行を読み、`instagram_targets` に一括 upsert
  - service_role + OWNER_USER_ID で実行（Phase 2 と同じ作法）
- **B. UI ボタン**（将来）
  - カフェ一覧画面に「Instagram対象に追加」ボタン（cafe_prospects UI 実装後）

---

## Instagram ユーザー名の抽出ロジック

カフェの Instagram は2経路で得られる:

1. **website が既に Instagram**（最頻ケース）
   - 例: `https://www.instagram.com/groovecoffee_nagoya?igsh=...`
   - `instagram.com/{handle}` から handle を抽出
2. **本物のHPから抽出**（Phase 3 の `findInstagramUrl` を流用）
   - HP内の Instagram リンクを拾う

### 正規化（必須）
```ts
function extractInstagramUsername(url: string): string | null {
  // instagram.com/<handle> の <handle> を取り出す
  // - クエリ(?igsh=...)・末尾スラッシュ・@ を除去
  // - 予約パス(p, reel, explore, stories, direct 等)は除外
  // - 小文字化
  // 例: https://www.instagram.com/groovecoffee_nagoya?igsh=xx → "groovecoffee_nagoya"
}
```
除外すべきパス: `p/`, `reel/`, `reels/`, `explore/`, `stories/`, `direct/`, `tv/`

---

## マッピング（cafe_prospects → instagram_targets）

| instagram_targets | 値（cafe_prospects から） |
| --- | --- |
| `user_id` | OWNER_USER_ID |
| `username` | 抽出した Instagram handle（正規化済み） |
| `display_name` | `name`（店名） |
| `industry` | `'カフェ'`（固定。primary_type を併記してもよい） |
| `bio` | null（将来 Instagram プロフィールから取得可） |
| `follower_count` / `engagement_rate` | null（Google からは取れない。任意で後日IG取得） |
| `status` | `'未対応'` |
| `notes` | 由来情報（例: `cafe_prospect:{id} / {formatted_address} / {website}`） |

### 重複排除（⚠️ 本番調査で要対応が判明）
- `bulkCreateTargets` と同じく **onConflict: `user_id,username` / ignoreDuplicates** を使いたい
- **本番調査結果（2026-06-25 時点）**:
  - `instagram_targets` の UNIQUE 制約は **`id` の主キーのみ**。`(user_id, username)` の UNIQUE は**存在しない**
  - 既存データ **2,140件**、うち **重複ユーザー名 74組**あり
  - → **既存 `bulkCreateTargets` の `onConflict:'user_id,username'` は現状エラーになるはず**（制約不在）＝隠れ不具合
- **必要な前提 migration（Phase 3-IG 実装の最初にやる）**:
  1. **既存重複の掃除**: `(user_id, lower(username))` ごとに1行残して他を削除
     （残す優先: dm_sent=true > status進行度が高い > created_at が古い、など。データを失わない方針）
  2. `instagram_targets` に **`unique (user_id, lower(username))`** 制約 or 一意インデックスを追加
     - 大文字小文字を無視するため `lower(username)` の式インデックス推奨
     - （`bulkCreateTargets`/本ブリッジの `onConflict` 対象もこれに合わせる）
  3. 併せて `createTarget`/`bulkCreateTargets` の username 正規化（lower化）を揃える

### 逆参照（任意・推奨）
- `cafe_prospects` 側にも `contact_method='instagram'` をセットし、
  「この店はIG対象に登録済み」を分かるようにする（Phase 3 と整合）

---

## カフェ向け DM 文面の方針

既存 `/api/generate-dm` は username/display_name/bio/industry/follower_count を見て生成する。
カフェ用に質を上げるには:

- `industry='カフェ'` が入るだけでも AI はカフェ向けに寄せられる
- さらに良くするなら、生成プロンプトに**カフェ営業の切り口**を渡す:
  - 例: 「店舗向けの〇〇（自社商材）を、忙しいカフェオーナーに響く短文で」
  - rating/レビュー数があれば「人気店ですね」的な一言（任意）
- ⚠️ Instagram DM は**短く・宣伝臭くなく・1通目は売り込みすぎない**のが返信率を上げる
  （長文・テンプレ感はブロック/未読の元）

> 文面テンプレの最終調整は、Vol.1 でDMを数十件送って反応を見てからが現実的。

---

## 安全・マナー（既存システムに準拠）

- **送信は人間の手**（ig.me 経由でInstagramアプリ/Webで貼り付け送信）。完全自動化はしない＝BAN回避
- 既存の**ウォームアップ**（新規アカは週5→10→15→20件/日）に従う
- 日次上限・送信間隔は `instagram_safety_settings` のまま
- 大量の対象を `instagram_targets` に入れても、**送信ペースは安全システムが律速**するので安全
  （= 橋渡しで1000件入れても、実際の送信は1日数〜20件に自動制限される）

---

## 段階的導入

- **Step 1**: Vol.1 のカフェのうち Instagram を持つ店を抽出（件数把握、dry-run）
- **Step 2**: 10〜20件だけ `instagram_targets` に登録 → 既存ダッシュボードで実際にDMを数件送って文面・反応を確認
- **Step 3**: 残りを一括登録 → 安全枠内で日々DM運用

---

## このPhaseの位置づけ（全体像）

```
Phase 2: カフェ収集（website・phone）                     ✅実装済み
Phase 3: 連絡先抽出（メール/フォーム/Instagram判定）        設計済み(ドラフト)
Phase 3-IG（本書）: カフェ→instagram_targets 橋渡し         設計(ドラフト)
   ↓
既存 Instagram ダッシュボード: AI生成→ig.me→安全送信→追跡   ✅既に完成
```

---

## 未確定事項（実装前に確認）

1. ~~`instagram_targets` に `(user_id, username)` UNIQUE があるか~~
   → **確認済み: 存在しない**（主キー id のみ）。既存2,140件中74組が重複。
   → 実装の最初に「重複掃除 + UNIQUE制約追加」migration が必須（上記「重複排除」参照）
   → 既存 `bulkCreateTargets` の不具合修正も兼ねる
2. 橋渡しは「スクリプト先行」でよいか（UI は後回し）→ **スクリプト先行を推奨**
3. `findInstagramUrl` を Phase 3 と共有モジュール化するか（`src/lib/instagram-detector.ts`）
4. follower_count 等を Instagram から取得するか
   → Vol.1 では不要。DM運用が回り始めてから必要なら検討
5. カフェ向けDM生成プロンプトを `/api/generate-dm` に足すか、汎用のままか
   → まずは industry='カフェ' のみで運用し、反応を見て調整
