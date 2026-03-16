/**
 * フォーム自動送信スクリプト (Playwright)
 *
 * 企業HPの問い合わせフォームを自動探索し、フィールドを検出・入力して送信する。
 * Railway上で send_queue の send_method='form' アイテムを処理する。
 */

import { chromium, type Browser, type Page, type BrowserContext } from 'playwright'
import { createClient } from '@supabase/supabase-js'

// ─── 設定 ─────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const MIN_INTERVAL_MS = 5 * 60 * 1000 // 同一ドメインへの最低間隔: 5分
const NAVIGATION_TIMEOUT = 15000
const SCREENSHOT_ENABLED = process.env.SCREENSHOT_ENABLED !== 'false'

// ─── よくある問い合わせページのパス ──────
const CONTACT_PATHS = [
  '/contact',
  '/contact/',
  '/inquiry',
  '/inquiry/',
  '/お問い合わせ',
  '/contact-us',
  '/contactus',
  '/form',
  '/toiawase',
  '/otoiawase',
  '/mail',
  '/support',
  '/ask',
]

// ─── フィールドのセレクタパターン ─────────
const FIELD_PATTERNS = {
  company: {
    selectors: [
      'input[name*="company" i]',
      'input[name*="corp" i]',
      'input[name*="organ" i]',
      'input[name*="会社" i]',
      'input[name*="企業" i]',
      'input[name*="法人" i]',
      'input[placeholder*="会社" i]',
      'input[placeholder*="企業" i]',
      'input[id*="company" i]',
      'input[id*="corp" i]',
    ],
    labelPatterns: ['会社', '企業', '法人', '組織', 'company', 'organization'],
  },
  name: {
    selectors: [
      'input[name*="name" i]:not([name*="company" i]):not([name*="mail" i]):not([name*="user" i]):not([type="email"])',
      'input[name*="氏名" i]',
      'input[name*="名前" i]',
      'input[name*="担当" i]',
      'input[placeholder*="名前" i]',
      'input[placeholder*="氏名" i]',
      'input[id*="name" i]:not([id*="company" i]):not([id*="mail" i])',
    ],
    labelPatterns: ['お名前', '氏名', '名前', '担当者', 'name', 'your name'],
  },
  email: {
    selectors: [
      'input[type="email"]',
      'input[name*="mail" i]',
      'input[name*="email" i]',
      'input[placeholder*="メール" i]',
      'input[placeholder*="email" i]',
      'input[placeholder*="mail" i]',
      'input[id*="email" i]',
      'input[id*="mail" i]',
    ],
    labelPatterns: ['メール', 'email', 'mail', 'e-mail'],
  },
  phone: {
    selectors: [
      'input[type="tel"]',
      'input[name*="phone" i]',
      'input[name*="tel" i]',
      'input[name*="電話" i]',
      'input[placeholder*="電話" i]',
      'input[placeholder*="phone" i]',
      'input[id*="phone" i]',
      'input[id*="tel" i]',
    ],
    labelPatterns: ['電話', 'TEL', 'phone', 'tel'],
  },
  body: {
    selectors: [
      'textarea[name*="body" i]',
      'textarea[name*="message" i]',
      'textarea[name*="content" i]',
      'textarea[name*="inquiry" i]',
      'textarea[name*="内容" i]',
      'textarea[name*="本文" i]',
      'textarea[name*="comment" i]',
      'textarea[placeholder*="内容" i]',
      'textarea[placeholder*="お問い合わせ" i]',
      'textarea',  // fallback: any textarea
    ],
    labelPatterns: ['内容', '本文', 'お問い合わせ', 'メッセージ', 'message', 'inquiry', 'body'],
  },
  subject: {
    selectors: [
      'input[name*="subject" i]',
      'input[name*="件名" i]',
      'input[name*="title" i]',
      'input[placeholder*="件名" i]',
      'input[placeholder*="subject" i]',
      'select[name*="subject" i]',
      'select[name*="種類" i]',
      'select[name*="category" i]',
    ],
    labelPatterns: ['件名', 'subject', 'タイトル', '種類', 'カテゴリ'],
  },
}

// ─── 型定義 ─────────────────────────────
interface QueueItem {
  id: string
  user_id: string
  lead_id: string
  message_content: string
  send_method: string
  form_url: string | null
  lead: {
    company_name: string
    contact_name: string | null
    email: string | null
    website_url: string | null
    phone?: string | null
  }
}

interface FormSubmitResult {
  success: boolean
  formUrl: string | null
  screenshotBase64: string | null
  error: string | null
}

