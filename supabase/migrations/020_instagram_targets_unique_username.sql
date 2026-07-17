-- Phase 3B 前提修正:
-- instagram_targets に (user_id, username) の UNIQUE が無く、
-- 既存の bulkCreateTargets の onConflict 'user_id,username' が機能していなかった。
-- 1) 大文字小文字を無視した重複を掃除（残す優先: dm_sent > status進行度 > 古い行）
-- 2) username を小文字に正規化
-- 3) UNIQUE インデックスを追加

with ranked as (
  select id, row_number() over (
    partition by user_id, lower(username)
    order by
      dm_sent desc,
      case status
        when '成約' then 6
        when '返信あり' then 5
        when 'DM送信済み' then 4
        when 'アプローチ中' then 3
        when 'NG' then 2
        else 1
      end desc,
      created_at asc
  ) as rn
  from public.instagram_targets
)
delete from public.instagram_targets t
using ranked r
where t.id = r.id and r.rn > 1;

update public.instagram_targets
set username = lower(username)
where username <> lower(username);

create unique index if not exists instagram_targets_user_username_uidx
  on public.instagram_targets(user_id, username);
