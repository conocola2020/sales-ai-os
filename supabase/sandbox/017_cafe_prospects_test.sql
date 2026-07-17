-- 017_cafe_prospects_test.sql
-- 動作確認用サンプル。本番マイグレーションではない。
-- Supabase SQL Editor で手動実行して挙動を検証する。
--
-- ⚠️ 事前準備:
--   1. 017_create_cafe_prospects.sql を適用済みであること
--   2. 下記の :user_id プレースホルダを実際の auth.users.id に置換すること
--      (psql の \set user_id '...' を使うか、手動で UUID を貼り付け)
--
-- 例:
--   \set user_id '00000000-0000-0000-0000-000000000000'
--   または以下を直接書き換え:
--     :'user_id' → '00000000-0000-0000-0000-000000000000'

-- ============================================
-- 1. 最小カラムでの INSERT
-- ============================================
insert into public.cafe_prospects (user_id, place_id, name)
values (:'user_id', 'ChIJtest_minimal_001', 'テストカフェ最小');

-- ============================================
-- 2. 全カラムを使った INSERT (raw_data 含む)
--    raw_data には Google Places API のレスポンスのみを入れる想定。
--    APIキー等の認証情報は絶対に含めないこと。
-- ============================================
insert into public.cafe_prospects (
  user_id, place_id, name, formatted_address, prefecture,
  phone, website, instagram_url, email, contact_form_url,
  latitude, longitude, rating, user_rating_count,
  primary_type, business_status, raw_data
)
values (
  :'user_id',
  'ChIJtest_full_001',
  'サンプルカフェ渋谷',
  '東京都渋谷区道玄坂1-2-3',
  '東京都',
  '03-1234-5678',
  'https://example.com',
  'https://instagram.com/example',
  'info@example.com',
  'https://example.com/contact',
  35.6595000,
  139.7004000,
  4.5,
  234,
  'cafe',
  'OPERATIONAL',
  '{"opening_hours": {"weekday_text": ["月: 9:00-22:00"]}, "types": ["cafe", "food"]}'::jsonb
);

-- ============================================
-- 3. SELECT: ステータス別 / 地域別
-- ============================================
select id, name, status, prefecture, rating, user_rating_count
  from public.cafe_prospects
 where status = 'untouched'
 order by created_at desc;

select count(*) as untouched_in_tokyo
  from public.cafe_prospects
 where status = 'untouched' and prefecture = '東京都';

-- ============================================
-- 4. UNIQUE(user_id, place_id) 制約検証
--    同じユーザーが同じ place_id を再 INSERT すると失敗する想定
-- ============================================
-- 以下を実行するとエラーになる:
-- insert into public.cafe_prospects (user_id, place_id, name)
-- values (:'user_id', 'ChIJtest_minimal_001', '重複テスト');
-- → ERROR: duplicate key value violates unique constraint "cafe_prospects_user_id_place_id_key"

-- ============================================
-- 5. UPDATE: 精査済みに変更 (updated_at が自動更新されることも確認)
-- ============================================
update public.cafe_prospects
   set status = 'verified',
       email  = 'verified@example.com'
 where place_id = 'ChIJtest_full_001'
   and user_id  = :'user_id';

select place_id, status, email, created_at, updated_at,
       (updated_at > created_at) as trigger_fired
  from public.cafe_prospects
 where place_id = 'ChIJtest_full_001'
   and user_id  = :'user_id';

-- ============================================
-- 6. leads への昇格フロー検証
--    cafe_prospects の verified 行から leads を作成し、lead_id を紐付けて promoted へ
-- ============================================
with new_lead as (
  insert into public.leads (user_id, company_name, website_url, prefecture)
  select user_id, name, website, prefecture
    from public.cafe_prospects
   where place_id = 'ChIJtest_full_001'
     and user_id  = :'user_id'
  returning id
)
update public.cafe_prospects
   set status  = 'promoted',
       lead_id = (select id from new_lead)
 where place_id = 'ChIJtest_full_001'
   and user_id  = :'user_id';

-- 紐付き確認
select cp.place_id, cp.status, cp.lead_id, l.company_name as promoted_to_lead
  from public.cafe_prospects cp
  left join public.leads l on l.id = cp.lead_id
 where cp.place_id = 'ChIJtest_full_001'
   and cp.user_id  = :'user_id';

-- ============================================
-- 7. CHECK 制約検証 (以下はいずれも失敗する想定)
-- ============================================
-- 緯度範囲外:
-- insert into public.cafe_prospects (user_id, place_id, name, latitude)
-- values (:'user_id', 'ChIJtest_bad_lat', '範囲外緯度', 200);

-- 不正な status:
-- insert into public.cafe_prospects (user_id, place_id, name, status)
-- values (:'user_id', 'ChIJtest_bad_status', '不正ステータス', 'invalid');

-- 評価が 5 超:
-- insert into public.cafe_prospects (user_id, place_id, name, rating)
-- values (:'user_id', 'ChIJtest_bad_rating', '評価過大', 5.5);

-- ============================================
-- 8. lead 削除時の SET NULL 動作確認
-- ============================================
-- 紐付けた leads を削除すると、cafe_prospects.lead_id が NULL に戻ることを確認
-- delete from public.leads where id = (
--   select lead_id from public.cafe_prospects
--    where place_id = 'ChIJtest_full_001' and user_id = :'user_id'
-- );
-- select place_id, status, lead_id from public.cafe_prospects
--  where place_id = 'ChIJtest_full_001' and user_id = :'user_id';
-- → lead_id は NULL、status は 'promoted' のまま (意図的: 履歴として残す)

-- ============================================
-- 9. クリーンアップ
-- ============================================
delete from public.cafe_prospects
 where user_id = :'user_id'
   and place_id like 'ChIJtest_%';
