/**
 * 送信ワーカー (Railway用) - Claude Vision AI対応版
 *
 * send_queue の status='確認待ち' アイテムを定期的にポーリングし、
 * send_method に応じて Resend (email) または Playwright+Claude Vision (form) で送信する。
 *
 * 環境変数:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ANTHROPIC_API_KEY
 *   RESEND_API_KEY
 *   RESEND_FROM_EMAIL
 *   POLL_INTERVAL_MS (default: 30000)
 */

import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import Anthropic from '@anthropic-ai/sdk'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS ?? '30000', 10)
const MAX_NAVIGATE_DEPTH = 3 // お問い合わせページ探索の最大遷移回数

console.log('環境変数チェック:')
console.log(`  NEXT_PUBLIC_SUPABASE_URL: ${SUPABASE_URL ? SUPABASE_URL.substring(0, 30) + '...' : '未設定'}`)
console.log(`  SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_KEY ? '設定済み' : '未設定'}`)
const rawKey = process.env.ANTHROPIC_API_KEY ?? ''
console.log(`  ANTHROPIC_API_KEY: ${rawKey ? `設定済み (先頭20文字: ${rawKey.substring(0, 20)}, 長さ: ${rawKey.length})` : '未設定'}`)
console.log(`  RESEND_API_KEY: ${process.env.RESEND_API_KEY ? '設定済み' : '未設定'}`)
console.log(`  RESEND_FROM_EMAIL: ${process.env.RESEND_FROM_EMAIL || '未設定'}`)

if (!SUPABASE_URL) {
  console.error('FATAL: NEXT_PUBLIC_SUPABASE_URL または SUPABASE_URL が設定されていません')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
// ANTHROPIC_API_KEY は SDK が process.env から自動読み込み
const anthropic = new Anthropic()

// ─── 型定義 ──────────────────────────────

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

interface SenderInfo {
  company_name: string
  representative: string
  email: string
  phone: string
}

// Claudeが返すフォーム分析結果
interface FormAnalysis {
  isContactForm: boolean
  contactPageUrl?: string       // isContactForm=false のとき、遷移先URL候補
  contactPageLinkText?: string  // isContactForm=false のとき、リンクテキスト
  isCookieBanner: boolean       // クッキーバナーが前面に表示されているか
  cookieBannerAcceptText?: string // 「許可」ボタンのテキスト
  selectors?: {
    companyName?: string
    name?: string
    furigana?: string
    email?: string
    emailConfirm?: string
    phone?: string
    body?: string
    category?: string
    submitButton?: string
    checkboxes?: string[]
  }
  notes?: string
}

// ─── ユーティリティ ───────────────────────

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── クッキーバナー自動処理 ───────────────

async function handleCookieBanner(page: import('playwright').Page): Promise<void> {
  try {
    const clicked = await page.evaluate(() => {
      const ACCEPT_TEXTS = ['すべて許可', '全て許可', 'すべてのCookieを許可', '同意する', '同意', 'Accept All', 'Accept', 'allow all', 'OK', 'I agree', '許可', '承諾']
      const REJECT_TEXTS = ['拒否', '必要なCookieのみ', '拒否する', 'Reject', 'Decline']

      const allButtons = Array.from(document.querySelectorAll('button, a, input[type="button"]')) as HTMLElement[]
      // 同意系を優先してクリック
      for (const text of ACCEPT_TEXTS) {
        const el = allButtons.find(b => {
          const t = (b.textContent || (b as HTMLInputElement).value || '').trim()
          return t.includes(text) && b.getBoundingClientRect().height > 0
        })
        if (el) { el.click(); return `accepted: ${text}` }
      }
      // 拒否も試みる（バナーを消すため）
      for (const text of REJECT_TEXTS) {
        const el = allButtons.find(b => {
          const t = (b.textContent || (b as HTMLInputElement).value || '').trim()
          return t.includes(text) && b.getBoundingClientRect().height > 0
        })
        if (el) { el.click(); return `rejected: ${text}` }
      }
      return null
    })
    if (clicked) {
      console.log(`  🍪 クッキーバナー処理: ${clicked}`)
      await delay(800)
    }
  } catch { /* ignore */ }
}

// ─── Claude Vision によるフォーム分析 ─────

async function analyzePageWithClaude(screenshotBase64: string, currentUrl: string): Promise<FormAnalysis> {
  const prompt = `あなたはWebフォーム自動化の専門家です。このスクリーンショットを分析してください。

現在のURL: ${currentUrl}

以下をJSON形式で回答してください（余計なテキストなし、JSONのみ）:

{
  "isContactForm": true/false,  // お問い合わせ・問い合わせフォームのページか
  "isCookieBanner": true/false, // クッキー同意バナーが前面に表示されているか
  "cookieBannerAcceptText": "ボタンのテキスト",  // クッキーバナーの許可ボタンテキスト（あれば）
  "contactPageUrl": "URL",       // isContactForm=falseのとき、お問い合わせページのURL（ページ内リンクから）
  "contactPageLinkText": "テキスト",  // そのリンクのテキスト
  "selectors": {                 // isContactForm=trueのとき
    "companyName": "CSSセレクタ",  // 会社名・店舗名フィールド（ない場合はnull）
    "name": "CSSセレクタ",         // 名前・担当者名フィールド
    "furigana": "CSSセレクタ",     // フリガナフィールド（ない場合はnull）
    "email": "CSSセレクタ",        // メールアドレスフィールド
    "emailConfirm": "CSSセレクタ", // メールアドレス確認フィールド（ない場合はnull）
    "phone": "CSSセレクタ",        // 電話番号フィールド（ない場合はnull）
    "body": "CSSセレクタ",         // お問い合わせ内容・本文フィールド
    "category": "CSSセレクタ",     // お問い合わせ種別セレクト（ない場合はnull）
    "submitButton": "CSSセレクタ", // 送信・確認ボタン
    "checkboxes": ["CSSセレクタ"]  // 個人情報同意チェックボックス（ない場合は[]）
  },
  "notes": "補足事項"
}

セレクタの優先順位（重要）:
1. name属性: input[name="xxx"] または textarea[name="xxx"]
2. id属性: #xxx または input[id="xxx"]
3. class属性（ユニークなもの）: .xxx
- スクリーンショットに見えるフォームフィールドのHTML属性（name/id）を正確に読み取ること
- 複数の候補がある場合は最もユニークなセレクタを選ぶ
- セレクタが存在しない場合は必ずnullを返す（空文字列は不可）

重要な判断基準:
- ホテルの宿泊予約フォーム・レストラン予約フォームはisContactForm=false
- 問い合わせ・お問い合わせ専用ページのみisContactForm=true
- emailフィールドとbodyフィールドは必ず特定すること（最重要）`

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/png', data: screenshotBase64 }
        },
        { type: 'text', text: prompt }
      ]
    }]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  // JSONブロックを抽出
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error(`Claude応答のJSON解析失敗: ${text.substring(0, 200)}`)
  }
  return JSON.parse(jsonMatch[0]) as FormAnalysis
}

