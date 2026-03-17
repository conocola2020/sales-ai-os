/**
 * 送信ワーカー (Railway用)
 *
 * send_queue の status='確認待ち' アイテムを定期的にポーリングし、
 * send_method に応じて Resend (email) または Playwright (form) で送信する。
 *
 * 環境変数:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   RESEND_API_KEY
 *   RESEND_FROM_EMAIL
 *   POLL_INTERVAL_MS (default: 30000)
 *   SCREENSHOT_ENABLED (default: true)
 */

import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS ?? '30000', 10)

// デバッグ: 環境変数の確認
console.log('環境変数チェック:')
console.log(`  NEXT_PUBLIC_SUPABASE_URL: ${SUPABASE_URL ? SUPABASE_URL.substring(0, 30) + '...' : '未設定'}`)
console.log(`  SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_KEY ? '設定済み' : '未設定'}`)
console.log(`  RESEND_API_KEY: ${process.env.RESEND_API_KEY ? '設定済み' : '未設定'}`)
console.log(`  RESEND_FROM_EMAIL: ${process.env.RESEND_FROM_EMAIL || '未設定'}`)

if (!SUPABASE_URL) {
  console.error('FATAL: NEXT_PUBLIC_SUPABASE_URL または SUPABASE_URL が設定されていません')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

interface QueueItem {
  id: string
  user_id: string
  lead_id: string
  message_content: string
  send_method: 'email' | 'form'
  form_url: string | null
  lead: {
    company_name: string
    contact_name: string | null
    email: string | null
    website_url: string | null
    company_url: string | null
  }
}

// ─── メール送信 ──────────────────────────

async function sendEmail(item: QueueItem): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@yourdomain.com'

  if (!apiKey || apiKey === 'your-resend-api-key-here') {
    console.log(`  [デモ] メール送信シミュレーション → ${item.lead.email}`)
    return { success: true }
  }

  if (!item.lead.email) {
    return { success: false, error: 'メールアドレスが未設定です' }
  }

  const resend = new Resend(apiKey)
  const subject = `${item.lead.company_name}様へのご提案`

  const { error } = await resend.emails.send({
    from: fromEmail,
    to: [item.lead.email],
    subject,
    text: item.message_content,
  })

  if (error) {
    return { success: false, error: `Resendエラー: ${error.message}` }
  }

  return { success: true }
}

// ─── フォーム送信（Playwrightインポート） ──

