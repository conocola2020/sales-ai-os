'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type {
  MeoLocation,
  MeoReview,
  MeoCitation,
  MeoAioCheck,
  ReviewReplyStatus,
} from '@/types/meo'
import {
  demoLocation,
  demoReviews,
  demoCitations,
  demoAioChecks,
} from '@/lib/meo/demo-data'

export interface MeoData {
  location: MeoLocation
  reviews: MeoReview[]
  citations: MeoCitation[]
  aioChecks: MeoAioCheck[]
  isDemo: boolean
}

// ──────────────────────────────────────────
// MEOモジュールの全データ取得（未ログイン/未設定時はデモデータ）
// ──────────────────────────────────────────
export async function getMeoData(): Promise<MeoData> {
  const demo: MeoData = {
    location: demoLocation,
    reviews: demoReviews,
    citations: demoCitations,
    aioChecks: demoAioChecks,
    isDemo: true,
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return demo

    const { data: locations, error: locError } = await supabase
      .from('meo_locations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)

    if (locError || !locations || locations.length === 0) return demo

    const location = locations[0] as MeoLocation

    const [reviewsRes, citationsRes, checksRes] = await Promise.all([
      supabase
        .from('meo_reviews')
        .select('*')
        .eq('location_id', location.id)
        .order('review_date', { ascending: false })
        .limit(200),
      supabase
        .from('meo_citations')
        .select('*')
        .eq('location_id', location.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('meo_aio_checks')
        .select('*')
        .eq('location_id', location.id)
        .order('checked_at', { ascending: false })
        .limit(100),
    ])

    return {
      location,
      reviews: (reviewsRes.data as MeoReview[]) ?? [],
      citations: (citationsRes.data as MeoCitation[]) ?? [],
      aioChecks: (checksRes.data as MeoAioCheck[]) ?? [],
      isDemo: false,
    }
  } catch (e) {
    console.error('getMeoData error:', e)
    return demo
  }
}

// ──────────────────────────────────────────
// 口コミ返信の保存（下書き / 返信済み）
// ──────────────────────────────────────────
export async function saveReviewReply(
  reviewId: string,
  replyBody: string,
  status: Extract<ReviewReplyStatus, '下書き' | '返信済み'>
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'デモモードのため保存できません（ログインしてください）' }

  const { error } = await supabase
    .from('meo_reviews')
    .update({
      reply_body: replyBody,
      reply_status: status,
      replied_at: status === '返信済み' ? new Date().toISOString() : null,
    })
    .eq('id', reviewId)
    .eq('user_id', user.id)

  if (error) {
    console.error('saveReviewReply error:', error)
    return { error: error.message }
  }

  revalidatePath('/meo/reviews')
  revalidatePath('/meo')
  return { error: null }
}

// ──────────────────────────────────────────
// サイテーションのステータス更新（連携申請のシミュレーション）
// ──────────────────────────────────────────
export async function updateCitationStatus(
  citationId: string,
  status: MeoCitation['status']
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'デモモードのため更新できません（ログインしてください）' }

  const { error } = await supabase
    .from('meo_citations')
    .update({
      status,
      last_synced_at: status === '同期済み' ? new Date().toISOString() : null,
      indexed: status === '同期済み',
    })
    .eq('id', citationId)
    .eq('user_id', user.id)

  if (error) {
    console.error('updateCitationStatus error:', error)
    return { error: error.message }
  }

  revalidatePath('/meo/citations')
  revalidatePath('/meo')
  return { error: null }
}
