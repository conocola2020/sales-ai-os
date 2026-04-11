---
name: check-replies
description: >
  Use when the user says "返信チェックして", "返信確認して", "返信ある？",
  "メール確認して", or asks to check for incoming replies from sent leads.
  This skill checks Gmail for replies from companies that were contacted via form submission.
---

# 返信チェックスキル

送信済みリードからの返信メールを Gmail で検索し、`replies` テーブルに自動取り込みする。

## 前提ツール
- `mcp__cab03130-b6e4-4398-a37d-c01309686a60__execute_sql` (Supabase SQL)
- `mcp__793640ae-86ae-4d0c-97cc-9c0ca23d7ea6__gmail_search_messages` (Gmail検索)
- `mcp__793640ae-86ae-4d0c-97cc-9c0ca23d7ea6__gmail_read_message` (メール本文取得)

## Supabase プロジェクトID
`kaqhjlmftxvjjbmcuoyq`

---

## Step 1: 送信済みリードのドメイン一覧を取得

```sql
SELECT DISTINCT
  l.id AS lead_id,
  l.company_name,
  l.email AS lead_email,
  regexp_replace(l.company_url, '^https?://(www\.)?([^/]+).*', '\2') AS domain
FROM send_queue sq
JOIN leads l ON l.id = sq.lead_id
WHERE sq.status = '送信済み'
  AND l.company_url IS NOT NULL;
```

このドメイン一覧を使って Gmail を検索する。

---

## Step 2: Gmail で返信メールを検索

各ドメインに対して Gmail MCP で検索する。
効率のため、ドメインを OR で結合して一括検索する（最大10ドメインずつ）。

### 検索クエリの構築

```
from:(@domain1.com OR @domain2.com OR @domain3.com ...) newer_than:7d
```

`gmail_search_messages` を使用：
- `q`: 上記のクエリ
- `maxResults`: 50

### 検索の注意点
- `newer_than:7d` で直近7日間に限定（初回は `newer_than:30d` でもOK）
- 返信でないメール（ニュースレター等）も混ざる可能性がある → Step 4 で AI がフィルタリング

---

## Step 3: メール本文を取得

検索結果の各メッセージに対して `gmail_read_message` で本文を取得する。

取得する情報：
- `messageId` — Gmail メッセージID
- `from` — 送信者メールアドレス
- `subject` — 件名
- `body` / `snippet` — 本文

---

## Step 4: 重複チェック & リードとのマッチング

### 4-1. 既に取り込み済みかチェック

```sql
SELECT content FROM replies
WHERE user_id = (SELECT id FROM auth.users LIMIT 1)
ORDER BY created_at DESC
LIMIT 100;
```

メール本文の先頭100文字が既存の `replies.content` と一致する場合はスキップする。

### 4-2. 送信者ドメインからリードを特定

メールの `from` アドレスのドメイン部分を、Step 1 のドメイン一覧とマッチングする。
一致するリードが見つかれば `lead_id` を設定。

---

## Step 5: AI分類 & replies テーブルに保存

マッチしたメールごとに以下を実行：

### 5-1. 営業返信かどうか判定

メール内容を確認し、以下に該当するものは **スキップ** する：
- 自動返信（「自動返信」「不在」「out of office」を含む）
- お問い合わせ受付確認（「お問い合わせを受け付けました」「ありがとうございます」のみの短文）
- ニュースレター・メルマガ
- システム通知（noreply@, no-reply@ から）

### 5-2. 感情分析

営業返信と判定されたメールに対して、内容から感情を推定する：

| メール内容 | 感情 |
|---|---|
| 具体的な日時調整、面談希望 | `興味あり` |
| 「検討します」「社内で確認します」 | `検討中` |
| 「今回は見送り」「不要です」 | `お断り` |
| 具体的な質問（価格、サービス内容等） | `質問` |
| 上記以外 | `その他` |

### 5-3. Supabase に保存

