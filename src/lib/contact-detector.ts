/**
 * 連絡方法検出モジュール
 *
 * 企業HPにアクセスし、お問い合わせフォームまたはメールアドレスを検出する。
 * form-sender.ts の findContactPageUrl/fetchHtml を再利用。
 */

import * as cheerio from 'cheerio'

// ─── 定数 ────────────────────────────────────

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const FETCH_TIMEOUT = 60000

const CONTACT_PATHS = [
  '/contact', '/contact/', '/inquiry', '/inquiry/',
  '/お問い合わせ', '/contact-us', '/contactus',
  '/form', '/toiawase', '/otoiawase', '/mail',
]

const CONTACT_LINK_KEYWORDS = [
  '問い合わせ', 'お問い合わせ', 'contact', 'inquiry',
  'toiawase', 'メール', 'フォーム', 'mail',
]

// ノイズ除外用ドメイン
const NOISE_EMAIL_DOMAINS = [
  'example.com', 'example.org', 'sentry.io', 'w3.org',
  'schema.org', 'wixpress.com', 'wordpress.org',
  'google.com', 'facebook.com', 'twitter.com',
  'noreply', 'no-reply', 'donotreply',
]

// 自社ドメイン外でも問い合わせフォームとして信頼できる既知サービス
const FORM_SERVICE_HOSTS = [
  'docs.google.com', 'forms.gle', 'formrun.com', 'form.run',
  'formzu.net', 'ssl.formman.com', 'form-mailer.jp', 'formok.com',
  'jotform.com', 'typeform.com', 'kintoneapp.com',
]

/** eTLD+1相当の登録ドメインを取る（co.jp等の属性型JPドメイン対応の簡易版） */
export function registrableDomain(hostname: string): string {
  const labels = hostname.toLowerCase().replace(/^www\./, '').split('.')
  if (labels.length <= 2) return labels.join('.')
  const lastTwo = labels.slice(-2).join('.')
  const jpAttr = new Set(['co.jp', 'or.jp', 'ne.jp', 'ac.jp', 'go.jp', 'gr.jp', 'ed.jp', 'lg.jp'])
  return jpAttr.has(lastTwo) ? labels.slice(-3).join('.') : lastTwo
}

/** フォームURLとして採用してよいか（自社ドメイン or 既知フォームサービスのみ） */
export function isTrustedFormHost(formUrl: string, baseUrl: string): boolean {
  try {
    const formHost = new URL(formUrl).hostname.toLowerCase()
    const baseHost = new URL(baseUrl).hostname.toLowerCase()
    if (registrableDomain(formHost) === registrableDomain(baseHost)) return true
    return FORM_SERVICE_HOSTS.some(h => formHost === h || formHost.endsWith(`.${h}`))
  } catch {
    return false
  }
}

/**
 * ページ内に「本物の問い合わせフォーム」があるか。
 * 検索ボックス等の誤検出を防ぐため、メッセージ入力欄（textarea）を持つ form を必須にする
 * （検索フォームは textarea を持たない）。
 */
function hasRealContactForm($: cheerio.CheerioAPI): boolean {
  let found = false
  $('form').each((_, el) => {
    if ($(el).find('textarea').length > 0) found = true
  })
  return found
}

// ─── 型定義 ─────────────────────────────────

export interface ContactDetectionResult {
  method: 'form' | 'email' | 'none'
  contactUrl?: string
  email?: string
  hasRecaptcha?: boolean
  error?: string
}

// ─── ユーティリティ ──────────────────────────

async function fetchHtml(url: string): Promise<{ html: string; finalUrl: string } | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) return null
    const html = await res.text()
    return { html, finalUrl: res.url }
  } catch {
    return null
  }
}

function resolveUrl(base: string, href: string): string {
  try {
    return new URL(href, base).href
  } catch {
    return href
  }
}

// ─── メール検出 ──────────────────────────────

