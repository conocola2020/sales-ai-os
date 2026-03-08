-- 007_create_instagram_targets.sql
-- Instagram半自動化ターゲット管理テーブル

create table if not exists public.instagram_targets (
  id               uuid         primary key default gen_random_uuid(),
  user_id          uuid         not null references auth.users(id) on delete cascade,
  username         text         not null,
  display_name     text,
  bio              text,
  industry         text,
  follower_count   integer      check (follower_count >= 0),
  engagement_rate  numeric(5,2) check (engagement_rate >= 0 and engagement_rate <= 100),
  following        boolean      not null default false,
  liked            boolean      not null default false,
  dm_sent          boolean      not null default false,
  dm_content       text,
  dm_replied       boolean      not null default false,
  liked_back       boolean      not null default false,
  followed_back    boolean      not null default false,
  status           text         not null default '未対応'
                                check (status in ('未対応', 'アプローチ中', 'DM送信済み', '返信あり', '成約', 'NG')),
  notes            text,
  created_at       timestamptz  not null default now(),
  updated_at       timestamptz  not null default now()
);

-- RLS
alter table public.instagram_targets enable row level security;

create policy "users can manage own instagram_targets"
  on public.instagram_targets
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Indexes
create index if not exists instagram_targets_user_id_idx    on public.instagram_targets(user_id);
create index if not exists instagram_targets_status_idx     on public.instagram_targets(status);
create index if not exists instagram_targets_username_idx   on public.instagram_targets(username);
create index if not exists instagram_targets_dm_sent_idx    on public.instagram_targets(dm_sent);
create index if not exists instagram_targets_created_at_idx on public.instagram_targets(created_at desc);

-- updated_at trigger
create or replace function update_instagram_targets_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger instagram_targets_updated_at
  before update on public.instagram_targets
  for each row
  execute function update_instagram_targets_updated_at();
