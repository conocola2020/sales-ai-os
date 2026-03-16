-- send_queue に retry_count カラムを追加
ALTER TABLE send_queue ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0;