async function sendForm(item: QueueItem): Promise<{ success: boolean; error?: string }> {
  // Playwright は動的インポート（Railway で必要な場合のみ）
  try {
    const { chromium } = await import('playwright')

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      locale: 'ja-JP',
    })

    // form-submitter.ts のロジックを再利用（モジュール化は将来対応）
    const page = await context.newPage()

    try {
      const baseUrl = item.lead.company_url || item.lead.website_url
      if (!baseUrl) {
        return { success: false, error: '企業HP URLが未設定です' }
      }

      // 問い合わせページ探索
      const formUrl = item.form_url || await findContactPage(page, baseUrl)
      if (!formUrl) {
        // form_not_found ステータスに更新
        await supabase
          .from('send_queue')
          .update({
            status: 'form_not_found',
            error_message: '問い合わせフォームが見つかりませんでした。手動での対応が必要です。',
          })
          .eq('id', item.id)
        return { success: false, error: 'form_not_found' }
      }

      // フォームページにアクセス
      await page.goto(formUrl, { waitUntil: 'domcontentloaded', timeout: 15000 })
      await delay(1500)

      // 弊社情報を取得
      const { data: settings } = await supabase
        .from('user_settings')
        .select('company_name, representative, company_email, company_phone')
        .eq('user_id', item.user_id)
        .single()

      const senderInfo = {
        company_name: settings?.company_name || '株式会社CONOCOLA',
        representative: settings?.representative || '河野大地',
        email: settings?.company_email || 'conocola2020@gmail.com',
        phone: settings?.company_phone || '052-228-4945',
      }

      // フィールド入力（詳細ログ付き）
      console.log(`  フォームURL: ${formUrl}`)
      const filledCompany = await tryFillField(page, 'company', senderInfo.company_name)
      console.log(`  会社名入力: ${filledCompany ? '✓' : '✗'}`)
      const filledName = await tryFillField(page, 'name', senderInfo.representative)
      console.log(`  名前入力: ${filledName ? '✓' : '✗'}`)
      const filledEmail = await tryFillField(page, 'email', senderInfo.email)
      console.log(`  メール入力: ${filledEmail ? '✓' : '✗'}`)
      const filledPhone = await tryFillField(page, 'phone', senderInfo.phone)
      console.log(`  電話入力: ${filledPhone ? '✓' : '✗'}`)
      const filledBody = await tryFillField(page, 'body', item.message_content)
      console.log(`  本文入力: ${filledBody ? '✓' : '✗'}`)
      await delay(500)

      if (!filledBody && !filledEmail) {
        const pageTitle = await page.title()
        const pageUrl = page.url()
        console.log(`  ⚠️ 主要フィールドが入力できません (title: ${pageTitle}, url: ${pageUrl})`)
        return { success: false, error: `フォーム入力失敗: メールも本文も入力できませんでした (${pageUrl})` }
      }

      // 送信
      const submitted = await clickSubmitButton(page)
      console.log(`  送信ボタンクリック: ${submitted ? '✓' : '✗'}`)
      if (!submitted) {
        return { success: false, error: '送信ボタンが見つかりませんでした' }
      }

      await delay(3000)

      // 確認画面対応
      const pageAfterSubmit = page.url()
      const titleAfterSubmit = await page.title()
      console.log(`  送信後URL: ${pageAfterSubmit}`)
      console.log(`  送信後タイトル: ${titleAfterSubmit}`)
      await handleConfirmPage(page)
      await delay(2000)

      const finalUrl = page.url()
      const finalTitle = await page.title()
      console.log(`  最終URL: ${finalUrl}`)
      console.log(`  最終タイトル: ${finalTitle}`)

      // スクリーンショット保存
      try {
        const buffer = await page.screenshot({ fullPage: false })
        const filename = `form-submissions/${item.id}_${Date.now()}.png`
        await supabase.storage
          .from('screenshots')
          .upload(filename, buffer, { contentType: 'image/png' })

        const { data: urlData } = supabase.storage
          .from('screenshots')
          .getPublicUrl(filename)

        await supabase
          .from('send_queue')
          .update({ form_url: formUrl, screenshot_url: urlData.publicUrl })
          .eq('id', item.id)
      } catch {
        // スクショ失敗は非致命的
        await supabase
          .from('send_queue')
          .update({ form_url: formUrl })
          .eq('id', item.id)
      }

      return { success: true }
    } finally {
      await page.close()
      await context.close()
      await browser.close()
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: `Playwrightエラー: ${msg}` }
  }
}

// ─── ヘルパー関数 ─────────────────────────

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const CONTACT_PATHS = ['/contact', '/contact/', '/inquiry', '/inquiry/', '/お問い合わせ', '/contact-us', '/form', '/toiawase', '/otoiawase']

async function findContactPage(page: import('playwright').Page, baseUrl: string): Promise<string | null> {
  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await delay(1000)
  } catch {
    return null
  }

  const contactLink = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href]'))
    const keywords = ['問い合わせ', 'お問い合わせ', 'contact', 'inquiry', 'toiawase']
    for (const link of links) {
      const href = (link as HTMLAnchorElement).href
      const text = link.textContent?.trim() ?? ''
      for (const kw of keywords) {
        if (href.toLowerCase().includes(kw) || text.toLowerCase().includes(kw)) {
          return href
        }
      }
    }
    return null
  })

  if (contactLink) return contactLink

  const origin = new URL(baseUrl).origin
  for (const path of CONTACT_PATHS) {
    const url = `${origin}${path}`
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 })
      if (response && response.status() < 400) {
        const hasForm = await page.evaluate(() =>
          document.querySelectorAll('form').length > 0 || document.querySelectorAll('textarea').length > 0
        )
        if (hasForm) return url
      }
    } catch { /* ignore */ }
  }

  return null
}

