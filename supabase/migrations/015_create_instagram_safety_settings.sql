-- Instagram safety settings (per user)
CREATE TABLE IF NOT EXISTS public.instagram_safety_settings (
  id                   uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid         NOT NULL UNIQUE,
  account_start_date   date         NOT NULL DEFAULT current_date,
  daily_dm_limit       integer      NOT NULL DEFAULT 20,
  min_interval_minutes integer      NOT NULL DEFAULT 5,
  warmup_enabled       boolean      NOT NULL DEFAULT true,
  created_at           timestamptz  NOT NULL DEFAULT now(),
  updated_at           timestamptz  NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_ig_safety_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ig_safety_updated_at
  BEFORE UPDATE ON public.instagram_safety_settings
  FOR EACH ROW EXECUTE FUNCTION update_ig_safety_updated_at();

-- RLS
ALTER TABLE public.instagram_safety_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings"
  ON public.instagram_safety_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON public.instagram_safety_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON public.instagram_safety_settings FOR UPDATE
  USING (auth.uid() = user_id);
