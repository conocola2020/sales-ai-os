-- Create company_analyses table
CREATE TABLE IF NOT EXISTS company_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  company_name TEXT,
  industry TEXT,
  scale TEXT,
  business_summary TEXT,
  challenges JSONB DEFAULT '[]',
  proposal_points JSONB DEFAULT '[]',
  keywords JSONB DEFAULT '[]',
  raw_analysis JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE company_analyses ENABLE ROW LEVEL SECURITY;

-- Policy: users can only see their own analyses
CREATE POLICY "Users can view own analyses"
  ON company_analyses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analyses"
  ON company_analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own analyses"
  ON company_analyses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own analyses"
  ON company_analyses FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS company_analyses_user_id_idx ON company_analyses(user_id);
CREATE INDEX IF NOT EXISTS company_analyses_lead_id_idx ON company_analyses(lead_id);
CREATE INDEX IF NOT EXISTS company_analyses_created_at_idx ON company_analyses(created_at DESC);