const FIELD_SELECTORS: Record<string, string[]> = {
  company: ['input[name*="company" i]', 'input[name*="会社" i]', 'input[placeholder*="会社" i]'],
  name: ['input[name*="name" i]:not([name*="company" i]):not([name*="mail" i]):not([type="email"])', 'input[name*="氏名" i]', 'input[name*="名前" i]', 'input[placeholder*="名前" i]'],
  email: ['input[type="email"]', 'input[name*="mail" i]', 'input[name*="email" i]', 'input[placeholder*="メール" i]'],
  phone: ['input[type="tel"]', 'input[name*="phone" i]', 'input[name*="tel" i]', 'input[name*="電話" i]'],
  body: ['textarea[name*="body" i]', 'textarea[name*="message" i]', 'textarea[name*="content" i]', 'textarea[name*="内容" i]', 'textarea'],
}

async function tryFillField(page: import('playwright').Page, fieldType: string, value: string): Promise<boolean> {
  if (!value) return false
  const selectors = FIELD_SELECTORS[fieldType] ?? []
  for (const sel of selectors) {
    try {
      const el = await page.$(sel)
      if (el && await el.isVisible()) {
        await el.scrollIntoViewIfNeeded()
        await el.click()
        await delay(100)
        await el.fill(value)
        return true
      }
    } catch { /* continue */ }
  }
  return false
}

async function clickSubmitButton(page: import('playwright').Page): Promise<boolean> {
  const selectors = [
    'button[type="submit"]', 'input[type="submit"]',
    'button:has-text("送信")', 'button:has-text("確認")',
    'input[value*="送信"]', 'input[value*="確認"]',
  ]
  for (const sel of selectors) {
    try {
      const el = await page.$(sel)
      if (el && await el.isVisible()) {
        await el.scrollIntoViewIfNeeded()
        await delay(300)
        await el.click()
        return true
      }
    } catch { /* continue */ }
  }
  return false
}

async function handleConfirmPage(page: import('playwright').Page): Promise<void> {
  await delay(2000)
  const selectors = ['button:has-text("送信")', 'input[type="submit"]', 'input[value*="送信"]']
  for (const sel of selectors) {
    try {
      const el = await page.$(sel)
      if (el && await el.isVisible()) {
        await el.scrollIntoViewIfNeeded()
        await delay(300)
        await el.click()
        return
      }
    } catch { /* continue */ }
  }
}

// ─── メインループ ─────────────────────────

async function pollAndProcess() {
  console.log('🚀 送信ワーカー起動')
  console.log(`  Supabase: ${SUPABASE_URL}`)
  console.log(`  ポーリング間隔: ${POLL_INTERVAL / 1000}秒\n`)

  while (true) {
    try {
      // 確認待ちのアイテムを取得
      const { data: items, error } = await supabase
        .from('send_queue')
        .select(`
          id, user_id, lead_id, message_content, send_method, form_url,
          lead:lead_id (company_name, contact_name, email, website_url, company_url)
        `)
        .eq('status', '確認待ち')
        .order('created_at', { ascending: true })
        .limit(10)

      if (error) {
        console.error('キュー取得エラー:', error.message)
        await delay(POLL_INTERVAL)
        continue
      }

      if (!items || items.length === 0) {
        await delay(POLL_INTERVAL)
        continue
      }

      console.log(`📋 ${items.length}件の送信を処理`)

      for (const item of items as unknown as QueueItem[]) {
        console.log(`\n📧 ${item.lead.company_name} [${item.send_method}]`)

        let result: { success: boolean; error?: string }

        if (item.send_method === 'email') {
          result = await sendEmail(item)
        } else {
          result = await sendForm(item)
        }

        if (result.success) {
          await supabase
            .from('send_queue')
            .update({
              status: '送信済み',
              sent_at: new Date().toISOString(),
            })
            .eq('id', item.id)

          await supabase
            .from('leads')
            .update({ status: '送信済み' })
            .eq('id', item.lead_id)

          console.log(`  ✅ 送信成功`)
        } else if (result.error !== 'form_not_found') {
          await supabase
            .from('send_queue')
            .update({
              status: '失敗',
              error_message: result.error ?? '不明なエラー',
            })
            .eq('id', item.id)

          console.log(`  ❌ 失敗: ${result.error}`)
        }

        // アイテム間のインターバル
        await delay(3000)
      }
    } catch (err) {
      console.error('ワーカーエラー:', err)
    }

    await delay(POLL_INTERVAL)
  }
}

pollAndProcess().catch(err => {
  console.error('致命的エラー:', err)
  process.exit(1)
})
