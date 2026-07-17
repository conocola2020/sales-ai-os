-- Phase 2B: リスト収集の全業種対応
-- cafe_prospects はカフェ専用の名前だが13業種を格納するため prospects にリネームし、
-- industry カラムを追加する。既存行はすべてカフェ収集分。

alter table if exists public.cafe_prospects rename to prospects;

alter table public.prospects add column if not exists industry text;

update public.prospects set industry = 'カフェ' where industry is null;

create index if not exists prospects_industry_idx
  on public.prospects(user_id, industry);
