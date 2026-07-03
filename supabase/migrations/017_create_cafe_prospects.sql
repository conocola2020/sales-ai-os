-- 017_create_cafe_prospects.sql
-- カフェプロスペクト管理テーブル
-- Google Places API 等の外部ソースから取得した店舗情報を保持し、
-- 精査後に leads テーブルへ昇格させる二層構造の上層を担う。
-- raw_data には外部APIのレスポンス本体のみを格納し、APIキー等の認証情報は絶対に含めない。

create table if not exists public.cafe_prospects (
  id                  uuid           primary key default gen_random_uuid(),
  user_id             uuid           not null references auth.users(id) on delete cascade,
  place_id            text           not null,
  name                text           not null,
  formatted_address   text,
  prefecture          text,
  phone               text,
  website             text,
  instagram_url       text,
  email               text,
  contact_form_url    text,
  latitude            numeric(10, 7) check (latitude  between -90  and 90),
  longitude           numeric(10, 7) check (longitude between -180 and 180),
  rating              numeric(2, 1)  check (rating between 0 and 5),
  user_rating_count   integer        check (user_rating_count >= 0),
  primary_type        text,
  business_status     text,
  status              text           not null default 'untouched'
                                     check (status in ('untouched', 'verified', 'excluded', 'promoted')),
  contact_method      text           default 'none'
                                     check (contact_method in ('form', 'email', 'instagram', 'manual', 'none')),
  source              text           not null default 'google_places_api',
  lead_id             uuid           references public.leads(id) on delete set null,
  notes               text,
  raw_data            jsonb,
  created_at          timestamptz    not null default now(),
  updated_at          timestamptz    not null default now(),
  unique (user_id, place_id)
);

-- RLS
alter table public.cafe_prospects enable row level security;

create policy "users can manage own cafe_prospects"
  on public.cafe_prospects
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Indexes
create index if not exists cafe_prospects_user_id_idx     on public.cafe_prospects(user_id);
create index if not exists cafe_prospects_status_idx      on public.cafe_prospects(status);
create index if not exists cafe_prospects_prefecture_idx  on public.cafe_prospects(prefecture);
create index if not exists cafe_prospects_lat_lng_idx     on public.cafe_prospects(latitude, longitude);
create index if not exists cafe_prospects_lead_id_idx     on public.cafe_prospects(lead_id);
create index if not exists cafe_prospects_created_at_idx  on public.cafe_prospects(created_at desc);

-- updated_at trigger
create or replace function update_cafe_prospects_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger cafe_prospects_updated_at
  before update on public.cafe_prospects
  for each row
  execute function update_cafe_prospects_updated_at();
