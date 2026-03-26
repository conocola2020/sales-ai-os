-- Add instagram_url and contact_method columns to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS instagram_url TEXT;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS contact_method TEXT
  CHECK (contact_method IN ('form', 'email', 'instagram', 'manual', 'none'));
