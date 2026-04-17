# Sales AI OS - SaaS v2 MVP要件定義

## 概要

本ドキュメントは、Sales AI OSをSaaSプロダクトとしてクローズドβ（5社受け入れ）するために必要な最小機能セットを定義する。

### ターゲットユーザー
- 中小企業の営業チーム（2-10名）
- ITリテラシーは中程度
- 既存の営業リストをCSVで持っている
- フォーム営業を月50-200件行いたい

### 現行アーキテクチャからの主な変更点
- シングルテナント -> マルチテナント（organization単位のデータ分離）
- 認証なし/個人利用 -> Supabase Auth + RLS（Row Level Security）
- 単一ユーザー -> 組織内の複数ユーザー + ロール管理
- ローカル送信依存 -> クラウド完結型の送信エンジン

---

## 1. Must-Have（β必須） - 5社が使い始めるために絶対必要

### M-1: マルチテナント基盤（Organization / Workspace）

**User Story**
> As a 営業マネージャー, I want to 自社専用のワークスペースを持ちたい, So that チームのリードや送信履歴が他社と混在しない。

**Acceptance Criteria**
- [ ] `organizations` テーブルが存在し、全データテーブルに `org_id` 外部キーがある
- [ ] Supabase RLS により、ユーザーは自組織のデータのみ読み書きできる
- [ ] 組織作成時にデフォルトの設定値（送信者プロフィール等）が初期化される
- [ ] 既存テーブル（leads, send_queue, messages, replies, deals, user_settings）すべてに `org_id` カラムが追加されている

**RICEスコア**
| Reach | Impact | Confidence | Effort | Score |
|-------|--------|------------|--------|-------|
| 10 | 10 | 9 | 8 | 11.3 |

**担当**: backend-engineer, security-sre
**見積り**: XL（DB マイグレーション + RLS全テーブル + API全箇所修正）

---

### M-2: 認証・ユーザー管理

**User Story**
> As a 営業担当者, I want to メールアドレスとパスワードでログインしたい, So that 自分のアカウントで安全にシステムを利用できる。

**Acceptance Criteria**
- [ ] Supabase Auth によるメール/パスワード認証が動作する
- [ ] サインアップ時にメール確認フローが動作する
- [ ] ログイン後、所属組織のダッシュボードにリダイレクトされる
- [ ] 未認証ユーザーはログインページにリダイレクトされる（現行のdev mode分岐を本番用に整理）
- [ ] パスワードリセット機能が動作する

**RICEスコア**
| Reach | Impact | Confidence | Effort | Score |
|-------|--------|------------|--------|-------|
| 10 | 10 | 10 | 4 | 25.0 |

**担当**: backend-engineer, frontend-engineer
**見積り**: M（Supabase Auth活用、middleware.ts の既存骨格あり）

---

### M-3: 組織メンバー招待・ロール管理

**User Story**
> As a 営業マネージャー, I want to チームメンバーを招待してロールを割り当てたい, So that 適切な権限でチームが利用できる。

**Acceptance Criteria**
- [ ] 管理者がメールアドレスでメンバーを招待できる
- [ ] ロールは最低2種類: `admin`（管理者）、`member`（一般メンバー）
- [ ] adminのみ: 組織設定変更、メンバー招待/削除、送信者プロフィール編集
- [ ] memberは: リード管理、文面生成、送信実行、返信確認が可能
- [ ] 招待されたユーザーがメールリンクからサインアップすると自動的に組織に参加する

**RICEスコア**
| Reach | Impact | Confidence | Effort | Score |
|-------|--------|------------|--------|-------|
| 10 | 8 | 8 | 6 | 10.7 |

**担当**: backend-engineer, frontend-engineer
**見積り**: L（招待フロー + RLS ポリシー + UI）

---

### M-4: リード管理のマルチテナント対応

**User Story**
> As a 営業担当者, I want to CSVでリードを取り込み、チーム内で共有したい, So that チーム全員が同じリードリストで営業活動できる。