// ─── フォーム入力（AI指示セレクタ使用）──

async function fillFormWithSelectors(
  page: import('playwright').Page,
  selectors: NonNullable<FormAnalysis['selectors']>,
  sender: SenderInfo,
  messageContent: string
): Promise<{ filled: string[]; skipped: string[] }> {
  const filled: string[] = []
  const skipped: string[] = []

  const tryFill = async (selectorKey: string, selector: string | null | undefined, value: string) => {
    if (!selector || !value) { skipped.push(selectorKey); return }
    try {
      const el = await page.$(selector)
      if (!el || !(await el.isVisible())) { skipped.push(selectorKey); return }
      await el.scrollIntoViewIfNeeded()

      const tagName = await el.evaluate(e => e.tagName.toLowerCase())
      const inputType = await el.evaluate(e => (e as HTMLInputElement).type?.toLowerCase() ?? '')

      if (tagName === 'select') {
        // セレクトボックス: 最初の有効なオプションを選ぶ
        await el.evaluate(e => {
          const sel = e as HTMLSelectElement
          const opts = Array.from(sel.options)
          const first = opts.find(o => o.value && o.value !== '')
          if (first) { sel.value = first.value; sel.dispatchEvent(new Event('change', { bubbles: true })) }
        })
      } else if (inputType === 'radio') {
        await el.click()
      } else {
        await el.click()
        await delay(100)
        await el.fill(value)
        // 入力後に値が実際に入ったか確認（ログのみ、強制書き込みはしない）
        const actualValue = await el.evaluate(e => (e as HTMLInputElement).value ?? '')
        if (!actualValue) {
          console.log(`  ⚠️ ${selectorKey} 入力後の値が空 (${selector}): セレクタを見直してください`)
        }
      }
      filled.push(selectorKey)
    } catch (e) {
      console.log(`  ⚠️ ${selectorKey} 入力失敗 (${selector}): ${e instanceof Error ? e.message : e}`)
      skipped.push(selectorKey)
    }
  }

  await tryFill('companyName', selectors.companyName, sender.company_name)
  await tryFill('name', selectors.name, sender.representative)
  await tryFill('furigana', selectors.furigana, 'コウノダイチ')
  await tryFill('email', selectors.email, sender.email)
  await tryFill('emailConfirm', selectors.emailConfirm, sender.email)
  await tryFill('phone', selectors.phone, '000-0000-0000')
  await tryFill('body', selectors.body, messageContent)

  // カテゴリ選択
  if (selectors.category) {
    await tryFill('category', selectors.category, '')
  }

  // チェックボックス
  if (selectors.checkboxes && selectors.checkboxes.length > 0) {
    for (const cbSel of selectors.checkboxes) {
      try {
        const cbs = await page.$$(cbSel)
        for (const cb of cbs) {
          if (await cb.isVisible()) {
            const checked = await cb.evaluate(e => (e as HTMLInputElement).checked)
            if (!checked) await cb.click()
          }
        }
        filled.push('checkbox')
      } catch { skipped.push('checkbox') }
    }
  }

  return { filled, skipped }
}

