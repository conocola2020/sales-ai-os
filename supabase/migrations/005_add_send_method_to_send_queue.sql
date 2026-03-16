-- Add send_method, form_url, screenshot_url columns to send_queue
ALTER TABLE send_queue
  ADD COLUMN IF NOT EXISTS send_method text NOT NULL DEFAULT 'email'
    CHECK (send_method IN ('email', 'form')),
  ADD COLUMN IF NOT EXISTS form_url text,
  ADD COLUMN IF NOT EXISTS screenshot_url text;

-- Update status CHECK constraint to include 'form_not_found'
ALTER TABLE send_queue DROP CONSTRAINT IF EXISTS send_queue_status_check;
ALTER TABLE send_queue ADD CONSTRAINT send_queue_status_check
  CHECK (status IN ('待機中', '確認待ち', '送信済み', '失敗', 'form_not_found'));
