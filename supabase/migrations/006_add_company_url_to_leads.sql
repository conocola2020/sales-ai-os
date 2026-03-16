-- Add company_url column to leads table
-- company_url = 企業の公式HP URL（フォーム送信先）
-- website_url = 掲載URL（サウナイキタイ等のポータルサイト）
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS company_url text;
