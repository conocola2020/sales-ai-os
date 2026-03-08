-- 008_alter_instagram_targets_add_columns.sql
-- 007で定義したが既存テーブルに存在しない可能性のあるカラムを追加

alter table public.instagram_targets
  add column if not exists industry        text,
  add column if not exists engagement_rate numeric(5,2)
    check (engagement_rate >= 0 and engagement_rate <= 100),
  add column if not exists dm_replied      boolean not null default false,
  add column if not exists liked_back      boolean not null default false,
  add column if not exists followed_back   boolean not null default false,
  add column if not exists updated_at      timestamptz not null default now();

-- updated_at トリガー（未存在なら作成）
create or replace function update_instagram_targets_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists instagram_targets_updated_at on public.instagram_targets;

create trigger instagram_targets_updated_at
  before update on public.instagram_targets
  for each row
  execute function update_instagram_targets_updated_at();

-- 追加インデックス（未存在なら作成）
create index if not exists instagram_targets_dm_sent_idx
  on public.instagram_targets(dm_sent);