**Acceptance Criteria**
- [ ] CSV取込時に `org_id` が自動付与される
- [ ] リード一覧は自組織のリードのみ表示される
- [ ] 重複チェックは組織内スコープで動作する（他社のリードとは重複しない）
- [ ] リードの担当者（assignee）を組織メンバーに割り当て可能
- [ ] 手動追加・編集・削除が組織スコープで動作する

**RICEスコア**
| Reach | Impact | Confidence | Effort | Score |
|-------|--------|------------|--------|-------|
| 10 | 9 | 9 | 5 | 16.2 |

**担当**: backend-engineer, frontend-engineer
**見積り**: M（既存機能のスコープ追加が主）

---

### M-5: 営業文面AI生成のマルチテナント対応

**User Story**
> As a 営業担当者, I want to 自社のプロフィールに基づいた営業文面をAI生成したい, So that 企業ごとにカスタマイズされた効果的な営業文を使える。

**Acceptance Criteria**
- [ ] `user_settings` の送信者プロフィールが組織単位で管理される
- [ ] 文面生成APIが組織の送信者プロフィールを参照する
- [ ] 生成された文面（messages テーブル）が組織スコープで保存・表示される
- [ ] 一括生成（generate-bulk）が組織スコープで動作する

**RICEスコア**
| Reach | Impact | Confidence | Effort | Score |
|-------|--------|------------|--------|-------|
| 10 | 9 | 9 | 4 | 20.3 |

**担当**: backend-engineer, frontend-engineer
**見積り**: M（既存APIの org_id 対応が主）

---

### M-6: フォーム送信エンジンのクラウド化

**User Story**
> As a 営業担当者, I want to ブラウザからボタン一つでフォーム送信を実行したい, So that ローカル環境のセットアップなしに営業活動を始められる。

**Acceptance Criteria**
- [ ] 送信方式3（自前エンジンAPI `/api/agent-send`）がクラウド上で安定動作する
- [ ] 403エラー時は「手動対応」ステータスに自動変更され、ユーザーに通知される
- [ ] 送信結果（成功/失敗/手動対応）がリアルタイムで画面に反映される
- [ ] 同一 `lead_id` への重複送信防止ロジックがAPI層で担保される
- [ ] 送信キュー（send_queue）が組織スコープで動作する
- [ ] 1時間あたりの送信上限（レートリミット）が組織単位で設定可能

**RICEスコア**
| Reach | Impact | Confidence | Effort | Score |
|-------|--------|------------|--------|-------|
| 10 | 10 | 7 | 7 | 10.0 |

**担当**: backend-engineer, security-sre, devops-deployer
**見積り**: L（既存API改修 + レートリミット + エラーハンドリング強化）

---

### M-7: 送信管理・返信管理のマルチテナント対応

**User Story**
> As a 営業マネージャー, I want to チームの送信状況と返信を一元管理したい, So that 営業活動の進捗を把握し、返信に素早く対応できる。

**Acceptance Criteria**
- [ ] 送信管理画面で組織の全送信履歴が閲覧できる
- [ ] 返信管理画面で組織宛の全返信が閲覧できる
- [ ] 返信のAI分類（興味あり/お断り等）が組織スコープで動作する
- [ ] 担当者ごとのフィルタリングが可能

**RICEスコア**
| Reach | Impact | Confidence | Effort | Score |
|-------|--------|------------|--------|-------|
| 10 | 8 | 9 | 4 | 18.0 |

**担当**: backend-engineer, frontend-engineer
**見積り**: M（既存UIのスコープ対応が主）

---

### M-8: オンボーディングフロー

**User Story**
> As a 新規ユーザー, I want to 初回ログイン時にガイド付きで初期設定を完了したい, So that 迷わずに営業活動を開始できる。

**Acceptance Criteria**
- [ ] 初回ログイン時にオンボーディングウィザードが表示される
- [ ] ステップ: (1) 会社情報入力 (2) 送信者プロフィール設定 (3) CSVリード取込（スキップ可） (4) 完了
- [ ] 各ステップに説明テキストと入力例がある
- [ ] オンボーディング完了後、ダッシュボードに遷移する

