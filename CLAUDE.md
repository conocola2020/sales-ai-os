# Sales AI OS - Claude Instructions

## プロジェクト概要
営業AI OS: 企業の問い合わせフォームへの半自動営業送信システム

---

## ⛔ 絶対禁止事項（全セッション共通）

- **`/api/submit-form` を呼ぶことは絶対禁止**（Railwayワーカー経由の送信は使わない）
- **fetch や axios で Sales AI OS の API を直接叩くことは禁止**
- **`mcp__plugin_playwright_playwright__*` ツールは絶対に使わない**（Playwrightは禁止）
- **フォーム送信には必ず `mcp__Claude_in_Chrome__*` ツールのみを使う**

---

## フォーム送信の指示を受けたときの必須手順

「送信して」「フォーム送信して」「確認待ちを送信」などの指示を受けたら：

1. **最初に必ず** `mcp__Claude_in_Chrome__tabs_context_mcp` を呼んでChromeの状態を確認する
2. **スキルファイル** `.claude/skills/bulk-form-send.md` の手順に従う
3. Supabase (`kaqhjlmftxvjjbmcuoyq`) の `send_queue` から `確認待ち` を取得して処理する

Chrome MCPが使えない・タブが取得できない場合は、処理を止めてユーザーに報告する。
**決してAPIやコードで代替しない。**

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