```sql
INSERT INTO replies (user_id, lead_id, content, sentiment, is_read, created_at, updated_at)
VALUES (
  (SELECT id FROM auth.users LIMIT 1),
  '{lead_id}',
  '{メール本文}',
  '{感情}',
  false,
  NOW(),
  NOW()
);
```

---

## Step 5-4. 商談の自動作成（興味あり・質問の場合）

感情が `興味あり` または `質問` と判定された返信について、自動的に商談（deal）を作成する。

### 条件
- 感情が `興味あり` または `質問` であること
- `lead_id` が特定されていること
- その `lead_id` で既に商談が存在しないこと

### 既存商談の確認

```sql
SELECT id FROM deals
WHERE lead_id = '{lead_id}'
  AND user_id = '{user_id}'
LIMIT 1;
```

結果が0件の場合のみ、商談を作成する。

### 商談の作成

```sql
INSERT INTO deals (
  user_id, lead_id, company_name, contact_name,
  stage, probability, next_action, meeting_url,
  notes, activity_log, created_at, updated_at
)
VALUES (
  '{user_id}',
  '{lead_id}',
  '{企業名}',
  NULL,
  'ヒアリング',
  20,
  '初回ミーティング日程調整',
  'https://timerex.net/s/daichi_3022_c34c/a78a4d68',
  '【返信内容】
{メール本文の先頭500文字}',
  '[{"date": "{現在日時ISO}", "type": "stage_change", "description": "返信から商談を自動作成", "from": "未着手", "to": "ヒアリング"}]',
  NOW(),
  NOW()
);
```

### リードステータスの更新

```sql
UPDATE leads
SET status = '商談中', updated_at = NOW()
WHERE id = '{lead_id}';
```

### Google Calendar に商談予定を追加

商談を作成したら、Google Calendar MCP で予定を追加する。

`gcal_create_event` を使用：
- **summary**: `【商談】{企業名} - 初回ミーティング`
- **description**: `返信から自動作成された商談\n\n次のアクション: 初回ミーティング日程調整\nTimerex: https://timerex.net/s/daichi_3022_c34c/a78a4d68`
- **start/end**: 商談作成日の翌営業日 10:00-10:30（仮の予定として。実際の日程はTimerexで調整）
- **colorId**: `7`（Peacock = 商談系の色）

```
gcal_create_event:
  event:
    summary: "【商談】{企業名} - 初回ミーティング"
    description: "返信から自動作成\nTimerex: https://timerex.net/s/daichi_3022_c34c/a78a4d68"
    start: { dateTime: "{翌営業日}T10:00:00", timeZone: "Asia/Tokyo" }
    end: { dateTime: "{翌営業日}T10:30:00", timeZone: "Asia/Tokyo" }
    colorId: "7"
  sendUpdates: "none"
```

Google Calendar MCP が接続されていない場合はスキップし、レポートに記載する。

### 感情が「お断り」の場合

商談は作成しない。代わりにリードのステータスを更新する：

```sql
UPDATE leads
SET status = 'お断り', updated_at = NOW()
WHERE id = '{lead_id}';
```

---

## Step 6: 完了レポート

```
返信チェック完了
━━━━━━━━━━━━━━━━━━━━
📧 検索した企業ドメイン: X件
📬 新しい返信: X件
🔥 興味あり: X件
🤔 検討中: X件
🚫 お断り: X件
❓ 質問: X件
⏭️ スキップ（自動返信等）: X件
⏭️ スキップ（取り込み済み）: X件
🤝 商談自動作成: X件

【新しい返信】
- 株式会社○○: 「興味あり」— 面談希望 → 商談を自動作成しました
- △△温泉: 「質問」— 価格について → 商談を自動作成しました
- ○○ホテル: 「お断り」— 導入予定なし → リードステータスを「お断り」に更新
```

---

## 注意事項

- Gmail MCP が接続されていない場合は、ユーザーに接続を依頼して停止する
- メールの本文は `replies.content` にそのまま保存する（HTMLタグは除去）
- 1回のチェックで大量のメールが見つかった場合は、最新20件に制限する
- プライバシー：メール内容はDB保存とレポートにのみ使用し、他の目的に流用しない