**RICEスコア**
| Reach | Impact | Confidence | Effort | Score |
|-------|--------|------------|--------|-------|
| 10 | 7 | 8 | 4 | 14.0 |

**担当**: frontend-engineer, designer
**見積り**: M

---

## 2. Should-Have（β中に追加） - β期間中に追加すべき機能

### S-1: 商談管理のマルチテナント対応

**User Story**
> As a 営業担当者, I want to 返信から生まれた商談をカンバンボードで管理したい, So that 営業パイプラインを可視化してフォローアップ漏れを防げる。

**Acceptance Criteria**
- [ ] 商談（deals テーブル）が組織スコープで動作する
- [ ] カンバンボードで商談ステージの移動ができる
- [ ] 商談に担当者を割り当て可能
- [ ] 返信から商談への変換がワンクリックで可能

**RICEスコア**
| Reach | Impact | Confidence | Effort | Score |
|-------|--------|------------|--------|-------|
| 8 | 7 | 8 | 4 | 11.2 |

**担当**: backend-engineer, frontend-engineer
**見積り**: M

---

### S-2: チームダッシュボード・レポート

**User Story**
> As a 営業マネージャー, I want to チーム全体の送信数・返信率・商談化率をダッシュボードで見たい, So that 営業活動のROIを把握し改善できる。

**Acceptance Criteria**
- [ ] ダッシュボードに以下KPIが表示される: 送信数、返信率、商談化率、期間比較
- [ ] 担当者別の実績が表示される
- [ ] 日/週/月の期間切り替えが可能
- [ ] CSV形式でのレポートエクスポート

**RICEスコア**
| Reach | Impact | Confidence | Effort | Score |
|-------|--------|------------|--------|-------|
| 8 | 7 | 7 | 5 | 7.8 |

**担当**: frontend-engineer, data-engineer
**見積り**: L

---

### S-3: 操作ログ・監査ログ

**User Story**
> As a 管理者, I want to 誰がいつ何をしたかのログを確認したい, So that セキュリティとコンプライアンスを担保できる。

**Acceptance Criteria**
- [ ] 主要操作（リード追加/編集/削除、送信実行、設定変更）がログに記録される
- [ ] ログにはユーザーID、操作種別、タイムスタンプ、対象リソースが含まれる
- [ ] 管理者のみログ一覧を閲覧できる
- [ ] 30日間のログが保持される

**RICEスコア**
| Reach | Impact | Confidence | Effort | Score |
|-------|--------|------------|--------|-------|
| 6 | 6 | 8 | 5 | 5.8 |

**担当**: backend-engineer, security-sre
**見積り**: M

---

### S-4: 送信テンプレート管理

**User Story**
> As a 営業担当者, I want to 効果の高い営業文面をテンプレートとして保存・再利用したい, So that 毎回ゼロから文面を作成せずに済む。

**Acceptance Criteria**
- [ ] 生成した文面をテンプレートとして名前付きで保存できる
- [ ] テンプレート一覧から選択して新しいリードに適用できる
- [ ] テンプレートに変数（{{会社名}}, {{担当者名}}等）を含めて自動置換できる
- [ ] テンプレートは組織内で共有される

**RICEスコア**
| Reach | Impact | Confidence | Effort | Score |
|-------|--------|------------|--------|-------|
| 8 | 7 | 9 | 3 | 16.8 |

**担当**: backend-engineer, frontend-engineer
**見積り**: S

---

### S-5: Webhook / メール通知

**User Story**
> As a 営業担当者, I want to 返信が来た時にメール通知を受け取りたい, So that 見込み客への対応が遅れない。

**Acceptance Criteria**
- [ ] 返信受信時にメール通知が送信される
- [ ] 送信失敗時に担当者にメール通知が送信される
- [ ] 通知のON/OFFをユーザーごとに設定できる
- [ ] 将来的なSlack/Webhook連携の拡張ポイントがある

