-- ============================================
-- マルチテナント基盤: 組織・メンバー・招待テーブル作成
-- SaaS化 Phase 1
-- ============================================

-- --------------------------------------------
-- 1. organizations テーブル
-- --------------------------------------------
create table if not exists public.organizations (
  id                 uuid        primary key default gen_random_uuid(),
  name               text        not null,
  slug               text        unique not null,
  plan               text        not null default 'beta',
  send_limit_per_hour int        not null default 20,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- slug検索用インデックス
create index if not exists organizations_slug_idx
  on public.organizations (slug);

-- updated_at 自動更新トリガー
create or replace function public.handle_organizations_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_updated_at
  before update on public.organizations
  for each row execute function public.handle_organizations_updated_at();

-- --------------------------------------------
-- 2. org_members テーブル
-- --------------------------------------------
create table if not exists public.org_members (
  id          uuid        primary key default gen_random_uuid(),
  org_id      uuid        not null references public.organizations(id) on delete cascade,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  role        text        not null check (role in ('owner', 'admin', 'member', 'viewer')),
  invited_by  uuid        references auth.users(id),
  created_at  timestamptz not null default now(),

  -- 同じユーザーが同じ組織に重複登録されないようにする
  constraint org_members_org_user_unique unique (org_id, user_id)
);

-- 検索用インデックス
create index if not exists org_members_org_id_idx
  on public.org_members (org_id);

create index if not exists org_members_user_id_idx
  on public.org_members (user_id);

-- --------------------------------------------
-- 3. org_invitations テーブル
-- --------------------------------------------
create table if not exists public.org_invitations (
  id          uuid        primary key default gen_random_uuid(),
  org_id      uuid        not null references public.organizations(id) on delete cascade,
  email       text        not null,
  role        text        not null default 'member',
  token       text        unique not null,
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  created_at  timestamptz not null default now()
);

-- トークン検索用インデックス（招待リンクからの照合）
create index if not exists org_invitations_token_idx
  on public.org_invitations (token);

-- 組織ごとの招待一覧取得用
create index if not exists org_invitations_org_id_idx
  on public.org_invitations (org_id);

-- メールアドレスで未承認招待を検索する用
create index if not exists org_invitations_email_idx
  on public.org_invitations (email);