// ─── サンクスページ待機（ポーリング）────────────

async function waitForThankYouContent(page: import('playwright').Page): Promise<boolean> {
  const thankYouPatterns = [
    'ありがとうございます', 'ありがとうございました', 'ありがとう',
    '送信完了', '送信しました', '送信いたしました',
    '受け付けました', '受付完了', 'お問い合わせを受け付け', '承りました',
    'お問い合わせを承り', 'お問い合わせいただき',
    '確認のメールを', 'メールをお送り',
    'thank you', 'thanks', 'successfully', 'submitted', 'complete',
  ]

  const maxWaitMs = 10000
  const pollIntervalMs = 500
  let elapsed = 0

  while (elapsed < maxWaitMs) {
    try {
      const pageText = await page.evaluate(() =>
        (document.body.innerText || '').substring(0, 2000).toLowerCase()
      )
      for (const pattern of thankYouPatterns) {
        if (pageText.includes(pattern.toLowerCase())) {
          console.log(`  ✅ サンクスページ検出 ("${pattern}") - ${elapsed}ms`)
          await delay(1000) // アニメーション描画を待つ
          return true
        }
      }
    } catch { /* ページ遷移中は無視 */ }
    await delay(pollIntervalMs)
    elapsed += pollIntervalMs
  }

  console.log('  ⚠️ サンクスページ未検出（10秒タイムアウト）')
  return false
}

// ─── バリデーションエラー検出 ────────────────

async function detectValidationErrors(page: import('playwright').Page): Promise<string | null> {
  const errors = await page.evaluate(() => {
    const messages: string[] = []

    // CSS classベースのエラー検出
    const errorSelectors = [
      '.error:not([style*="display: none"])',
      '.err:not([style*="display: none"])',
      '.validation-error',
      '.form-error',
      '.alert-danger',
      '.alert-error',
      '.invalid-feedback',
      '[class*="error"]:not([style*="display: none"])',
      '[class*="invalid"]:not([style*="display: none"])',
      '.mw_wp_form_error',
    ]
    for (const sel of errorSelectors) {
      try {
        document.querySelectorAll(sel).forEach(el => {
          const text = (el as HTMLElement).innerText?.trim()
          if (text && text.length > 0 && text.length < 200) messages.push(text)
        })
      } catch { /* ignore */ }
    }

    // :invalid 擬似クラスのフィールド検出
    const invalidFields = Array.from(document.querySelectorAll('input:invalid, textarea:invalid, select:invalid')) as HTMLElement[]
    if (invalidFields.length > 0) {
      messages.push(`未入力の必須フィールドあり (${invalidFields.length}件)`)
    }

    return [...new Set(messages)].slice(0, 5)
  })

  if (errors.length > 0) return errors.join(', ')

  // NOTE: テキストキーワード判定は静的ラベル（「入力してください」等）と
  // 誤検知するため使用しない。CSSクラスと:invalidのみで判定する。
  return null
}