**RICEスコア**
| Reach | Impact | Confidence | Effort | Score |
|-------|--------|------------|--------|-------|
| 8 | 8 | 7 | 4 | 11.2 |

**担当**: backend-engineer, devops-deployer
**見積り**: M

---

### S-6: 企業HP分析のマルチテナント対応

**User Story**
> As a 営業担当者, I want to リード企業のHPをAI分析して営業文面に活かしたい, So that より的確なアプローチができる。

**Acceptance Criteria**
- [ ] 企業分析結果が組織スコープで保存される
- [ ] 分析結果が文面生成時に自動参照される
- [ ] 分析のAPI利用量が組織単位でカウントされる

**RICEスコア**
| Reach | Impact | Confidence | Effort | Score |
|-------|--------|------------|--------|-------|
| 7 | 6 | 8 | 3 | 11.2 |

**担当**: backend-engineer
**見積り**: S

---

## 3. Nice-to-Have（GA向け） - 正式リリースまでに必要だがβでは不要

### N-1: 課金・サブスクリプション管理（Stripe連携）

**User Story**
> As a 管理者, I want to プランを選択して月額課金で利用したい, So that 利用量に応じた適切なコストで運用できる。

**Acceptance Criteria**
- [ ] Stripe連携による月額課金が動作する
- [ ] プラン: Starter（月100件送信）/ Growth（月500件）/ Enterprise（カスタム）
- [ ] プラン変更・解約がセルフサービスで可能
- [ ] 利用量超過時に通知と送信制限が動作する
- [ ] 請求書のダウンロードが可能

**RICEスコア**
| Reach | Impact | Confidence | Effort | Score |
|-------|--------|------------|--------|-------|
| 10 | 9 | 6 | 8 | 6.8 |

**担当**: backend-engineer, frontend-engineer, security-sre
**見積り**: XL

---

### N-2: Instagram DM管理のマルチテナント対応

**User Story**
> As a 営業担当者, I want to Instagram DMでの営業活動もチームで管理したい, So that フォーム営業とDM営業を一元管理できる。

**Acceptance Criteria**
- [ ] Instagram連携が組織スコープで動作する
- [ ] DMテンプレートが組織内で共有される
- [ ] DM送信履歴が組織単位で管理される

**RICEスコア**
| Reach | Impact | Confidence | Effort | Score |
|-------|--------|------------|--------|-------|
| 4 | 6 | 5 | 6 | 2.0 |

**担当**: backend-engineer, frontend-engineer
**見積り**: L

---

### N-3: API公開（外部連携）

**User Story**
> As a 開発者, I want to REST APIでリードの登録や送信状況の取得をしたい, So that 自社の既存ツール（CRM等）と連携できる。

**Acceptance Criteria**
- [ ] APIキー認証による外部アクセスが可能
- [ ] リード CRUD、送信状況取得、返信取得のAPIエンドポイントが公開される
- [ ] APIドキュメント（OpenAPI/Swagger）が提供される
- [ ] レートリミットが設定されている

**RICEスコア**
| Reach | Impact | Confidence | Effort | Score |
|-------|--------|------------|--------|-------|
| 3 | 7 | 6 | 7 | 1.8 |

**担当**: backend-engineer, tech-lead
**見積り**: L

---

### N-4: カスタムドメイン・ホワイトラベル

**User Story**
> As a 管理者, I want to 自社ドメインでシステムにアクセスしたい, So that 社内ツールとしてブランド統一できる。

**Acceptance Criteria**
- [ ] カスタムドメインの設定が可能
- [ ] ロゴ・カラーのカスタマイズが可能
- [ ] SSL証明書が自動発行される

**RICEスコア**
| Reach | Impact | Confidence | Effort | Score |
|-------|--------|------------|--------|-------|
| 2 | 4 | 7 | 7 | 0.8 |

**担当**: devops-deployer, frontend-engineer
**見積り**: L

---

### N-5: 高度な分析・AIインサイト

