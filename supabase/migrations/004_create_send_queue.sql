-- Create send_queue table for managing outbound message sending
CREATE TABLE IF NOT EXISTS send_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  message_content text NOT NULL,
  status text NOT NULL DEFAULT '待機中'
    CHECK (status IN ('待機中', '確認待ち', '送信済み', '失敗')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  error_message text,
  retry_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE send_queue ENABLE ROW LEVEL SECURITY;

-- Policy: users can only access their own queue items
CREATE POLICY "users can manage own send_queue"
  ON send_queue
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_send_queue_user_id ON send_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_send_queue_lead_id ON send_queue(lead_id);
CREATE INDEX IF NOT EXISTS idx_send_queue_status ON send_queue(status);
CREATE INDEX IF NOT EXISTS idx_send_queue_created_at ON send_queue(created_at DESC);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_send_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER send_queue_updated_at
  BEFORE UPDATE ON send_queue
  FOR EACH ROW EXECUTE FUNCTION update_send_queue_updated_at();
