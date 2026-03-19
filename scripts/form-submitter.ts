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
const MAX_RETRIES = 3 // 最大リトライ回数

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
      'input[name="会社名"]',
      'input[name="会社名または店舗名"]',
      'input[name*="会社名" i]',
      'input[name*="会社" i]',
      'input[name*="企業" i]',
      'input[name*="法人" i]',
      'input[name*="店舗名" i]',
      'input[name*="店舗" i]',
      'input[name*="団体" i]',
      'input[placeholder*="会社" i]',
      'input[placeholder*="企業" i]',
      'input[placeholder*="店舗" i]',
      'input[placeholder*="法人" i]',
      'input[id*="company" i]',
      'input[id*="corp" i]',
    ],
    labelPatterns: ['会社名', '会社', '企業', '法人', '組織', '店舗', '団体', 'company', 'organization'],
  },
  name: {
    selectors: [
      'input[name="お名前"]:not([name*="フリガナ"])',
      'input[name="氏名"]',
      'input[name*="name" i]:not([name*="company" i]):not([name*="mail" i]):not([name*="user" i]):not([name*="kana" i]):not([name*="フリガナ" i]):not([type="email"])',
      'input[name*="氏名" i]:not([name*="フリガナ" i]):not([name*="カナ" i])',
      'input[name*="名前" i]:not([name*="フリガナ" i]):not([name*="カナ" i])',
      'input[name*="担当" i]',
      'input[placeholder*="名前" i]:not([placeholder*="フリガナ" i])',
      'input[placeholder*="氏名" i]:not([placeholder*="フリガナ" i])',
      'input[id*="name" i]:not([id*="company" i]):not([id*="mail" i]):not([id*="kana" i])',
    ],
    labelPatterns: ['お名前', '氏名', '名前', '担当者', 'name', 'your name'],
  },
  email: {
    selectors: [
      'input[type="email"]:not([name*="確認" i]):not([name*="confirm" i]):not([name*="re_" i]):not([name*="再" i])',
      'input[name="メールアドレス"]',
      'input[name*="メール" i]:not([name*="確認" i]):not([name*="再" i])',
      'input[name*="mail" i]:not([name*="confirm" i]):not([name*="確認" i]):not([name*="re_" i])',
      'input[name*="email" i]:not([name*="confirm" i]):not([name*="確認" i])',
      'input[placeholder*="メール" i]:not([placeholder*="確認" i])',
      'input[placeholder*="email" i]:not([placeholder*="確認" i])',
      'input[placeholder*="xxx@" i]',
      'input[id*="email" i]:not([id*="confirm" i])',
      'input[id*="mail" i]:not([id*="confirm" i])',
    ],
    labelPatterns: ['メールアドレス', 'メール', 'email', 'mail', 'e-mail'],
  },
  email_confirm: {
    selectors: [
      'input[name*="メールアドレス(確認" i]',
      'input[name*="メールアドレス（確認" i]',
      'input[name*="メール"][name*="確認" i]',
      'input[name*="mail"][name*="confirm" i]',
      'input[name*="email"][name*="confirm" i]',
      'input[name*="re_mail" i]',
      'input[name*="re_email" i]',
      'input[name*="mail_confirm" i]',
      'input[name*="email_confirm" i]',
      'input[name*="確認用" i][name*="メール" i]',
      'input[placeholder*="確認" i][placeholder*="メール" i]',
    ],
    labelPatterns: ['確認用', 'メール確認', 'メールアドレス(確認', 'メールアドレス（確認', 'confirm', 're-enter'],
  },
  phone: {
    selectors: [
      'input[type="tel"]',
      'input[name="電話番号"]',
      'input[name*="phone" i]',
      'input[name*="tel" i]',
      'input[name*="電話" i]',
      'input[placeholder*="電話" i]',
      'input[placeholder*="phone" i]',
      'input[placeholder*="000" i]',
      'input[id*="phone" i]',
      'input[id*="tel" i]',
    ],
    labelPatterns: ['電話番号', '電話', 'TEL', 'phone', 'tel'],
  },
  body: {
    selectors: [
      'textarea[name*="内容" i]',
      'textarea[name*="body" i]',
      'textarea[name*="message" i]',
      'textarea[name*="content" i]',
      'textarea[name*="inquiry" i]',
      'textarea[name*="本文" i]',
      'textarea[name*="comment" i]',
      'textarea[name*="お問い合わせ" i]',
      'textarea[placeholder*="内容" i]',
      'textarea[placeholder*="お問い合わせ" i]',
      'textarea[placeholder*="ご自由" i]',
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
  retry_count: number
  lead: {
    company_name: string
    contact_name: string | null
    email: string | null
    website_url: string | null
    company_url: string | null
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
        // hidden type はスキップ
        const inputType = await el.getAttribute('type')
        if (inputType === 'hidden') continue

        // まず visible チェック、ダメなら scroll して再チェック
        let isVisible = await el.isVisible()
        if (!isVisible) {
          try {
            await el.scrollIntoViewIfNeeded()
            await delay(200)
            isVisible = await el.isVisible()
          } catch {
            // scrollIntoViewIfNeeded can fail for detached elements
          }
        }

        if (isVisible) {
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

// ─── ラジオボタン自動選択 ────────────────────
async function selectRadioButton(page: Page): Promise<boolean> {
  try {
    // 「その他」を優先的に選択（最も汎用的）
    const otherRadio = await page.evaluate(() => {
      const radios = Array.from(document.querySelectorAll('input[type="radio"]'))
      const labels = Array.from(document.querySelectorAll('label'))

      // 「その他」「other」のラジオボタンを探す
      for (const radio of radios) {
        const id = radio.id
        const name = radio.getAttribute('name') || ''
        const value = radio.getAttribute('value') || ''

        // value で判定
        if (value.includes('その他') || value.toLowerCase().includes('other')) {
          return { selector: `input[type="radio"][name="${name}"][value="${value}"]` }
        }

        // ラベルで判定
        if (id) {
          const label = document.querySelector(`label[for="${id}"]`)
          if (label?.textContent?.includes('その他')) {
            return { selector: `input[type="radio"]#${id}` }
          }
        }

        // 親ラベルで判定
        const parentLabel = radio.closest('label')
        if (parentLabel?.textContent?.includes('その他')) {
          const idx = radios.indexOf(radio)
          return { index: idx }
        }
      }

      // 「その他」がなければ、問い合わせ関連のラジオグループの最後のオプションを選択
      const radioGroups = new Map<string, HTMLInputElement[]>()
      for (const radio of radios) {
        const name = radio.getAttribute('name') || ''
        if (!radioGroups.has(name)) radioGroups.set(name, [])
        radioGroups.get(name)!.push(radio as HTMLInputElement)
      }

      for (const [, group] of radioGroups) {
        // 最後の選択肢を返す（多くの場合「その他」的な汎用オプション）
        const last = group[group.length - 1]
        const name = last.getAttribute('name') || ''
        const value = last.getAttribute('value') || ''
        return { selector: `input[type="radio"][name="${name}"][value="${value}"]` }
      }

      return null
    })

    if (otherRadio) {
      if ('selector' in otherRadio && otherRadio.selector) {
        const el = await page.$(otherRadio.selector)
        if (el) {
          await el.scrollIntoViewIfNeeded()
          await el.click()
          console.log(`    ✓ ラジオボタン: 選択完了`)
          return true
        }
      } else if ('index' in otherRadio) {
        const radios = await page.$$('input[type="radio"]')
        if (radios[otherRadio.index as number]) {
          await radios[otherRadio.index as number].scrollIntoViewIfNeeded()
          await radios[otherRadio.index as number].click()
          console.log(`    ✓ ラジオボタン: インデックスで選択完了`)
          return true
        }
      }
    }
  } catch {
    // ignore
  }
  console.log('    ✗ ラジオボタン: 見つかりませんでした')
  return false
}

// ─── チェックボックス自動選択（同意・プライバシーポリシー等）──
async function checkRequiredCheckboxes(page: Page): Promise<boolean> {
  try {
    const checked = await page.evaluate(() => {
      const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
      let count = 0

      for (const cb of checkboxes) {
        const checkbox = cb as HTMLInputElement
        if (checkbox.checked) continue

        const name = checkbox.getAttribute('name') || ''
        const id = checkbox.id || ''
        const value = checkbox.getAttribute('value') || ''

        // ラベルテキストを取得
        let labelText = ''
        if (id) {
          const label = document.querySelector(`label[for="${id}"]`)
          if (label) labelText = label.textContent || ''
        }
        const parentLabel = checkbox.closest('label')
        if (parentLabel) labelText += parentLabel.textContent || ''

        // 周辺テキストも確認
        const parent = checkbox.closest('div, p, li, td, span')
        if (parent) labelText += parent.textContent || ''

        const fullText = (name + value + labelText).toLowerCase()

        // 同意系チェックボックスを自動チェック
        if (
          fullText.includes('同意') ||
          fullText.includes('agree') ||
          fullText.includes('privacy') ||
          fullText.includes('個人情報') ||
          fullText.includes('プライバシー') ||
          fullText.includes('利用規約') ||
          fullText.includes('terms') ||
          fullText.includes('accept') ||
          fullText.includes('確認')
        ) {
          checkbox.click()
          count++
        }
      }
      return count
    })

    if (checked > 0) {
      console.log(`    ✓ チェックボックス: ${checked}件チェック完了（同意・個人情報等）`)
      return true
    }
  } catch {
    // ignore
  }
  return false
}

// ─── フリガナ自動入力 ────────────────────────
async function fillFurigana(page: Page, name: string): Promise<boolean> {
  const furiganaSelectors = [
    'input[name*="フリガナ" i]',
    'input[name*="ふりがな" i]',
    'input[name*="kana" i]',
    'input[name*="ruby" i]',
    'input[placeholder*="フリガナ" i]',
    'input[placeholder*="ふりがな" i]',
    'input[placeholder*="カタカナ" i]',
  ]

  for (const selector of furiganaSelectors) {
    try {
      const el = await page.$(selector)
      if (el && await el.isVisible()) {
        await el.scrollIntoViewIfNeeded()
        await el.click()
        await delay(100)
        await el.fill(name) // フリガナとして同じ値を入力
        console.log(`    ✓ フリガナ: 入力完了`)
        return true
      }
    } catch {
      // continue
    }
  }
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

// ─── 送信成功判定 ────────────────────────

async function verifySubmissionSuccess(page: Page): Promise<{ success: boolean; message: string }> {
  const pageText = await page.evaluate(() => document.body.innerText.substring(0, 1000).toLowerCase())
  const url = page.url().toLowerCase()

  // 成功パターン
  const successPatterns = [
    'ありがとう', 'ありがとうございます', 'ありがとうございました',
    '送信完了', '送信しました', '受け付けました', '受付完了',
    'thank you', 'thanks', 'successfully', 'submitted',
    '完了しました', '送信いたしました', 'お問い合わせを承りました',
  ]
  const successUrlPatterns = ['thanks', 'thank', 'complete', 'done', 'success', 'finish']

  for (const pattern of successPatterns) {
    if (pageText.includes(pattern)) {
      return { success: true, message: `送信成功（"${pattern}"を検出）` }
    }
  }

  for (const pattern of successUrlPatterns) {
    if (url.includes(pattern)) {
      return { success: true, message: `送信成功（URL: ${url}）` }
    }
  }

  // 失敗パターン（バリデーションエラー）
  const errorPatterns = [
    '必須', '入力してください', '正しく入力', 'エラー', '不正',
    'required', 'invalid', 'error', 'please enter', 'please fill',
    '選択してください', '確認してください', '未入力', '形式が正しくありません',
  ]

  const detectedErrors: string[] = []
  for (const pattern of errorPatterns) {
    if (pageText.includes(pattern)) {
      detectedErrors.push(pattern)
    }
  }

  // エラーメッセージ要素を探す
  const errorElements = await page.evaluate(() => {
    const selectors = [
      '.error', '.err', '.validation-error', '.form-error',
      '.alert-danger', '.alert-error', '.invalid-feedback',
      '[class*="error"]', '[class*="invalid"]', '[class*="warning"]',
      '.mw_wp_form_error', // MW WP Form plugin
    ]
    const errors: string[] = []
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel)
      els.forEach(el => {
        const text = el.textContent?.trim()
        if (text && text.length > 0 && text.length < 200) {
          errors.push(text)
        }
      })
    }
    return errors
  })

  if (detectedErrors.length > 0 || errorElements.length > 0) {
    const allErrors = [...new Set([...detectedErrors, ...errorElements])]
    return {
      success: false,
      message: `バリデーションエラー: ${allErrors.slice(0, 5).join(', ')}`,
    }
  }

  // 判定不能（フォーム送信後のページが明確でない場合）
  // URLが変わっていればおそらく成功
  return { success: false, message: '送信結果を確認できませんでした（完了ページが検出されません）' }
}

// ─── バリデーションエラー検知 ─────────────────

async function detectValidationErrors(page: Page): Promise<string | null> {
  const errors = await page.evaluate(() => {
    const errorMessages: string[] = []

    // CSS class based error detection
    const errorSelectors = [
      '.error:not([style*="display: none"])',
      '.validation-error',
      '.form-error',
      '.invalid-feedback',
      '.alert-danger',
      '[class*="error"]:not(form):not(input):not(select)',
      '.mw_wp_form_error',
    ]

    for (const sel of errorSelectors) {
      try {
        const els = document.querySelectorAll(sel)
        els.forEach(el => {
          const text = el.textContent?.trim()
          if (text && text.length > 0 && text.length < 200) {
            errorMessages.push(text)
          }
        })
      } catch {}
    }

    // input validation state
    const invalidInputs = document.querySelectorAll(':invalid')
    invalidInputs.forEach(input => {
      const name = input.getAttribute('name') || input.getAttribute('placeholder') || '不明'
      errorMessages.push(`${name}: 入力が不正です`)
    })

    return errorMessages
  })

  if (errors.length > 0) {
    return [...new Set(errors)].slice(0, 5).join(' / ')
  }
  return null
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
    const baseUrl = item.lead.company_url || item.lead.website_url
    if (!baseUrl) {
      return { success: false, formUrl: null, screenshotBase64: null, error: '企業HP URLが未設定です' }
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

    // 1. まずラジオボタンを選択（条件付きフィールドが表示される場合がある）
    await selectRadioButton(page)
    await delay(500)

    // 2. テキストフィールドを入力
    await findAndFillField(page, 'name', senderInfo.representative)
    await fillFurigana(page, 'コウノダイチ') // TODO: user_settingsから取得
    await findAndFillField(page, 'phone', senderInfo.phone)
    await findAndFillField(page, 'email', senderInfo.email)
    await findAndFillField(page, 'email_confirm', senderInfo.email)
    const companyFilled = await findAndFillField(page, 'company', senderInfo.company_name)
    await findAndFillField(page, 'subject', `${item.lead.company_name}様へのご提案`)

    // 会社名フィールドが見つからなかった場合、本文の先頭に会社名を追記
    const bodyContent = !companyFilled
      ? `【${senderInfo.company_name} ${senderInfo.representative}】\n\n${item.message_content}`
      : item.message_content
    await findAndFillField(page, 'body', bodyContent)
    await delay(300)

    // 3. 同意チェックボックス
    await checkRequiredCheckboxes(page)
    await delay(500)

    // 送信ボタンをクリック
    const submitted = await findSubmitButton(page)
    if (!submitted) {
      return { success: false, formUrl, screenshotBase64: null, error: '送信ボタンが見つかりませんでした' }
    }

    // ページ遷移を待つ
    await delay(3000)

    // バリデーションエラーチェック（送信ボタン押下直後）
    const validationError = await detectValidationErrors(page)
    if (validationError) {
      console.log(`    ⚠ バリデーションエラー検知: ${validationError}`)
      // スクリーンショットを取得
      if (SCREENSHOT_ENABLED) {
        try {
          const buffer = await page.screenshot({ fullPage: false })
          screenshotBase64 = buffer.toString('base64')
        } catch {}
      }
      return { success: false, formUrl, screenshotBase64, error: `バリデーションエラー: ${validationError}` }
    }

    // 確認画面がある場合の処理
    const confirmResult = await handleConfirmationPage(page)
    if (confirmResult) {
      await delay(3000)
    } else {
      await delay(2000)
    }

    // 送信成功判定
    const verification = await verifySubmissionSuccess(page)
    console.log(`    ${verification.success ? '✓' : '✗'} ${verification.message}`)

    // スクリーンショット保存
    if (SCREENSHOT_ENABLED) {
      try {
        const buffer = await page.screenshot({ fullPage: false })
        screenshotBase64 = buffer.toString('base64')
      } catch {
        console.log('    ⚠ スクリーンショット取得に失敗')
      }
    }

    if (verification.success) {
      markDomainSent(domain)
      console.log(`  ✅ ${item.lead.company_name} へのフォーム送信完了`)
      return { success: true, formUrl, screenshotBase64, error: null }
    } else {
      console.log(`  ⚠ ${item.lead.company_name}: ${verification.message}`)
      return { success: false, formUrl, screenshotBase64, error: verification.message }
    }
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
    email: data?.company_email || 'daichi@conocola.com',
    phone: data?.company_phone || '052-228-4945',
  }
}

// ─── キューからフォーム送信対象を取得 ───────

async function getFormQueueItems(): Promise<QueueItem[]> {
  // 確認待ちのアイテムを取得
  const { data: pendingData, error: pendingError } = await supabase
    .from('send_queue')
    .select(`
      id, user_id, lead_id, message_content, send_method, form_url, retry_count,
      lead:lead_id (company_name, contact_name, email, website_url, company_url, phone)
    `)
    .eq('send_method', 'form')
    .eq('status', '確認待ち')
    .order('created_at', { ascending: true })
    .limit(20)

  if (pendingError) {
    console.error('キュー取得エラー:', pendingError.message)
    return []
  }

  // リトライ対象（失敗 & retry_count < MAX_RETRIES）も取得
  const { data: retryData } = await supabase
    .from('send_queue')
    .select(`
      id, user_id, lead_id, message_content, send_method, form_url, retry_count,
      lead:lead_id (company_name, contact_name, email, website_url, company_url, phone)
    `)
    .eq('send_method', 'form')
    .eq('status', '失敗')
    .lt('retry_count', MAX_RETRIES)
    .order('created_at', { ascending: true })
    .limit(10)

  const allItems = [
    ...((pendingData as unknown as QueueItem[]) ?? []),
    ...((retryData as unknown as QueueItem[]) ?? []),
  ]

  // retry_count が null の場合は 0 にする
  return allItems.map(item => ({ ...item, retry_count: item.retry_count ?? 0 }))
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
      const retryLabel = item.retry_count > 0 ? ` (リトライ ${item.retry_count}/${MAX_RETRIES})` : ''
      console.log(`\n── ${item.lead.company_name}${retryLabel} ──`)

      const senderInfo = await getSenderInfo(item.user_id)
      const result = await submitForm(context, item, senderInfo)

      // スクリーンショットを保存
      let screenshotUrl: string | null = null
      if (result.screenshotBase64) {
        screenshotUrl = await saveScreenshot(result.screenshotBase64, item.id)
      }

      const newRetryCount = (item.retry_count ?? 0) + 1

      // DBを更新
      if (result.success) {
        await supabase
          .from('send_queue')
          .update({
            status: '送信済み',
            sent_at: new Date().toISOString(),
            form_url: result.formUrl,
            screenshot_url: screenshotUrl,
            error_message: null,
            retry_count: newRetryCount,
          })
          .eq('id', item.id)

        // リードのステータスも更新
        await supabase
          .from('leads')
          .update({ status: '送信済み' })
          .eq('id', item.lead_id)

        console.log(`  📊 結果: 送信済み`)
      } else if (result.error === 'form_not_found') {
        // form_not_found はリトライしない
        await supabase
          .from('send_queue')
          .update({
            status: 'form_not_found',
            error_message: '問い合わせフォームが見つかりませんでした。手動での対応が必要です。',
            screenshot_url: screenshotUrl,
            retry_count: newRetryCount,
          })
          .eq('id', item.id)

        console.log(`  📊 結果: フォーム未検出（手動対応必要）`)
      } else {
        // リトライ可能かチェック
        const canRetry = newRetryCount < MAX_RETRIES
        const status = canRetry ? '失敗' : '失敗' // 両方「失敗」だがretry_countで区別
        const errorWithRetry = canRetry
          ? `${result.error}（${newRetryCount}/${MAX_RETRIES}回目、次回自動リトライ）`
          : `${result.error}（${MAX_RETRIES}回リトライ済み、手動対応必要）`

        await supabase
          .from('send_queue')
          .update({
            status,
            error_message: errorWithRetry,
            form_url: result.formUrl,
            screenshot_url: screenshotUrl,
            retry_count: newRetryCount,
          })
          .eq('id', item.id)

        console.log(`  📊 結果: 失敗 - ${errorWithRetry}`)
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