// ─── 確認画面の「送信する」ボタンをクリック ──

async function handleConfirmPage(page: import('playwright').Page): Promise<boolean> {
  await delay(2000)

  // まず確認画面かどうかチェック
  const pageText = await page.evaluate(() => document.body.innerText || '')
  const isConfirmPage =
    pageText.includes('確認') || pageText.includes('ご確認') ||
    pageText.includes('confirm') || pageText.includes('Confirm')

  if (!isConfirmPage) return false

  // Claude Visionで確認画面を分析（送信ボタン特定）
  const screenshotBuf = await page.screenshot()
  const screenshot = screenshotBuf.toString('base64')
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: screenshot } },
          { type: 'text', text: '確認画面の「送信する」ボタンのCSSセレクタを1つだけ教えてください。JSONで {"selector": "..."} の形式で返してください。「戻る」「修正する」ボタンは選ばないでください。' }
        ]
      }]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const match = text.match(/\{[^}]+\}/)
    if (match) {
      const { selector } = JSON.parse(match[0]) as { selector: string }
      const el = await page.$(selector)
      if (el && await el.isVisible()) {
        await el.scrollIntoViewIfNeeded()
        await el.click()
        console.log(`  ✅ 確認画面: Claudeが特定したボタン "${selector}" をクリック`)
        await delay(4000)
        return true
      }
    }
  } catch (e) {
    console.log(`  ⚠️ Claude確認画面解析失敗: ${e instanceof Error ? e.message : e}`)
  }

  // フォールバック: テキストマッチ
  const clicked = await page.evaluate(() => {
    const SEND_KW = ['送信する', '送信', 'submit', 'Submit', 'この内容で送信']
    const EXCLUDE_KW = ['確認する', '入力に戻る', '戻る', '修正', 'キャンセル']
    const els = Array.from(document.querySelectorAll('button, input[type="submit"]')) as HTMLElement[]
    for (const el of els) {
      const text = ((el as HTMLButtonElement).textContent || (el as HTMLInputElement).value || '').trim().replace(/\s+/g, '')
      if (!el.getBoundingClientRect().height) continue
      if (EXCLUDE_KW.some(kw => text.includes(kw))) continue
      if (SEND_KW.some(kw => text.includes(kw))) { el.click(); return text }
    }
    return null
  })

  if (clicked) {
    console.log(`  ✅ 確認画面: テキストマッチで "${clicked}" をクリック`)
    await delay(4000)
    return true
  }

  console.log('  ⚠️ 確認画面の送信ボタンが見つかりません')
  return false
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

  if (error) return { success: false, error: `Resendエラー: ${error.message}` }
  return { success: true }
}

// ─── フォーム送信（Claude Vision AI版）──

