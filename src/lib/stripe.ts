// NOTE: `stripe` パッケージが未インストールです。以下を実行してください:
// npm install stripe

import Stripe from 'stripe'

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      // Stripe v22 の型と互換性を保つため any を一時的に使用
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      apiVersion: '2025-03-31.basil' as any,
      typescript: true,
    })
  : null

/** Stripe が設定済みかどうか */
export function isStripeConfigured(): boolean {
  return stripe !== null
}

export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    limits: { leads: 100, sends_per_month: 50, members: 2 },
  },
  starter: {
    name: 'Starter',
    priceId: process.env.STRIPE_STARTER_PRICE_ID,
    price: 9800,
    limits: { leads: 1000, sends_per_month: 300, members: 5 },
  },
  pro: {
    name: 'Pro',
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    price: 29800,
    limits: { leads: 10000, sends_per_month: 1000, members: 20 },
  },
  enterprise: {
    name: 'Enterprise',
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID,
    price: null, // カスタム
    limits: { leads: Infinity, sends_per_month: Infinity, members: Infinity },
  },
} as const

export type PlanId = keyof typeof PLANS
