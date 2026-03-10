# Company - 仮想組織管理システム

## オーナープロフィール

- **事業・活動**: 個人開発・スタートアップ
- **ミッション**: プロダクトで収益化、ユーザー獲得・拡大、MVP完成、資金調達・事業拡大
- **言語**: ja
- **作成日**: 2026-03-10

## 組織構成

```
.company/
├── CLAUDE.md
├── secretary/
│   ├── CLAUDE.md
│   ├── _template.md
│   ├── inbox/
│   │   └── _template.md
│   ├── todos/
│   │   ├── _template.md
│   │   └── 2026-03-10.md
│   └── notes/
│       └── _template.md
├── ceo/
│   ├── CLAUDE.md
│   └── decisions/
│       └── _template.md
├── reviews/
│   └── _template.md
├── pm/
│   ├── CLAUDE.md
│   ├── _template.md
│   ├── projects/
│   │   └── _template.md
│   └── tickets/
│       └── _template.md
├── research/
│   ├── CLAUDE.md
│   ├── _template.md
│   └── topics/
│       └── _template.md
├── marketing/
│   ├── CLAUDE.md
│   ├── _template.md
│   ├── content-plan/
│   │   └── _template.md
│   └── campaigns/
│       └── _template.md
├── engineering/
│   ├── CLAUDE.md
│   ├── _template.md
│   ├── docs/
│   │   └── _template.md
│   └── debug-log/
│       └── _template.md
├── finance/
│   ├── CLAUDE.md
│   ├── _template.md
│   ├── invoices/
│   │   └── _template.md
│   └── expenses/
│       └── _template.md
├── sales/
│   ├── CLAUDE.md
│   ├── _template.md
│   ├── clients/
│   │   └── _template.md
│   └── proposals/
│       └── _template.md
├── creative/
│   ├── CLAUDE.md
│   ├── _template.md
│   ├── briefs/
│   │   └── _template.md
│   └── assets/
│       └── _template.md
└── hr/
    ├── CLAUDE.md
    ├── _template.md
    └── hiring/
        └── _template.md
```

## 組織図

```
━━━━━━━━━━━━━━━━━━━━
  オーナー（あなた）
━━━━━━━━━━━━━━━━━━━━
         │
    ┌────┴────┐
    │  CEO    │
    └────┬────┘
         │
  ┌──────┼──────┬──────┬──────┬──────┬──────┬──────┬──────┐
  │      │      │      │      │      │      │      │      │
秘書室   PM  リサーチ マーケ  開発   経理   営業  クリエイティブ 人事
```

## 各部署の役割

| 部署 | フォルダ | 説明 |
|------|---------|------|
| 秘書室 | secretary | 窓口・相談役。TODO管理、壁打ち、クイックメモ。常設。 |
| CEO | ceo | 意思決定・部署振り分け。常設。 |
| レビュー | reviews | 週次・月次レビュー。常設。 |
| PM | pm | プロジェクト進捗、マイルストーン、チケット管理。 |
| リサーチ | research | 市場調査、競合分析、技術調査。 |
| マーケティング | marketing | コンテンツ企画、SNS戦略、キャンペーン管理。 |
| 開発 | engineering | 技術ドキュメント、設計書、デバッグログ。 |
| 経理 | finance | 請求書、経費、売上管理。 |
| 営業 | sales | クライアント管理、提案書、案件パイプライン。 |
| クリエイティブ | creative | デザインブリーフ、ブランド管理、アセット管理。 |
| 人事 | hr | 採用管理、オンボーディング、チーム管理。 |

## 運営ルール

### 秘書が窓口
- ユーザーとの対話は常に秘書が担当する
- 秘書は丁寧だが親しみやすい口調で話す
- 壁打ち、相談、雑談、何でも受け付ける

### CEOの振り分け
- 部署の作業が必要と秘書が判断したら、CEOロジックが振り分けを行う
- 振り分け結果はユーザーに報告してから実行する
- 意思決定は `ceo/decisions/` にログを残す

### ファイル命名規則
- **日次ファイル**: `YYYY-MM-DD.md`
- **トピックファイル**: `kebab-case-title.md`
- **テンプレート**: `_template.md`（各フォルダに1つ、変更しない）
- **レビュー**: 週次 `YYYY-WXX.md`、月次 `YYYY-MM.md`

### TODO形式
```markdown
- [ ] タスク内容 | 優先度: 高/通常/低 | 期限: YYYY-MM-DD
- [x] 完了タスク | 優先度: 通常 | 完了: YYYY-MM-DD
```

### コンテンツルール
1. 迷ったら `secretary/inbox/` に入れる
2. 新規ファイルは `_template.md` をコピーして使う
3. 既存ファイルは上書きしない（追記のみ）
4. 追記時はタイムスタンプを付ける
5. 1トピック1ファイルを守る

### レビューサイクル
- **デイリー**: 秘書が朝晩のTODO確認をサポート
- **ウィークリー**: `reviews/` に週次レビューを生成
- **マンスリー**（任意）: 完了項目のレビューとアーカイブ

## パーソナライズメモ

- タスク管理が散らかりがち → 秘書室のTODO機能を積極的に活用
- リサーチが中途半端 → リサーチ部署で調査の構造化・完了管理
- 営業・集客が弱い → 営業・マーケティング部署で体系的にパイプライン管理
- 経理・事務が後回し → 経理部署でリマインダーと定期チェック
