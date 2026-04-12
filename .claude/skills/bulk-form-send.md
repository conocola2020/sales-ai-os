---
name: bulk-form-send
description: >
  Use when the user says something like "確認待ち全てをフォーム送信して",
  "送信して", "フォーム送信して", or asks to send pending queue items.
  This skill automates bulk contact form submission using Claude in Chrome.
---

# 一括フォーム送信スキル

ユーザーが「送信して」「フォーム送信して」などと指示したら、このスキルに従って自動送信を実行する。

## ⛔ 絶対に守るルール

### 重複送信の禁止（最重要）
- **同じ企業（lead_id）に2回以上フォーム送信してはならない**
- 送信前に必ず以下のSQLで送信済みチェックを行うこと：
  ```sql
  SELECT COUNT(*) FROM send_queue
  WHERE lead_id = (SELECT lead_id FROM send_queue WHERE id = '{アイテムのid}')
    AND status = '送信済み';
  ```
- 結果が1以上なら**そのアイテムはスキップする**
- テスト送信であっても実際の企業フォームにPOSTされるため、未送信企業のみ対象にすること

### その他の禁止事項
- **`mcp__plugin_playwright_playwright__*` は絶対に使わない**（Playwright禁止）
- **必ず `mcp__Claude_in_Chrome__*` ツールでMacのChromeを直接操作する**
- Chrome MCPが使えない場合は処理を止めてユーザーに報告する（他の手段で代替しない）

## 前提ツール
- `mcp__cab03130-b6e4-4398-a37d-c01309686a60__execute_sql` (Supabase SQL)
- `mcp__Claude_in_Chrome__*` (ブラウザ操作) ← **これのみ使用**
- `mcp__Claude_in_Chrome__tabs_context_mcp` を最初に必ず呼ぶ

## Step 0: Chrome MCP の動作確認（最初に必ず実行）

`mcp__Claude_in_Chrome__tabs_context_mcp` を呼び出す。
- タブ一覧が返ってきた → Chrome MCP 正常。Step 1 へ進む。
- エラーまたは空 → Chrome MCP が使えない状態。以下をユーザーに伝えて**停止**する：
  「Chrome MCPが起動していません。Mac上でChromeが開いているか確認してください。フォーム送信にはClaude in Chromeが必要です。」

## Supabase プロジェクトID
`kaqhjlmftxvjjbmcuoyq`

---

## Step 1: ユーザープロフィール取得

```sql
SELECT
  representative,
  representative_title,
  company_name,
  company_email,
  company_phone,
  company_location
FROM user_settings
LIMIT 1;
```

- データが空（rows: 0 または全カラムが空文字）の場合：
  - ユーザーに「設定ページ（/dashboard/settings）で送信者情報（氏名・メールアドレス・会社名）を入力してください。フォームの差出人欄に使用します。」と伝えて停止する。

---

## Step 2: 確認待ちアイテム取得

```sql
SELECT
  sq.id,
  sq.message_content,
  sq.subject,
  sq.send_method,
  l.company_name,
  l.contact_name,
  l.email       AS lead_email,
  l.website_url,
  l.company_url,
  l.contact_url
FROM send_queue sq
JOIN leads l ON l.id = sq.lead_id
WHERE sq.status = '確認待ち'
ORDER BY sq.created_at ASC;
```

- 0件の場合：「確認待ちのアイテムはありません。」と伝えて終了。
- 件数をユーザーに報告する（例：「確認待ちが3件あります。順番に送信します。」）

---

## Step 3: タブ準備

```
tabs_context_mcp で既存タブを確認
→ 新しいタブを tabs_create_mcp で作成して使用する
```

---

## Step 4: 各アイテムをループ処理

各アイテムについて以下を実行する。

### 4-1. フォームページを探す

1. まず `contact_url`（過去に発見済みのお問い合わせページURL）があればそこに直接 `navigate` → Step 4-1.5 へ
2. なければ `company_url`（公式サイト）を優先して `navigate`。`company_url` が空の場合のみ `website_url` を使う（`website_url` はレビューサイトの場合があるため）
3. ページを `read_page (filter: interactive)` で読み取る
3. リンクの中から「お問い合わせ」「contact」「toiawase」「inquiry」を含むリンクを探してナビゲート
4. それでも見つからない場合は以下のパスを順に試す：
   ```
   /contact  /contact/  /toiawase/  /inquiry/
   /お問い合わせ  /form/  /contact-us/  /contactus/
   ```
5. 各パスに `navigate` してから `read_page (filter: interactive)` で `<input>` や `<textarea>` が存在するか確認
6. フォームが見つかった場合 → そのURLを `contact_url` として保存してから Step 4-2 へ：
   ```sql
   UPDATE leads SET contact_url = '{フォームページのURL}', updated_at = NOW()
   WHERE id = (SELECT lead_id FROM send_queue WHERE id = '{アイテムのid}');
   ```
7. 全パスを試してもフォームが見つからない場合：
   ```sql
   UPDATE send_queue SET status = 'form_not_found', updated_at = NOW()
   WHERE id = '{アイテムのid}';
   ```
   ユーザーに報告して次のアイテムへ

