-- Add meeting and activity tracking fields to deals
ALTER TABLE deals ADD COLUMN IF NOT EXISTS meeting_date TIMESTAMPTZ;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS meeting_url TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS activity_log JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_deals_meeting_date ON deals(meeting_date);
