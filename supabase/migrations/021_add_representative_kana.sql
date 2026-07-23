-- フォーム送信のフリガナ必須項目対応。
-- 送信者の氏名フリガナ（カタカナ）を持つ。漢字名は自動でカタカナ化できないため
-- ユーザーが一度設定する。フォーム送信時 SenderInfo.nameKana として使う。
alter table public.user_settings add column if not exists representative_kana text;
update public.user_settings
  set representative_kana = 'コウノダイチ'
  where representative = '河野大地' and (representative_kana is null or representative_kana = '');
