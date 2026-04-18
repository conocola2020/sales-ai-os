import { NextResponse } from 'next/server'
import { stripe, isStripeConfigured } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

// Webhook は認証なしで受け取るため、Service Role Key で直接 Supabase クライアントを作成
function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey)
}

// プランIDをStripe Price IDから逆引き
function planIdFromPriceId(priceId: string): string {
  if (priceId === process.env.STRIPE_STARTER_PRICE_ID) return 'starter'
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return 'pro'
  if (priceId === process.env.STRIPE_ENTERPRISE_PRICE_ID) return 'enterprise'
  return 'free'
}

export async function POST(request: Request) {
  // デモモード
  if (!isStripeConfigured() || !stripe) {
    return NextResponse.json({ received: true, demo: true })
  }

  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    )
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set')
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    )
  }

  // 署名検証
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    )
  }

  const supabase = getAdminSupabase()
  if (!supabase) {
    console.error('Supabase admin client not available')
    return NextResponse.json(
      { error: 'Database connection error' },
      { status: 500 }
    )
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const orgId = session.metadata?.org_id
        const planId = session.metadata?.plan_id

        if (orgId && planId) {
          const subscriptionId =
            typeof session.subscription === 'string'
              ? session.subscription
              : session.subscription?.id

          await supabase
            .from('organizations')
            .update({
              plan: planId,
              stripe_subscription_id: subscriptionId ?? null,
            })
            .eq('id', orgId)

          console.log(`[Billing] Org ${orgId} upgraded to ${planId}`)
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id

        // Price ID からプランを特定
        const priceId = subscription.items.data[0]?.price?.id
        if (priceId) {
          const newPlan = planIdFromPriceId(priceId)

          await supabase
            .from('organizations')
            .update({ plan: newPlan })
            .eq('stripe_customer_id', customerId)

          console.log(`[Billing] Customer ${customerId} plan changed to ${newPlan}`)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id

        await supabase
          .from('organizations')
          .update({
            plan: 'free',
            stripe_subscription_id: null,
          })
          .eq('stripe_customer_id', customerId)

        console.log(`[Billing] Customer ${customerId} downgraded to free`)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId =
          typeof invoice.customer === 'string'
            ? invoice.customer
            : invoice.customer?.id

        // 将来的にメール通知に変更
        console.warn(
          `[Billing] Payment failed for customer ${customerId}. ` +
          `Invoice: ${invoice.id}, Amount: ${invoice.amount_due}`
        )
        break
      }

      default:
        // 未対応のイベントは無視
        console.log(`[Billing] Unhandled event type: ${event.type}`)
    }
  } catch (error) {
    console.error(`[Billing] Error processing ${event.type}:`, error)
    // Stripe にリトライさせるため 500 を返す
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }

  return NextResponse.json({ received: true })
}