### 4-1.5. フォームタイプの診断（必須）

フォームページで以下を実行してタイプを特定する：

```javascript
const diagnosis = {
  isCF7: !!document.querySelector('[name="_wpcf7"]'),
  formId: document.querySelector('[name="_wpcf7"]')?.value,
  isCF7MultiStep: typeof window.cf7msm_posted_data !== 'undefined' || !!document.querySelector('[name="_cf7msm_multistep_tag"]'),
  hasReCaptchaV2: !!document.querySelector('.g-recaptcha, .h-captcha'),
  hasReCaptchaV3: !!document.querySelector('[name="_wpcf7_recaptcha_response"]'),
  formAction: document.querySelector('form')?.action,
};
JSON.stringify(diagnosis);
```

| 条件 | 対応 |
|------|------|
| `isCF7MultiStep: true` | → **CF7 REST API直接POST**（Step 4-CF7MSM へ） |
| `isCF7: true` かつ multi-stepなし | → **CF7 REST API直接POST**（Step 4-CF7 へ） |
| `hasReCaptchaV2: true` | → **手動対応**にして次のアイテムへ |
| CF7でない通常フォーム | → 通常フロー（Step 4-2 へ） |

---

### 4-CF7MSM / 4-CF7：CF7フォームへの送信（REST API直接POST）

CF7（multi-stepあり・なし共通）は確認画面フローを使わず、REST APIに直接POSTする。

```javascript
(async () => {
  // ページロード後3秒待ち、reCAPTCHAトークンが生成されてから実行
  const rcToken = document.querySelector('[name="_wpcf7_recaptcha_response"]')?.value || '';
  const formId = document.querySelector('[name="_wpcf7"]').value;
  const version = document.querySelector('[name="_wpcf7_version"]')?.value || '6.0.2';

  const fd = new FormData();
  fd.append('_wpcf7', formId);
  fd.append('_wpcf7_version', version);
  fd.append('_wpcf7_locale', 'ja');
  fd.append('_wpcf7_unit_tag', `wpcf7-f${formId}-o1`);
  fd.append('_wpcf7_container_post', '0');
  fd.append('_wpcf7_posted_data_hash', '');
  fd.append('_wpcf7_recaptcha_response', rcToken);

  // フィールドマッピング（Step 4-2 の分析結果を使う）
  // fd.append('フィールド名', '値');

  const resp = await fetch(`/wp-json/contact-form-7/v1/contact-forms/${formId}/feedback`, {
    method: 'POST', body: fd
  });
  const r = await resp.json();
  window._cf7result = r;
  return JSON.stringify({status: r.status, message: r.message?.substring(0,80)});
})();
```

**成功**: `status === 'mail_sent'` → レスポンスJSON全文をユーザーに提示（スクショの代わりの送信証拠）→ Step 4-6 のステータス更新へ
**失敗**: `status === 'validation_failed'` → `r.invalid_fields` でエラー内容確認

> ⚠️ REST API直接POSTの場合、画面上に変化がない（フォームは空のまま）。スクリーンショットは証拠にならないため、APIレスポンスのJSON（status, message）を送信証拠として記録・報告すること。

---

### 4-2. フォームフィールドの分析

`read_page (filter: all)` でフォーム構造を取得する。

フィールドのラベルと `ref_id` のマッピングを行う：

| フォームのラベル | 入力する値 |
|---|---|
| 名前・お名前・姓名・氏名・担当者名 | `representative`（姓名）または姓/名に分割 |
| 姓・苗字・last name | `representative` の姓部分（スペース前） |
| 名・first name | `representative` の名部分（スペース後） |
| 会社名・法人名・御社名 | `company_name` |
| メールアドレス・email・メール | `company_email` |
| メールアドレス（確認）・確認用メール | `company_email`（同じ値） |
| 電話番号・TEL・tel | `company_phone` |
| 郵便番号 | `company_location` の郵便番号部分（あれば）。なければスキップ |
| 住所・ご住所 | `company_location`（あれば）。なければスキップ |
| 件名・タイトル・subject | `subject`（あれば）。なければ会社名を使った件名 |
| メッセージ・お問い合わせ内容・本文・備考・ご要望 | `message_content` |
| 性別 | スキップ（選択不要）またはデフォルトのまま |

### 4-3. フィールド入力

マッピングした各フィールドに `form_input` で入力する。

- `type="hidden"` のフィールドはスキップ
- `type="radio"` はスキップ（デフォルトのまま）または性別に関係するラジオのみスキップ
- `type="checkbox"` で「送信確認」「同意」「プライバシーポリシー同意」などのラベルがあれば `true` でチェック
- CAPTCHA（reCAPTCHA v2 画像選択、hCaptchaなど）を検出したら：
  - **手動対応としてマークして次のアイテムへスキップする**：
  ```sql
  UPDATE send_queue
  SET status = '手動対応',
      error_message = 'CAPTCHAが検出されました。送信管理の「手動対応」ボックスから手動で送信してください。',
      updated_at = NOW()
  WHERE id = '{アイテムのid}';
  ```