export function extractEmails(html: string): string[] {
  const emails = new Set<string>()

  // mailto: リンクから
  const mailtoRegex = /mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi
  let match
  while ((match = mailtoRegex.exec(html)) !== null) {
    emails.add(match[1].toLowerCase())
  }

  // HTMLからスクリプト・スタイルを除去してテキスト中のメールを探す
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')

  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
  while ((match = emailRegex.exec(cleaned)) !== null) {
    emails.add(match[0].toLowerCase())
  }

  // ノイズ除外
  return Array.from(emails).filter(email => {
    const domain = email.split('@')[1]
    return !NOISE_EMAIL_DOMAINS.some(noise =>
      domain.includes(noise) || email.includes(noise)
    )
  })
}

// ─── フォーム検出 ────────────────────────────

async function findContactFormUrl(baseUrl: string): Promise<{
  url: string | null
  hasRecaptcha: boolean
}> {
  const page = await fetchHtml(baseUrl)
  if (!page) return { url: null, hasRecaptcha: false }

  const $ = cheerio.load(page.html)

  // 1. リンクからキーワード検索
  const candidateLinks: string[] = []
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || ''
    const text = $(el).text().trim().toLowerCase()
    const lowerHref = href.toLowerCase()
    for (const kw of CONTACT_LINK_KEYWORDS) {
      if (lowerHref.includes(kw) || text.includes(kw)) {
        candidateLinks.push(resolveUrl(page.finalUrl, href))
        break
      }
    }
  })

  // リンク先にフォームがあるか確認
  // （自社ドメイン外のリンクはポータル/SNSのフォームを誤検出しやすいため、既知サービス以外は追わない）
  for (const link of candidateLinks) {
    if (!isTrustedFormHost(link, baseUrl)) continue
    const linkPage = await fetchHtml(link)
    if (!linkPage) continue
    if (!isTrustedFormHost(linkPage.finalUrl, baseUrl)) continue
    const $link = cheerio.load(linkPage.html)
    if (hasRealContactForm($link)) {
      const hasRecaptcha = linkPage.html.toLowerCase().includes('recaptcha') ||
        linkPage.html.toLowerCase().includes('g-recaptcha') ||
        linkPage.html.toLowerCase().includes('h-captcha')
      return { url: linkPage.finalUrl, hasRecaptcha }
    }
  }

  // 2. よくあるパスを試す
  const origin = new URL(baseUrl).origin
  for (const path of CONTACT_PATHS) {
    const url = `${origin}${path}`
    const pathPage = await fetchHtml(url)
    if (!pathPage) continue
    if (!isTrustedFormHost(pathPage.finalUrl, baseUrl)) continue
    const $path = cheerio.load(pathPage.html)
    if (hasRealContactForm($path)) {
      const hasRecaptcha = pathPage.html.toLowerCase().includes('recaptcha') ||
        pathPage.html.toLowerCase().includes('g-recaptcha')
      return { url: pathPage.finalUrl, hasRecaptcha }
    }
  }

  return { url: null, hasRecaptcha: false }
}

// ─── メインエントリポイント ──────────────────

export async function detectContact(companyUrl: string): Promise<ContactDetectionResult> {
  try {
    // HPのHTMLを取得
    const page = await fetchHtml(companyUrl)
    if (!page) {
      return { method: 'none', error: 'HPにアクセスできませんでした' }
    }

    // メールアドレスを検出
    const emails = extractEmails(page.html)

    // フォームを検出
    const form = await findContactFormUrl(companyUrl)

    // 結果判定（フォーム優先）
    if (form.url) {
      return {
        method: 'form',
        contactUrl: form.url,
        email: emails[0] || undefined,
        hasRecaptcha: form.hasRecaptcha,
      }
    }

    if (emails.length > 0) {
      return {
        method: 'email',
        email: emails[0],
      }
    }

    return { method: 'none' }
  } catch (err) {
    return {
      method: 'none',
      error: err instanceof Error ? err.message : 'unknown error',
    }
  }
}
