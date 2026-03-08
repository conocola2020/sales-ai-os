-- ============================================
-- leadsテーブル作成
-- Supabase SQL Editorで実行してください
-- ============================================

create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  company_name  text not null,
  contact_name  text,
  email         text,
  phone         text,
  website_url   text,
  industry      text,
  status        text not null default '未着手'
                  check (status in ('未着手','送信済み','返信あり','商談中','成約','NG')),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- updated_at 自動更新トリガー
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger leads_updated_at
  before update on public.leads
  for each row execute procedure public.handle_updated_at();

-- RLS (Row Level Security) 有効化
alter table public.leads enable row level security;

-- ポリシー: 自分のリードのみ操作可能
create policy "leads_select" on public.leads
  for select using (auth.uid() = user_id);

create policy "leads_insert" on public.leads
  for insert with check (auth.uid() = user_id);

create policy "leads_update" on public.leads
  for update using (auth.uid() = user_id);

create policy "leads_delete" on public.leads
  for delete using (auth.uid() = user_id);

-- パフォーマンス用インデックス
create index leads_user_id_idx    on public.leads (user_id);
create index leads_status_idx     on public.leads (status);
create index leads_created_at_idx on public.leads (created_at desc);
