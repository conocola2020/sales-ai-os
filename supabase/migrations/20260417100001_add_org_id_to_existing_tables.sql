-- ============================================
-- 既存テーブルに org_id カラムを追加
-- SaaS化 Phase 1: マルチテナント対応
-- 注意: RLSポリシーは別途 security-sre が作成する
-- ============================================

-- --------------------------------------------
-- leads テーブル
-- --------------------------------------------
alter table public.leads
  add column if not exists org_id uuid references public.organizations(id);

create index if not exists leads_org_id_idx
  on public.leads (org_id);

-- --------------------------------------------
-- send_queue テーブル
-- --------------------------------------------
alter table public.send_queue
  add column if not exists org_id uuid references public.organizations(id);

create index if not exists send_queue_org_id_idx
  on public.send_queue (org_id);

-- --------------------------------------------
-- messages テーブル
-- --------------------------------------------
alter table public.messages
  add column if not exists org_id uuid references public.organizations(id);

create index if not exists messages_org_id_idx
  on public.messages (org_id);

-- --------------------------------------------
-- replies テーブル
-- --------------------------------------------
alter table public.replies
  add column if not exists org_id uuid references public.organizations(id);

create index if not exists replies_org_id_idx
  on public.replies (org_id);

-- --------------------------------------------
-- deals テーブル
-- --------------------------------------------
alter table public.deals
  add column if not exists org_id uuid references public.organizations(id);

create index if not exists deals_org_id_idx
  on public.deals (org_id);

-- --------------------------------------------
-- user_settings テーブル
-- --------------------------------------------
alter table public.user_settings
  add column if not exists org_id uuid references public.organizations(id);

create index if not exists user_settings_org_id_idx
  on public.user_settings (org_id);
