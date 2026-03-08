-- Create replies table for managing inbound replies from leads
CREATE TABLE IF NOT EXISTS replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  content text NOT NULL,
  sentiment text NOT NULL DEFAULT 'その他'
    CHECK (sentiment IN ('興味あり', '検討中', 'お断り', '質問', 'その他')),
  is_read boolean NOT NULL DEFAULT false,
  ai_response text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE replies ENABLE ROW LEVEL SECURITY;

-- Policy: users can only access their own replies
CREATE POLICY "users can manage own replies"
  ON replies
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_replies_user_id ON replies(user_id);
CREATE INDEX IF NOT EXISTS idx_replies_lead_id ON replies(lead_id);
CREATE INDEX IF NOT EXISTS idx_replies_sentiment ON replies(sentiment);
CREATE INDEX IF NOT EXISTS idx_replies_is_read ON replies(is_read);
CREATE INDEX IF NOT EXISTS idx_replies_created_at ON replies(created_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_replies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER replies_updated_at
  BEFORE UPDATE ON replies
  FOR EACH ROW EXECUTE FUNCTION update_replies_updated_at();
