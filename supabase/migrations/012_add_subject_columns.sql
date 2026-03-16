-- messages テーブルに subject カラムを追加
ALTER TABLE messages ADD COLUMN IF NOT EXISTS subject TEXT;

-- send_queue テーブルに subject カラムを追加
ALTER TABLE send_queue ADD COLUMN IF NOT EXISTS subject TEXT;
