# Sales AI OS - Claude Instructions

## プロジェクト概要
営業AI OS: 企業の問い合わせフォームへの半自動営業送信システム

---

## ⛔ 絶対禁止事項（全セッション共通）

- **同じ企業（lead_id）に2回以上フォーム送信してはならない（最重要）**
  - 送信前に必ず `send_queue` で同じ `lead_id` に `status = '送信済み'` がないか確認する
  - テスト送信でも実際の企業にPOSTされるため、未送信企業のみ対象にすること
- **`mcp__plugin_playwright_playwright__*` ツールは絶対に使わない**（Playwrightは禁止）
- **Playwright / Puppeteer を使ったフォーム送信は禁止**（削除済み）

## フォーム送信方式

フォーム自動送信は以下の3つの方式で行う（優先順位順）：

1. **ローカルスクリプト** (`npm run send`) — ローカルPCで fetch + cheerio でフォーム送信。API費用ゼロ。403エラーの場合は方式2へ。
2. **Claude in Chrome MCP** (`mcp__Claude_in_Chrome__*`) — 「送信して」と指示された場合に `.claude/skills/bulk-form-send.md` スキルに従って実行。ブラウザ経由なので403にならない。
3. **自前エンジンAPI** (`/api/agent-send`) — UIの「フォーム自動送信」ボタンから呼ばれる。Vercelサーバーからのfetch。403の場合は確認待ちに戻り方式2でリトライ。

---

## 「送信して」指示を受けたときの手順

「送信して」「フォーム送信して」「確認待ちを送信」などの指示を受けたら：

1. **最初に必ず** `mcp__Claude_in_Chrome__tabs_context_mcp` を呼んでChromeの状態を確認する
2. **スキルファイル** `.claude/skills/bulk-form-send.md` の手順に従う
3. Supabase (`kaqhjlmftxvjjbmcuoyq`) の `send_queue` から `確認待ち` を取得して処理する

Chrome MCPが使えない・タブが取得できない場合は、処理を止めてユーザーに報告する。

---

## 利用可能なスキル

### bulk-form-send
- **トリガー**: 「送信して」「フォーム送信して」「確認待ち全てをフォーム送信して」など
- **内容**: send_queue の確認待ちアイテムを Chrome で自動フォーム送信する
- **スキルファイル**: `.claude/skills/bulk-form-send.md`
- **使用ツール**: `mcp__Claude_in_Chrome__*` のみ（API禁止）

---

## Supabase
- Project ID: `kaqhjlmftxvjjbmcuoyq`
- 主要テーブル: `leads`, `send_queue`, `user_settings`, `messages`, `replies`, `deals`

## 重要な設計方針
- 送信前に必ず `user_settings` の送信者プロフィールを確認する
- 送信結果は必ず Supabase の `send_queue` ステータスに反映する
- 1件失敗しても残りの処理は継続する
