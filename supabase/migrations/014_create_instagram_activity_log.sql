-- Instagram activity log for safety tracking
CREATE TABLE IF NOT EXISTS public.instagram_activity_log (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid         NOT NULL,
  target_id       uuid         REFERENCES public.instagram_targets(id) ON DELETE SET NULL,
  action_type     text         NOT NULL CHECK (action_type IN ('dm_sent', 'like', 'follow', 'unfollow')),
  target_username text,
  notes           text,
  created_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ig_activity_user_type_date
  ON public.instagram_activity_log (user_id, action_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ig_activity_created
  ON public.instagram_activity_log (created_at DESC);

-- RLS
ALTER TABLE public.instagram_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own activity"
  ON public.instagram_activity_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own activity"
  ON public.instagram_activity_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);