async function sendForm(item: QueueItem): Promise<{ success: boolean; error?: string; verified?: boolean; reason?: string }> {
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

    const page = await context.newPage()

    try {
      const baseUrl = item.lead.company_url || item.lead.website_url
      if (!baseUrl) {
        return { success: false, error: '企業HP URLが未設定です' }
      }

      // 送信者情報を取得
      const { data: settings } = await supabase
        .from('user_settings')
        .select('company_name, representative, company_email, company_phone')
        .eq('user_id', item.user_id)
        .single()

      const sender: SenderInfo = {
        company_name: settings?.company_name || '株式会社CONOCOLA',
        representative: settings?.representative || '河野大地',
        email: settings?.company_email || 'daichi@conocola.com',
        phone: '',
      }

      // form_url が既知なら直接そこへ、未知なら起点URLから探索
      let currentUrl = item.form_url || baseUrl
      let analysis: FormAnalysis | null = null
      let navigateDepth = 0

      console.log(`  🌐 起点URL: ${currentUrl}`)

      while (navigateDepth < MAX_NAVIGATE_DEPTH) {
        // ページに移動
        try {
          await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 20000 })
        } catch (e) {
          return { success: false, error: `ページ読み込み失敗: ${currentUrl}` }
        }
        await delay(1500)

        // クッキーバナーを事前処理
        await handleCookieBanner(page)
        await delay(500)

        // スクリーンショットを撮ってClaudeに分析させる
        // ※ Claude APIの5MB制限のためfullPage: false（ビューポートのみ）
        console.log(`  📸 Claude Vision分析中... (depth=${navigateDepth})`)
        const screenshotBuf = await page.screenshot({ fullPage: false })
        const screenshot = screenshotBuf.toString('base64')
        analysis = await analyzePageWithClaude(screenshot, currentUrl)

        console.log(`  🤖 分析結果: isContactForm=${analysis.isContactForm}, isCookieBanner=${analysis.isCookieBanner}`)
        if (analysis.notes) console.log(`  📝 メモ: ${analysis.notes}`)

        // クッキーバナーが残っていれば再処理
        if (analysis.isCookieBanner && analysis.cookieBannerAcceptText) {
          console.log(`  🍪 クッキーバナー再処理: "${analysis.cookieBannerAcceptText}"`)
          await page.evaluate((text) => {
            const els = Array.from(document.querySelectorAll('button, a')) as HTMLElement[]
            const el = els.find(e => e.textContent?.includes(text) && e.getBoundingClientRect().height > 0)
            if (el) el.click()
          }, analysis.cookieBannerAcceptText)
          await delay(1000)
          // 再スクリーンショット（Claude API用なのでfullPage: false）
          const ss2Buf = await page.screenshot({ fullPage: false })
          analysis = await analyzePageWithClaude(ss2Buf.toString('base64'), currentUrl)
        }

        if (analysis.isContactForm) {
          console.log(`  ✅ お問い合わせフォームを確認`)
          break
        }

        // お問い合わせページではない → リンクを辿る
        if (analysis.contactPageUrl) {
          console.log(`  🔗 お問い合わせページへ遷移: ${analysis.contactPageUrl} ("${analysis.contactPageLinkText}")`)
          // ページ内のリンクをクリックするか、URLに直接移動
          const linked = await page.evaluate((url: string) => {
            const a = Array.from(document.querySelectorAll('a[href]')).find(
              el => (el as HTMLAnchorElement).href === url
            ) as HTMLAnchorElement | undefined
            if (a) { a.click(); return true }
            return false
          }, analysis.contactPageUrl)

          if (!linked) {
            // リンクが見つからなければURLに直接移動
            currentUrl = analysis.contactPageUrl
          } else {
            await delay(2000)
            currentUrl = page.url()
          }
        } else {
          // Claudeもリンクを特定できなかった → DOM内のお問い合わせリンクを探す
          const contactLink = await page.evaluate(() => {
            const kws = ['お問い合わせ', '問い合わせ', 'contact', 'inquiry', 'toiawase']
            const links = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[]
            for (const a of links) {
              const text = a.textContent?.trim() ?? ''
              const href = a.href
              if (kws.some(kw => text.toLowerCase().includes(kw) || href.toLowerCase().includes(kw))) {
                return href
              }
            }
            return null
          })

          if (contactLink) {
            console.log(`  🔗 DOM検索でリンク発見: ${contactLink}`)
            currentUrl = contactLink
          } else {
            // よくある問い合わせページのパスを順番に試す
            const origin = new URL(currentUrl).origin
            const CONTACT_PATHS = [
              '/contact', '/contact/', '/inquiry', '/inquiry/',
              '/toiawase', '/toiawase/', '/otoiawase', '/otoiawase/',
              '/contact-us', '/contactus', '/form', '/form/',
              '/mail', '/mail/', '/support', '/ask',
              '/お問い合わせ', '/問い合わせ',
            ]
            let foundByPath = false
            for (const path of CONTACT_PATHS) {
              const tryUrl = origin + path
              try {
                const res = await page.goto(tryUrl, { waitUntil: 'domcontentloaded', timeout: 8000 })
                if (res && res.ok()) {
                  const hasForm = await page.evaluate(() =>
                    !!(document.querySelector('form') || document.querySelector('textarea') || document.querySelector('input[type="email"]'))
                  )
                  if (hasForm) {
                    console.log(`  🔗 共通パスでフォーム発見: ${tryUrl}`)
                    currentUrl = tryUrl
                    foundByPath = true
                    break
                  }
                }
              } catch { /* 次のパスへ */ }
            }

            if (!foundByPath) {
              await supabase.from('send_queue').update({
                status: 'form_not_found',
                error_message: `お問い合わせフォームが見つかりませんでした (${currentUrl})。手動での対応が必要です。`,
              }).eq('id', item.id)
              return { success: false, error: 'form_not_found' }
            }
          }
        }

        navigateDepth++
      }

      if (!analysis?.isContactForm) {
        await supabase.from('send_queue').update({
          status: 'form_not_found',
          error_message: `${MAX_NAVIGATE_DEPTH}回遷移してもお問い合わせフォームが見つかりませんでした。手動での対応が必要です。`,
        }).eq('id', item.id)
        return { success: false, error: 'form_not_found' }
      }

      const formUrl = page.url()

      // フォームフィールドに入力
      if (!analysis.selectors) {
        return { success: false, error: 'フォームフィールドのセレクタが特定できませんでした' }
      }

      console.log(`  ✏️ フォーム入力開始...`)
      const { filled, skipped } = await fillFormWithSelectors(page, analysis.selectors, sender, item.message_content)
      console.log(`  ✏️ 入力済み: [${filled.join(', ')}]  スキップ: [${skipped.join(', ')}]`)

      // メールと本文が入力できていないなら失敗
      if (!filled.includes('email') && !filled.includes('body')) {
        const pageUrl = page.url()
        return { success: false, error: `フォーム入力失敗: メールも本文も入力できませんでした (${pageUrl})` }
      }

      await delay(500)

      // 送信ボタンをクリック
      const submitSelector = analysis.selectors.submitButton
      let submitted = false

      if (submitSelector) {
        try {
          // waitForSelectorで表示されるまで最大3秒待つ
          const el = await page.waitForSelector(submitSelector, { state: 'visible', timeout: 3000 }).catch(() => null)
          if (el) {
            await el.scrollIntoViewIfNeeded()
            await delay(300)
            await el.click()
            submitted = true
            console.log(`  🚀 送信ボタンクリック (Claude指定: ${submitSelector})`)
          }
        } catch { /* フォールバックへ */ }
      }

      if (!submitted) {
        // フォールバック1: type="submit" を優先
        const submitBtns = [
          'button[type="submit"]',
          'input[type="submit"]',
        ]
        for (const sel of submitBtns) {
          const el = await page.$(sel)
          if (el && await el.isVisible()) {
            await el.scrollIntoViewIfNeeded()
            await el.click()
            submitted = true
            console.log(`  🚀 送信ボタンクリック (type=submit: ${sel})`)
            break
          }
        }
      }

      if (!submitted) {
        // フォールバック2: テキストマッチ
        submitted = await page.evaluate(() => {
          const kws = ['確認する', '送信する', '送信', 'submit', 'Submit', 'この内容で送信', '上記内容で送信']
          const excludeKws = ['戻る', 'キャンセル', 'リセット', 'reset', 'cancel']
          const els = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]')) as HTMLElement[]
          for (const el of els) {
            const text = ((el as HTMLButtonElement).textContent || (el as HTMLInputElement).value || '').trim().replace(/\s+/g, '')
            if (!el.getBoundingClientRect().height) continue
            if (excludeKws.some(kw => text.includes(kw))) continue
            if (kws.some(kw => text.includes(kw))) { el.click(); return true }
          }
          return false
        })
        if (submitted) console.log('  🚀 送信ボタンクリック (テキストマッチ)')
      }

      if (!submitted) {
        return { success: false, error: '送信ボタンが見つかりませんでした' }
      }

      // ページ遷移またはDOM更新を待つ（最大5秒）
      await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {})

      // 送信直後のバリデーションエラーチェック
      await delay(500)
      const validationError = await detectValidationErrors(page)
      if (validationError) {
        console.log(`  ❌ バリデーションエラー検出: ${validationError}`)
        // エラー時のスクリーンショット保存
        try {
          const errBuf = await page.screenshot({ fullPage: true })
          const errFilename = `form-submissions/${item.id}_error_${Date.now()}.png`
          await supabase.storage.from('screenshots').upload(errFilename, errBuf, { contentType: 'image/png' })
          const { data: errUrlData } = supabase.storage.from('screenshots').getPublicUrl(errFilename)
          await supabase.from('send_queue').update({ screenshot_url: errUrlData.publicUrl }).eq('id', item.id)
        } catch { /* ignore */ }
        return { success: false, error: `バリデーションエラー: ${validationError}` }
      }

      // 確認画面への対応
      await delay(500)
      await handleConfirmPage(page)
      await delay(2000)

      // 送信完了判定: まずポーリングでサンクスページを待つ
      const foundThankYou = await waitForThankYouContent(page)
      const finalUrl = page.url()
      const urlChanged = finalUrl !== formUrl

      // ページ全体のテキストを取得して最終判定
      const completionCheck = await page.evaluate(() => {
        const text = document.body.innerText || ''
        const successKws = [
          'ありがとうございます', 'ありがとうございました', 'ありがとう',
          '送信完了', '送信しました', '送信いたしました',
          '受付けました', '受け付けました', '受付完了', 'お問い合わせを受け付け',
          '完了しました', 'お問い合わせを承り', '承りました',
          'お問い合わせいただき', '確認のメールを', 'メールをお送り',
          'thank you', 'thanks', 'submitted', 'success', 'complete',
        ]
        const errorKws = ['エラーが発生', '入力してください', '必須項目', '正しく入力', '形式が正しくありません']
        return {
          foundSuccess: successKws.filter(kw => text.toLowerCase().includes(kw.toLowerCase())),
          foundError: errorKws.filter(kw => text.includes(kw)),
          snippet: text.substring(0, 300),
        }
      })

      const hasSuccessText = foundThankYou || completionCheck.foundSuccess.length > 0
      const hasErrorText = completionCheck.foundError.length > 0

      console.log(`  📊 完了テキスト: ${hasSuccessText ? completionCheck.foundSuccess.join(', ') || 'ポーリング検出' : 'なし'}`)
      console.log(`  📊 エラーテキスト: ${hasErrorText ? completionCheck.foundError.join(', ') : 'なし'}`)
      console.log(`  📊 URL変化: ${urlChanged ? `${formUrl} → ${finalUrl}` : 'なし'}`)

      // スクリーンショット保存（fullPageで全体を記録）
      try {
        const buffer = await page.screenshot({ fullPage: true })
        const filename = `form-submissions/${item.id}_${Date.now()}.png`
        await supabase.storage.from('screenshots').upload(filename, buffer, { contentType: 'image/png' })
        const { data: urlData } = supabase.storage.from('screenshots').getPublicUrl(filename)
        await supabase.from('send_queue').update({ form_url: formUrl, screenshot_url: urlData.publicUrl }).eq('id', item.id)
      } catch {
        await supabase.from('send_queue').update({ form_url: formUrl }).eq('id', item.id)
      }

      // 判定
      if (hasErrorText && !hasSuccessText) {
        return { success: false, error: `エラー検出: ${completionCheck.foundError.join(', ')}` }
      } else if (hasSuccessText) {
        return { success: true, verified: true, reason: `完了テキスト: ${completionCheck.foundSuccess.join(', ')}` }
      } else if (urlChanged) {
        return { success: true, verified: false, reason: 'URLは変化しましたが完了テキストが見つかりません。手動確認が必要です。' }
      } else {
        return { success: false, error: '完了テキストもURL遷移も検出できませんでした' }
      }
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