**User Story**
> As a 営業マネージャー, I want to AIが返信率の高いセグメントや文面パターンを提案してほしい, So that データドリブンで営業戦略を改善できる。

**Acceptance Criteria**
- [ ] 業種/企業規模別の返信率分析が表示される
- [ ] 効果の高い文面パターンがAIで提案される
- [ ] 送信最適時間帯の推奨が表示される

**RICEスコア**
| Reach | Impact | Confidence | Effort | Score |
|-------|--------|------------|--------|-------|
| 6 | 7 | 4 | 8 | 2.1 |

**担当**: data-engineer, backend-engineer
**見積り**: XL

---

### N-6: 多言語対応（i18n）

**User Story**
> As a グローバル企業の担当者, I want to 英語でもシステムを利用したい, So that 海外チームメンバーも使える。

**Acceptance Criteria**
- [ ] UI全体が日本語/英語で切り替え可能
- [ ] next-intl 等の i18n ライブラリが導入されている
- [ ] 文面生成AIが言語指定に対応する

**RICEスコア**
| Reach | Impact | Confidence | Effort | Score |
|-------|--------|------------|--------|-------|
| 2 | 5 | 7 | 7 | 1.0 |

**担当**: frontend-engineer, tech-lead
**見積り**: XL

---

## 実装優先順位（RICEスコア順）

| 順位 | ID | 機能 | RICEスコア | カテゴリ | 見積り |
|------|----|------|-----------|---------|--------|
| 1 | M-2 | 認証・ユーザー管理 | 25.0 | Must | M |
| 2 | M-5 | 営業文面AI生成のマルチテナント対応 | 20.3 | Must | M |
| 3 | M-7 | 送信管理・返信管理のマルチテナント対応 | 18.0 | Must | M |
| 4 | S-4 | 送信テンプレート管理 | 16.8 | Should | S |
| 5 | M-4 | リード管理のマルチテナント対応 | 16.2 | Must | M |
| 6 | M-8 | オンボーディングフロー | 14.0 | Must | M |
| 7 | M-1 | マルチテナント基盤 | 11.3 | Must | XL |
| 8 | S-1 | 商談管理のマルチテナント対応 | 11.2 | Should | M |
| 9 | S-5 | Webhook / メール通知 | 11.2 | Should | M |
| 10 | S-6 | 企業HP分析のマルチテナント対応 | 11.2 | Should | S |
| 11 | M-3 | 組織メンバー招待・ロール管理 | 10.7 | Must | L |
| 12 | M-6 | フォーム送信エンジンのクラウド化 | 10.0 | Must | L |
| 13 | S-2 | チームダッシュボード・レポート | 7.8 | Should | L |
| 14 | N-1 | 課金・サブスクリプション管理 | 6.8 | Nice | XL |
| 15 | S-3 | 操作ログ・監査ログ | 5.8 | Should | M |

---

## 推奨実装フェーズ

### Phase 1: 基盤構築（Week 1-3）
**目標**: マルチテナントの土台を完成させる

| タスク | 担当 | 見積り |
|--------|------|--------|
| M-1: マルチテナント基盤（DBマイグレーション + RLS） | backend-engineer, security-sre | XL |
| M-2: 認証・ユーザー管理 | backend-engineer, frontend-engineer | M |

**マイルストーン**: ログインして自組織のデータのみ表示される状態

### Phase 2: コア機能対応（Week 3-5）
**目標**: 既存機能のマルチテナント化を完了する

| タスク | 担当 | 見積り |
|--------|------|--------|
| M-4: リード管理のマルチテナント対応 | backend-engineer, frontend-engineer | M |
| M-5: 営業文面AI生成のマルチテナント対応 | backend-engineer, frontend-engineer | M |
| M-7: 送信管理・返信管理のマルチテナント対応 | backend-engineer, frontend-engineer | M |
| M-6: フォーム送信エンジンのクラウド化 | backend-engineer, devops-deployer | L |