- フォームの構造が複雑すぎてフィールドマッピングが困難な場合も同様に手動対応へ：
  ```sql
  UPDATE send_queue
  SET status = '手動対応',
      error_message = 'フォームの構造が複雑なため自動入力できませんでした。手動での送信をお願いします。',
      updated_at = NOW()
  WHERE id = '{アイテムのid}';
  ```

### 4-4. 送信前確認

入力完了後、スクリーンショットを撮って入力内容を確認する。

送信ボタン（`type="submit"` または「送信」「送る」「確認」「次へ」テキストのボタン）を特定する。

**送信を実行する**：
```
computer ツールの left_click で送信ボタンをクリック
```

### 4-5. 送信結果の確認

送信後3秒待機してからスクリーンショットを撮る。

成功判定（以下のいずれかが当てはまれば成功）：
- ページに「ありがとう」「送信完了」「お問い合わせを受け付け」「thank」「complete」「完了」が含まれる
- URLが変わった（フォームページから別ページへ遷移した）
- フォームのフィールドが消えた

失敗判定（以下のいずれかが当てはまれば失敗）：
- バリデーションエラー（赤いテキスト、エラーメッセージ）が表示されている
- フォームがそのまま残っている（変化なし）

### 4-6. ステータス更新

**成功の場合：**
```sql
UPDATE send_queue
SET status = '送信済み', sent_at = NOW(), updated_at = NOW()
WHERE id = '{アイテムのid}';

UPDATE leads
SET status = '送信済み', updated_at = NOW()
WHERE id = (SELECT lead_id FROM send_queue WHERE id = '{アイテムのid}');
```

**失敗の場合：**
```sql
UPDATE send_queue
SET status = '失敗', error_message = '{エラーの内容}', updated_at = NOW()
WHERE id = '{アイテムのid}';
```

### 4-7. スクリーンショットをSupabase Storageに保存

送信成功時、証拠のスクリーンショット（通常フォームの場合）またはAPIレスポンス（CF7 REST APIの場合）をSupabase Storageに保存する。

**通常フォームの場合（完了画面のスクショ）：**

Step 4-5 で撮ったスクリーンショットのIDを使い、以下を `javascript_tool` で実行する：

```javascript
(async () => {
  // スクリーンショット画像をcanvasから取得してSupabaseにアップロード
  const timestamp = Date.now();
  const fileName = `send_queue_id_${timestamp}.jpg`;

  // screenshot IDの画像をfetchしてblobにする
  const img = document.querySelector('img[src*="screenshot"]') || document.querySelector('img');
  if (!img) return JSON.stringify({error: 'no screenshot found'});

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  canvas.getContext('2d').drawImage(img, 0, 0);
  const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.8));

  const formData = new FormData();
  formData.append('file', blob, fileName);

  // Supabase Storage API
  const resp = await fetch('{SUPABASE_URL}/storage/v1/object/screenshots/' + fileName, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer {SUPABASE_ANON_KEY}' },
    body: formData
  });
  return JSON.stringify({status: resp.status, fileName});
})();
```

ただし、Chrome MCP経由のスクリーンショットは直接ブラウザDOMに入らないため、**代わりに以下の方法を使う**：

Supabase SQL で screenshot_url を直接更新する：
```sql
UPDATE send_queue
SET screenshot_url = 'chrome_screenshot:{screenshot_id}',
    updated_at = NOW()
WHERE id = '{アイテムのid}';
```

> ★ screenshot_id は `computer` ツールの `screenshot` アクションで返される ID（例: ss_1234abcd）。
> 送信管理UIで表示するときに、このIDが設定されていれば「スクショ確認済み」バッジを表示する。

**CF7 REST API直接POSTの場合：**
APIレスポンスJSONを screenshot_url に記録する：
```sql
UPDATE send_queue
SET screenshot_url = 'api_response:{"status":"mail_sent","message":"..."}',
    updated_at = NOW()
WHERE id = '{アイテムのid}';
```

### 4-8. タブのクリーンアップ

ステータス更新後、送信先サイトが開いたままにならないようタブを空ページに戻す：
```
navigate で about:blank に遷移する
```
これにより次のアイテムの処理時にクリーンな状態で開始できる。

---

## Step 5: 完了レポート

全アイテムの処理完了後、以下の形式でレポートする：

```
送信完了レポート
━━━━━━━━━━━━━━━━━━━━
✅ 送信成功: X件
❌ 失敗: X件
⚠️ フォーム未検出: X件

【成功】
- 株式会社○○
- ○○サービス

【失敗・要確認】
- △△株式会社 → エラー内容
```

---

## 注意事項

- 各アイテムの処理間に1〜2秒のウェイトを入れる（サーバー負荷対策）
- 同じタブを使い回す（毎回新しいタブを開かない）
- エラーが発生しても次のアイテムの処理を続ける（1件失敗しても全体を止めない）
- ユーザーのプライバシー情報（メール・電話など）はフォーム入力にのみ使用し、ログや出力には表示しない