interface SenderInfo {
  company_name: string
  representative: string
  email: string
  phone: string
}

// ─── ドメインレート制限 ───────────────────
const domainLastSent = new Map<string, number>()

function getDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

function canSendToDomain(domain: string): boolean {
  const last = domainLastSent.get(domain)
  if (!last) return true
  return Date.now() - last >= MIN_INTERVAL_MS
}

function markDomainSent(domain: string) {
  domainLastSent.set(domain, Date.now())
}

// ─── ユーティリティ ──────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── 問い合わせページ探索 ──────────────────

async function findContactPage(page: Page, baseUrl: string): Promise<string | null> {
  // 1. まずベースURLにアクセスしてリンクを探す
  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT })
    await delay(1000)
  } catch {
    console.log(`  ⚠ ${baseUrl} へのアクセスに失敗`)
    return null
  }

  // ページ内の問い合わせリンクを探す
  const contactLink = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href]'))
    const keywords = ['問い合わせ', 'お問い合わせ', 'contact', 'inquiry', 'toiawase', 'メール', 'フォーム']
    for (const link of links) {
      const href = (link as HTMLAnchorElement).href
      const text = link.textContent?.trim() ?? ''
      const lowerHref = href.toLowerCase()
      const lowerText = text.toLowerCase()
      for (const kw of keywords) {
        if (lowerHref.includes(kw) || lowerText.includes(kw)) {
          return href
        }
      }
    }
    return null
  })

  if (contactLink) {
    console.log(`  ✓ リンクから問い合わせページ発見: ${contactLink}`)
    return contactLink
  }

  // 2. よくあるパスを試す
  const origin = new URL(baseUrl).origin
  for (const path of CONTACT_PATHS) {
    const url = `${origin}${path}`
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT })
      if (response && response.status() < 400) {
        // フォームがあるか確認
        const hasForm = await page.evaluate(() => {
          return document.querySelectorAll('form').length > 0 ||
            document.querySelectorAll('textarea').length > 0
        })
        if (hasForm) {
          console.log(`  ✓ パス探索で問い合わせページ発見: ${url}`)
          return url
        }
      }
    } catch {
      // ignore
    }
  }

  console.log('  ✗ 問い合わせページが見つかりませんでした')
  return null
}

// ─── フィールド検出・入力 ──────────────────

async function findAndFillField(
  page: Page,
  fieldType: keyof typeof FIELD_PATTERNS,
  value: string
): Promise<boolean> {
  if (!value) return false
  const patterns = FIELD_PATTERNS[fieldType]

  // セレクタベースで探す
  for (const selector of patterns.selectors) {
    try {
      const el = await page.$(selector)
      if (el) {
        const isVisible = await el.isVisible()
        if (isVisible) {
          await el.scrollIntoViewIfNeeded()
          await el.click()
          await delay(100)
          await el.fill(value)
          console.log(`    ✓ ${fieldType}: セレクタ「${selector}」で入力完了`)
          return true
        }
      }
    } catch {
      // continue
    }
  }

  // ラベルベースで探す
  for (const labelText of patterns.labelPatterns) {
    try {
      // label要素からfor属性で紐づくinput/textareaを探す
      const field = await page.evaluate((lt) => {
        const labels = Array.from(document.querySelectorAll('label'))
        for (const label of labels) {
          if (label.textContent?.includes(lt)) {
            const forAttr = label.getAttribute('for')
            if (forAttr) {
              const el = document.getElementById(forAttr)
              if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) {
                return forAttr
              }
            }
            // label内にinput/textareaがある場合
            const inner = label.querySelector('input, textarea, select')
            if (inner) {
              return inner.id || `__inner_${labels.indexOf(label)}`
            }
          }
        }
        return null
      }, labelText)

      if (field) {
        if (field.startsWith('__inner_')) {
          // label内のフィールドに直接入力
          const labelIdx = parseInt(field.replace('__inner_', ''))
          const input = await page.evaluateHandle((idx) => {
            const labels = Array.from(document.querySelectorAll('label'))
            return labels[idx]?.querySelector('input, textarea, select')
          }, labelIdx)
          if (input) {
            const el = input.asElement()
            if (el) {
              await el.scrollIntoViewIfNeeded()
              await el.click()
              await delay(100)
              await el.fill(value)
              console.log(`    ✓ ${fieldType}: ラベル「${labelText}」から入力完了`)
              return true
            }
          }
        } else {
          const el = await page.$(`#${CSS.escape(field)}`)
          if (el) {
            await el.scrollIntoViewIfNeeded()
            await el.click()
            await delay(100)
            await el.fill(value)
            console.log(`    ✓ ${fieldType}: ラベル「${labelText}」(for="${field}") から入力完了`)
            return true
          }
        }
      }
    } catch {
      // continue
    }
  }

  console.log(`    ✗ ${fieldType}: フィールドが見つかりませんでした`)
  return false
}

