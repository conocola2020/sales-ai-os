/**
 * website URL の種別判定（自社HP / Instagram / SNS / ポータル）
 *
 * Google Places の websiteUri は自社HPとは限らない。SNS・グルメ/地域ポータルを
 * 自社HPとして巡回すると、ポータル側の検索・問い合わせフォームを
 * その店のフォームと誤検出するため、巡回前にドメインで振り分ける。
 * enrich-prospects と reverify-form-leads の両方から使う共通モジュール。
 */

import { extractUsername } from '@/lib/instagram-detector'

export const SNS_HOSTS = [
  'twitter.com', 'x.com', 'facebook.com', 'line.me', 'lin.ee',
  'tiktok.com', 'youtube.com', 'youtu.be',
]

export const PORTAL_HOSTS = [
  'tabelog.com', 'hotpepper.jp', 'retty.me', 'gnavi.co.jp', 'ubereats.com', 'demae-can.com',
  // 地域ポータル・予約プラットフォーム（店のフォームではなくポータルのフォームを誤検出するため）
  'mypl.net', 'ekiten.jp', 'hitosara.com', 'tablecheck.com', 'omakase.in',
  'pocket-concierge.jp', 'toreta.in', 'favy.jp', 'jalan.net', 'ikyu.com',
]

const IG_NON_USERNAME_PATHS = ['p', 'reel', 'reels', 'explore', 'stories', 'accounts', 'direct', 'tv']

export type WebsiteKind =
  | { kind: 'own_site' }
  | { kind: 'instagram'; instagramUrl: string | null }
  | { kind: 'sns' | 'portal'; hostname: string }

export function classifyWebsite(website: string): WebsiteKind {
  let hostname: string
  try {
    hostname = new URL(website).hostname.replace(/^www\./, '')
  } catch {
    return { kind: 'own_site' }
  }

  if (hostname === 'instagram.com' || hostname.endsWith('.instagram.com')) {
    const username = extractUsername(website)
    const valid = username && !IG_NON_USERNAME_PATHS.includes(username)
    return { kind: 'instagram', instagramUrl: valid ? `https://www.instagram.com/${username}/` : null }
  }
  if (SNS_HOSTS.some(h => hostname === h || hostname.endsWith(`.${h}`))) {
    return { kind: 'sns', hostname }
  }
  if (PORTAL_HOSTS.some(h => hostname === h || hostname.endsWith(`.${h}`))) {
    return { kind: 'portal', hostname }
  }
  return { kind: 'own_site' }
}
