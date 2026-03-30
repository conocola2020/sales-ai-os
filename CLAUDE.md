# Sales AI OS - Claude Instructions

## プロジェクト概要
営業AI OS: 企業の問い合わせフォームへの半自動営業送信システム

## 利用可能なスキル

### bulk-form-send
**トリガー**: 「送信して」「フォーム送信して」「確認待ち全てをフォーム送信して」などの指示
**内容**: send_queue の確認待ちアイテムを **Claude in Chrome** で自動フォーム送信する
**スキルファイル**: `.claude/skills/bulk-form-send.md`
**⚠️ 重要**: `/api/submit-form` やRailwayワーカーは**絶対に使わない**。必ず `mcp__Claude_in_Chrome__*` ツールを使う。

## Supabase
- Project ID: `kaqhjlmftxvjjbmcuoyq`
- 主要テーブル: `leads`, `send_queue`, `user_settings`, `messages`, `replies`, `deals`

## 重要な設計方針
- ユーザーが「フォーム送信して」と言ったら必ず `bulk-form-send` スキルを使う
- 送信前に必ず `user_settings` の送信者プロフィールを確認する
- 送信結果は必ず Supabase の `send_queue` ステータスに反映する