// ─── 送信ボタン検出 ──────────────────────

async function findSubmitButton(page: Page): Promise<boolean> {
  const submitSelectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button:has-text("送信")',
    'button:has-text("Submit")',
    'button:has-text("確認")',
    'button:has-text("問い合わせ")',
    'a:has-text("送信")',
    'input[value*="送信"]',
    'input[value*="確認"]',
    'input[value*="Submit"]',
  ]

  for (const selector of submitSelectors) {
    try {
      const el = await page.$(selector)
      if (el) {
        const isVisible = await el.isVisible()
        if (isVisible) {
          await el.scrollIntoViewIfNeeded()
          await delay(300)
          await el.click()
          console.log(`    ✓ 送信ボタンクリック: ${selector}`)
          return true
        }
      }
    } catch {
      // continue
    }
  }

  console.log('    ✗ 送信ボタンが見つかりませんでした')
  return false
}

// ─── 確認画面の処理 ──────────────────────

async function handleConfirmationPage(page: Page): Promise<boolean> {
  // 多くの日本のフォームは確認画面 → 送信の2ステップ
  await delay(2000)

  // 確認画面の送信ボタンを探す
  const confirmSelectors = [
    'button:has-text("送信")',
    'button:has-text("Submit")',
    'input[type="submit"]',
    'input[value*="送信"]',
    'button:has-text("この内容で送信")',
    'button:has-text("上記内容で送信")',
  ]

  for (const selector of confirmSelectors) {
    try {
      const el = await page.$(selector)
      if (el) {
        const isVisible = await el.isVisible()
        if (isVisible) {
          await el.scrollIntoViewIfNeeded()
          await delay(300)
          await el.click()
          console.log('    ✓ 確認画面で送信ボタンクリック')
          return true
        }
      }
    } catch {
      // continue
    }
  }

  return false
}

// ─── メイン送信処理 ──────────────────────

async function submitForm(
  context: BrowserContext,
  item: QueueItem,
  senderInfo: SenderInfo
): Promise<FormSubmitResult> {
  const page = await context.newPage()
  let formUrl: string | null = null
  let screenshotBase64: string | null = null

  try {
    const baseUrl = item.lead.website_url
    if (!baseUrl) {
      return { success: false, formUrl: null, screenshotBase64: null, error: 'WebサイトURLが未設定です' }
    }

    console.log(`\n📧 ${item.lead.company_name} (${baseUrl})`)

    // レート制限チェック
    const domain = getDomain(baseUrl)
    if (!canSendToDomain(domain)) {
      return { success: false, formUrl: null, screenshotBase64: null, error: `レート制限: ${domain} への送信間隔が短すぎます（最低${MIN_INTERVAL_MS / 60000}分）` }
    }

    // 問い合わせページを探す
    formUrl = item.form_url || await findContactPage(page, baseUrl)
    if (!formUrl) {
      return { success: false, formUrl: null, screenshotBase64: null, error: 'form_not_found' }
    }

    // 問い合わせページにアクセス
    if (page.url() !== formUrl) {
      await page.goto(formUrl, { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT })
      await delay(1500)
    }

    // フィールドを入力
    console.log('  フィールド入力開始...')
    await findAndFillField(page, 'company', senderInfo.company_name)
    await findAndFillField(page, 'name', senderInfo.representative)
    await findAndFillField(page, 'email', senderInfo.email)
    await findAndFillField(page, 'phone', senderInfo.phone)
    await findAndFillField(page, 'subject', `${item.lead.company_name}様へのご提案`)
    await findAndFillField(page, 'body', item.message_content)
    await delay(500)

    // 送信ボタンをクリック
    const submitted = await findSubmitButton(page)
    if (!submitted) {
      return { success: false, formUrl, screenshotBase64: null, error: '送信ボタンが見つかりませんでした' }
    }

    // ページ遷移を待つ
    await delay(3000)

    // 確認画面がある場合の処理
    await handleConfirmationPage(page)
    await delay(2000)

    // スクリーンショット保存
    if (SCREENSHOT_ENABLED) {
      try {
        const buffer = await page.screenshot({ fullPage: false })
        screenshotBase64 = buffer.toString('base64')
      } catch {
        console.log('    ⚠ スクリーンショット取得に失敗')
      }
    }

    markDomainSent(domain)
    console.log(`  ✅ ${item.lead.company_name} へのフォーム送信完了`)

    return { success: true, formUrl, screenshotBase64, error: null }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error(`  ❌ エラー: ${errorMessage}`)
    return { success: false, formUrl, screenshotBase64: null, error: errorMessage }
  } finally {
    await page.close()
  }
}

