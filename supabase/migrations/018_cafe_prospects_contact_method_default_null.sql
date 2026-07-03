-- Phase 3（連絡先抽出）の前提修正:
-- contact_method は「null = 未処理」を意味する設計だが、017 で default 'none' が
-- 付いていたため収集直後の行が 'none'（=処理済み扱い）になっていた。
-- デフォルトを外し、未エンリッチの既存行を null に戻す。

alter table public.cafe_prospects alter column contact_method drop default;

-- これまで enrich は一度も実行されていないため、全行が未処理
update public.cafe_prospects set contact_method = null;
