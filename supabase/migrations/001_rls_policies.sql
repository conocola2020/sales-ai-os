-- ============================================================
-- Sales AI OS - Row Level Security (RLS) Policies
-- Run this in Supabase SQL Editor to enable RLS
-- ============================================================

-- ──────────────────────────────────────────
-- Enable RLS on all tables
-- ──────────────────────────────────────────
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE send_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────
-- LEADS
-- ──────────────────────────────────────────
CREATE POLICY "Users can view own leads"
  ON leads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own leads"
  ON leads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own leads"
  ON leads FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own leads"
  ON leads FOR DELETE
  USING (auth.uid() = user_id);

-- ──────────────────────────────────────────
-- SEND_QUEUE
-- ──────────────────────────────────────────
CREATE POLICY "Users can view own queue"
  ON send_queue FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own queue"
  ON send_queue FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own queue"
  ON send_queue FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own queue"
  ON send_queue FOR DELETE
  USING (auth.uid() = user_id);

-- ──────────────────────────────────────────
-- REPLIES
-- ──────────────────────────────────────────
CREATE POLICY "Users can view own replies"
  ON replies FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own replies"
  ON replies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own replies"
  ON replies FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own replies"
  ON replies FOR DELETE
  USING (auth.uid() = user_id);

-- ──────────────────────────────────────────
-- DEALS
-- ──────────────────────────────────────────
CREATE POLICY "Users can view own deals"
  ON deals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own deals"
  ON deals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own deals"
  ON deals FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own deals"
  ON deals FOR DELETE
  USING (auth.uid() = user_id);

-- ──────────────────────────────────────────
-- INSTAGRAM_TARGETS
-- ──────────────────────────────────────────
CREATE POLICY "Users can view own ig targets"
  ON instagram_targets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ig targets"
  ON instagram_targets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ig targets"
  ON instagram_targets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own ig targets"
  ON instagram_targets FOR DELETE
  USING (auth.uid() = user_id);

-- ──────────────────────────────────────────
-- COMPANY_ANALYSES
-- ──────────────────────────────────────────
CREATE POLICY "Users can view own analyses"
  ON company_analyses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analyses"
  ON company_analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own analyses"
  ON company_analyses FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own analyses"
  ON company_analyses FOR DELETE
  USING (auth.uid() = user_id);

-- ──────────────────────────────────────────
-- MESSAGES
-- ──────────────────────────────────────────
CREATE POLICY "Users can view own messages"
  ON messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own messages"
  ON messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own messages"
  ON messages FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own messages"
  ON messages FOR DELETE
  USING (auth.uid() = user_id);

-- ──────────────────────────────────────────
-- Indexes for performance
-- ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_send_queue_user_id ON send_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_replies_user_id ON replies(user_id);
CREATE INDEX IF NOT EXISTS idx_deals_user_id ON deals(user_id);
CREATE INDEX IF NOT EXISTS idx_instagram_targets_user_id ON instagram_targets(user_id);
CREATE INDEX IF NOT EXISTS idx_company_analyses_user_id ON company_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_send_queue_status ON send_queue(status);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