// ─── スクリーンショットをSupabase Storageに保存 ──

async function saveScreenshot(
  base64: string,
  queueItemId: string
): Promise<string | null> {
  try {
    const buffer = Buffer.from(base64, 'base64')
    const filename = `form-submissions/${queueItemId}_${Date.now()}.png`

    const { error } = await supabase.storage
      .from('screenshots')
      .upload(filename, buffer, { contentType: 'image/png' })

    if (error) {
      console.log(`  ⚠ スクリーンショット保存失敗: ${error.message}`)
      return null
    }

    const { data: urlData } = supabase.storage
      .from('screenshots')
      .getPublicUrl(filename)

    return urlData.publicUrl
  } catch {
    return null
  }
}

// ─── 弊社情報を取得 ──────────────────────

async function getSenderInfo(userId: string): Promise<SenderInfo> {
  const { data } = await supabase
    .from('user_settings')
    .select('company_name, representative, company_email, company_phone')
    .eq('user_id', userId)
    .single()

  return {
    company_name: data?.company_name || '株式会社CONOCOLA',
    representative: data?.representative || '河野大地',
    email: data?.company_email || 'conocola2020@gmail.com',
    phone: data?.company_phone || '052-228-4945',
  }
}

// ─── キューからフォーム送信対象を取得 ───────

async function getFormQueueItems(): Promise<QueueItem[]> {
  const { data, error } = await supabase
    .from('send_queue')
    .select(`
      id, user_id, lead_id, message_content, send_method, form_url,
      lead:lead_id (company_name, contact_name, email, website_url, phone)
    `)
    .eq('send_method', 'form')
    .eq('status', '確認待ち')
    .order('created_at', { ascending: true })
    .limit(20)

  if (error) {
    console.error('キュー取得エラー:', error.message)
    return []
  }

  return (data as unknown as QueueItem[]) ?? []
}

// ─── メインワーカーループ ─────────────────

async function processQueue() {
  console.log('🚀 フォーム送信ワーカー起動')
  console.log(`  Supabase: ${SUPABASE_URL}`)
  console.log(`  スクリーンショット: ${SCREENSHOT_ENABLED ? '有効' : '無効'}`)
  console.log(`  レート制限: ${MIN_INTERVAL_MS / 60000}分/ドメイン\n`)

  const items = await getFormQueueItems()

  if (items.length === 0) {
    console.log('📭 処理対象のキューアイテムがありません')
    return
  }

  console.log(`📋 ${items.length}件のフォーム送信を処理します\n`)

  let browser: Browser | null = null

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      locale: 'ja-JP',
    })

    for (const item of items) {
      const senderInfo = await getSenderInfo(item.user_id)
      const result = await submitForm(context, item, senderInfo)

      // スクリーンショットを保存
      let screenshotUrl: string | null = null
      if (result.screenshotBase64) {
        screenshotUrl = await saveScreenshot(result.screenshotBase64, item.id)
      }

      // DBを更新
      if (result.success) {
        await supabase
          .from('send_queue')
          .update({
            status: '送信済み',
            sent_at: new Date().toISOString(),
            form_url: result.formUrl,
            screenshot_url: screenshotUrl,
          })
          .eq('id', item.id)

        // リードのステータスも更新
        await supabase
          .from('leads')
          .update({ status: '送信済み' })
          .eq('id', item.lead_id)
      } else if (result.error === 'form_not_found') {
        await supabase
          .from('send_queue')
          .update({
            status: 'form_not_found',
            error_message: '問い合わせフォームが見つかりませんでした。手動での対応が必要です。',
          })
          .eq('id', item.id)
      } else {
        await supabase
          .from('send_queue')
          .update({
            status: '失敗',
            error_message: result.error,
            form_url: result.formUrl,
            screenshot_url: screenshotUrl,
          })
          .eq('id', item.id)
      }

      // 次のアイテムまで待機
      await delay(3000)
    }

    await context.close()
  } finally {
    if (browser) await browser.close()
  }

  console.log('\n✅ フォーム送信ワーカー処理完了')
}

// ─── エントリーポイント ─────────────────

processQueue().catch(err => {
  console.error('致命的エラー:', err)
  process.exit(1)
})