**マイルストーン**: リード取込 -> 文面生成 -> フォーム送信 -> 返信確認の一連のフローが動作

### Phase 3: チーム機能 + UX（Week 5-7）
**目標**: チーム利用とオンボーディングを整備する

| タスク | 担当 | 見積り |
|--------|------|--------|
| M-3: 組織メンバー招待・ロール管理 | backend-engineer, frontend-engineer | L |
| M-8: オンボーディングフロー | frontend-engineer, designer | M |

**マイルストーン**: β受け入れ準備完了 -- 5社に招待メールを送信可能

### Phase 4: β期間中の改善（Week 7-12）
**目標**: β利用者のフィードバックを反映しつつ Should-Have を追加

| タスク | 担当 | 見積り |
|--------|------|--------|
| S-4: 送信テンプレート管理 | backend-engineer, frontend-engineer | S |
| S-6: 企業HP分析のマルチテナント対応 | backend-engineer | S |
| S-1: 商談管理のマルチテナント対応 | backend-engineer, frontend-engineer | M |
| S-5: Webhook / メール通知 | backend-engineer, devops-deployer | M |
| S-2: チームダッシュボード・レポート | frontend-engineer, data-engineer | L |
| S-3: 操作ログ・監査ログ | backend-engineer, security-sre | M |

**マイルストーン**: β5社がアクティブに利用し、GA判断のためのデータが揃う

---

## DBスキーマ変更概要

### 新規テーブル
```sql
-- 組織
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'beta',
  send_limit_per_hour INT DEFAULT 20,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 組織メンバー
CREATE TABLE org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, user_id)
);

-- 招待
CREATE TABLE org_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 操作ログ（Should-Have）
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 送信テンプレート（Should-Have）
CREATE TABLE message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 既存テーブル変更
```sql
-- 全既存テーブルに org_id を追加
ALTER TABLE leads ADD COLUMN org_id UUID REFERENCES organizations(id);
ALTER TABLE send_queue ADD COLUMN org_id UUID REFERENCES organizations(id);
ALTER TABLE messages ADD COLUMN org_id UUID REFERENCES organizations(id);
ALTER TABLE replies ADD COLUMN org_id UUID REFERENCES organizations(id);
ALTER TABLE deals ADD COLUMN org_id UUID REFERENCES organizations(id);
ALTER TABLE user_settings ADD COLUMN org_id UUID REFERENCES organizations(id);

-- RLS有効化（全テーブル共通パターン）
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON leads
  USING (org_id = (SELECT org_id FROM org_members WHERE user_id = auth.uid() LIMIT 1));
-- 他テーブルも同様
```

---

## 技術的な注意事項

### セキュリティ
- RLSは全テーブルに適用し、APIレベルでもorg_idのバリデーションを行う（多層防御）
- 送信者プロフィール（メールアドレス、電話番号）は暗号化して保存を検討
- β期間中でもSOC2準拠を意識した設計にする

### パフォーマンス
- `org_id` カラムにはインデックスを作成する
- リード数が1万件を超える組織を想定したページネーション設計
- 送信キューはバックグラウンドジョブ（Supabase Edge Functions or Railway）で処理

### 既存コードへの影響
- `middleware.ts`: dev modeの分岐を整理し、本番認証フローに統合
- 全APIルート（`src/app/api/*`）: リクエストからorg_idを取得するヘルパー関数を共通化
- 全ダッシュボードページ: データ取得時にorg_idフィルタを追加
- `src/lib/supabase/server.ts`: 認証済みユーザーのorg_id取得ヘルパーを追加

---

## 成功指標（β期間）

| 指標 | 目標値 |
|------|--------|
| β参加企業のアクティブ率 | 5社中4社以上が週1回以上利用 |
| オンボーディング完了率 | 80%以上 |
| フォーム送信成功率 | 85%以上 |
| 平均返信率 | 3%以上（業界平均並み） |
| NPS | 30以上 |
| クリティカルバグ | β期間中0件 |
| 平均サポート対応時間 | 24時間以内 |
