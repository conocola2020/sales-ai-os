# MEO / AIO対策ツール 仕様書 & プロンプト設計

参考: ReAIch（reaich.optimize-business.com）の管理画面スクリーンショット
対象店舗（初期データ）: コーノスパイス（愛知県名古屋市・スパイスカレー店）

## 1. 目的

ローカルビジネス（飲食店等）の集客チャネルを2軸で最適化する。

- **MEO** (Map Engine Optimization): Googleマップ・各種ディレクトリでの露出と口コミ対応の最適化
- **AIO** (AI Optimization / LLMO): ChatGPT・Gemini・Perplexity・Claude などのAI検索で
  「おすすめ店舗」として言及される状態を作り、その可視性を計測する

## 2. 画面構成（/dashboard/meo 配下）

| 画面 | パス | 参考画像 | 内容 |
|---|---|---|---|
| MEOダッシュボード | `/dashboard/meo` | - | サイテーション数・口コミ統計・AIO言及率のサマリ |
| 口コミ管理 | `/dashboard/meo/reviews` | 口コミ・投稿画面 | 口コミ一覧（評価・ステータス・返信）、AI返信生成 |
| サイテーション | `/dashboard/meo/citations` | サイテーション一覧 | AIリスティング / ボイスアシスタント / プラットフォームの連携ステータス |
| AIO可視性チェック | `/dashboard/meo/aio` | - | AI検索クエリを実行し自店舗の言及有無・順位を記録 |

## 3. データモデル（Supabase）

- `meo_locations` — 店舗（name, address, category, website, google_place_id）
- `meo_reviews` — 口コミ（source, author, rating, body, reply_body, reply_status: 未返信/下書き/返信済み/自動返信済/返信不要）
- `meo_citations` — サイテーション（kind: ai/voice/platform, name, domain, status: 同期済み/送信済み/未連携/エラー, indexed, listing_url）
- `meo_aio_checks` — AIO計測結果（engine, query, mentioned, rank, snippet, answer）

全テーブル RLS 有効（`auth.uid() = user_id`）。

## 4. プロンプト設計

### 4-1. 口コミAI返信生成（/api/meo/generate-reply）

**System プロンプト:**

```
あなたは飲食店の口コミ返信を専門とするプロのカスタマーサポート担当です。
Googleビジネスプロフィールの口コミに対する返信文を1つだけ生成してください。

ルール:
- 冒頭で来店と口コミへの感謝を必ず述べる
- 口コミ本文の具体的な内容（メニュー名・体験）に必ず1箇所以上触れる
- 星4以上: 喜びを伝え、再来店を促す一言で締める
- 星3以下: 真摯に謝罪し、指摘内容への具体的な改善姿勢を示す。言い訳をしない
- 150〜300字、絵文字・顔文字・記号装飾は使わない
- 店舗のMEOに有効なため、店名と主力メニュー名を自然に1回含める
- 返信文のみを出力する（前置き・説明は不要）
```

**User プロンプト（変数埋め込み）:**

```
【店舗情報】
店名: {location.name}
業態: {location.category}
所在地: {location.address}

【口コミ】
投稿者: {review.author}
評価: {review.rating} / 5
本文: {review.body}

【トーン】{tone: 丁寧 / フレンドリー / 簡潔}
```

### 4-2. AIO可視性チェック（/api/meo/aio-check）

一般消費者になりきったクエリをAIエンジンに投げ、回答内に自店舗が
言及されるか（=AIサイテーション）を計測する。

**Step1: 消費者シミュレーション（System）**

```
あなたは日本のローカル検索アシスタントです。
ユーザーの質問に対し、実在するおすすめの店舗を5件、
店名・特徴・おすすめ理由つきの番号付きリストで回答してください。
知識にない店舗を創作してはいけません。確信が持てない場合は件数を減らしてください。
```

**User:** `{query}`（例: 「名古屋 スパイスカレー おすすめ」）

**Step2: 言及判定（プログラム側）**

回答テキストに店舗名（表記ゆれ含む: 「コーノスパイス」「KOHNO SPICE」「CONOCOLA」）が
含まれるかを判定し、リスト内の出現位置を rank として記録する。

### 4-3. 判定・スコアリング

- **AIO可視率** = 言及ありチェック数 ÷ 全チェック数
- エンジン別・クエリ別に履歴を保持し、施策（サイテーション登録・口コミ増）の前後比較に使う

## 5. 連携ステータスの定義（サイテーション）

| ステータス | 意味 | 表示色 |
|---|---|---|
| 同期済み | リスティング反映・インデックス確認済み | emerald |
| 送信済み | 登録申請済み・反映待ち | amber |
| 未連携 | 未登録 | gray |
| エラー | 登録失敗・要対応 | red |

## 6. 将来拡張

- Google Business Profile API 連携（口コミ自動取得・返信自動投稿）
- ChatGPT / Gemini / Perplexity の実測（各社API・検索グラウンディング利用）
- 投稿（GBP投稿）のAI生成・予約投稿
- 自動返信ルール（星5は自動、星3以下は承認フロー）
