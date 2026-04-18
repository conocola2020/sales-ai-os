import { NextResponse } from 'next/server'
import { stripe, isStripeConfigured } from '@/lib/stripe'
import { getAuthenticatedUser } from '@/lib/supabase/server'

export async function POST() {
  try {
    // 認証チェック
    const { supabase, user, orgId } = await getAuthenticatedUser()
    if (!user || !orgId) {
      return NextResponse.json(
        { error: 'ログインが必要です' },
        { status: 401 }
      )
    }

    // デモモード
    if (!isStripeConfigured() || !stripe) {
      return NextResponse.json({
        url: null,
        demo: true,
        message: 'Stripeが設定されていないため、デモモードで動作しています',
      })
    }

    // 組織の stripe_customer_id を取得
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('stripe_customer_id')
      .eq('id', orgId)
      .single()

    if (orgError || !org) {
      return NextResponse.json(
        { error: '組織情報の取得に失敗しました' },
        { status: 500 }
      )
    }

    if (!org.stripe_customer_id) {
      return NextResponse.json(
        { error: 'サブスクリプションがまだ開始されていません' },
        { status: 400 }
      )
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Stripe カスタマーポータルセッション作成
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${appUrl}/dashboard/settings`,
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (error) {
    console.error('Portal session creation failed:', error)
    return NextResponse.json(
      { error: 'ポータルセッションの作成に失敗しました。しばらく後にお試しください。' },
      { status: 500 }
    )
  }
}