// ─── メインループ ─────────────────────────

async function pollAndProcess() {
  console.log('🚀 送信ワーカー起動 (Claude Vision AI版)')
  console.log(`  Supabase: ${SUPABASE_URL}`)
  console.log(`  ポーリング間隔: ${POLL_INTERVAL / 1000}秒\n`)

  while (true) {
    try {
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

        let result: { success: boolean; error?: string; verified?: boolean; reason?: string }

        if (item.send_method === 'email') {
          result = await sendEmail(item)
        } else {
          result = await sendForm(item)
        }

        if (result.success) {
          const status = result.verified === false ? '送信未確認' : '送信済み'
          await supabase.from('send_queue').update({
            status,
            sent_at: new Date().toISOString(),
            error_message: result.verified === false ? (result.reason ?? '完了確認なし') : null,
          }).eq('id', item.id)

          if (result.verified !== false) {
            await supabase.from('leads').update({ status: '送信済み' }).eq('id', item.lead_id)
          }

          console.log(`  ${result.verified !== false ? '✅ 送信成功（確認済み）' : '⚠️ 送信未確認（手動確認必要）'}`)
        } else if (result.error !== 'form_not_found') {
          await supabase.from('send_queue').update({
            status: '失敗',
            error_message: result.error ?? '不明なエラー',
          }).eq('id', item.id)

          console.log(`  ❌ 失敗: ${result.error}`)
        }

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
