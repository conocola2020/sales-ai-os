import { NextResponse } from 'next/server'
import { stripe, isStripeConfigured, PLANS, PlanId } from '@/lib/stripe'
import { getAuthenticatedUser } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    // 認証チェック
    const { supabase, user, orgId } = await getAuthenticatedUser()
    if (!user || !orgId) {
      return NextResponse.json(
        { error: 'ログインが必要です' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const planId = body.planId as PlanId

    // プランの妥当性チェック
    if (!planId || !(planId in PLANS) || planId === 'free') {
      return NextResponse.json(
        { error: '無効なプランが指定されました' },
        { status: 400 }
      )
    }

    const plan = PLANS[planId]
    if (!('priceId' in plan) || !plan.priceId) {
      return NextResponse.json(
        { error: 'このプランの価格設定がまだ完了していません' },
        { status: 400 }
      )
    }

    // デモモード: Stripe未設定の場合
    if (!isStripeConfigured() || !stripe) {
      return NextResponse.json({
        url: null,
        demo: true,
        message: 'Stripeが設定されていないため、デモモードで動作しています',
      })
    }

    // 組織情報を取得
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, stripe_customer_id')
      .eq('id', orgId)
      .single()

    if (orgError || !org) {
      return NextResponse.json(
        { error: '組織情報の取得に失敗しました' },
        { status: 500 }
      )
    }

    // Stripe Customer の取得または作成
    let customerId = org.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: org.name,
        metadata: {
          org_id: orgId,
          supabase_user_id: user.id,
        },
      })
      customerId = customer.id

      // stripe_customer_id を保存
      await supabase
        .from('organizations')
        .update({ stripe_customer_id: customerId })
        .eq('id', orgId)
    }

    // Checkout Session 作成
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [
        {
          price: plan.priceId,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/dashboard/settings?billing=success`,
      cancel_url: `${appUrl}/dashboard/settings?billing=cancel`,
      metadata: {
        org_id: orgId,
        plan_id: planId,
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Checkout session creation failed:', error)
    return NextResponse.json(
      { error: '決済セッションの作成に失敗しました。しばらく後にお試しください。' },
      { status: 500 }
    )
  }
}
