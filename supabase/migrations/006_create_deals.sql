-- 006_create_deals.sql
-- 商談管理テーブル

create table if not exists public.deals (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users(id) on delete cascade,
  lead_id          uuid        references public.leads(id) on delete set null,
  company_name     text        not null,
  contact_name     text,
  stage            text        not null default '初回接触'
                               check (stage in ('初回接触', 'ヒアリング', '提案', '交渉', '成約', '失注')),
  amount           integer     check (amount >= 0),
  probability      integer     check (probability >= 0 and probability <= 100),
  next_action      text,
  next_action_date date,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- RLS
alter table public.deals enable row level security;

create policy "users can manage own deals"
  on public.deals
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Indexes
create index if not exists deals_user_id_idx         on public.deals(user_id);
create index if not exists deals_lead_id_idx          on public.deals(lead_id);
create index if not exists deals_stage_idx            on public.deals(stage);
create index if not exists deals_next_action_date_idx on public.deals(next_action_date);
create index if not exists deals_created_at_idx       on public.deals(created_at desc);

-- updated_at trigger
create or replace function update_deals_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger deals_updated_at
  before update on public.deals
  for each row
  execute function update_deals_updated_at();
