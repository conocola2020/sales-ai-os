-- ============================================
-- Stripe 課金連携用カラム追加
-- Phase 3
-- ============================================

alter table public.organizations
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

create index if not exists organizations_stripe_customer_id_idx
  on public.organizations (stripe_customer_id);
