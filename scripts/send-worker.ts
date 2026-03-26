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
        email: settings?.company_email || 'daichi@conocola.com',
        phone: '', // 電話番号は記載しない
      }

      // フィールド入力（詳細ログ付き）
      console.log(`  フォームURL: ${formUrl}`)

      // デバッグ: フォーム上の全フィールドをダンプ
      const allFields = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input, textarea, select'))
        return inputs.map(el => ({
          tag: el.tagName,
          type: (el as HTMLInputElement).type || '',
          name: (el as HTMLInputElement).name || '',
          id: el.id || '',
          placeholder: (el as HTMLInputElement).placeholder || '',
          visible: el.offsetParent !== null,
        }))
      })
      console.log(`  フォームフィールド一覧: ${JSON.stringify(allFields.filter(f => f.visible))}`)

      // JavaScript evaluateベースの汎用入力関数
      const fillByJS = async (nameContains: string, value: string): Promise<boolean> => {
        return page.evaluate(({ nameContains, value }) => {
          const inputs = Array.from(document.querySelectorAll('input, textarea, select'))
          const el = inputs.find(el => {
            const name = (el as HTMLInputElement).name || ''
            return name.includes(nameContains) && el.offsetParent !== null
          }) as HTMLInputElement | HTMLTextAreaElement | null
          if (!el) return false
          if (el.tagName === 'SELECT') {
            const select = el as unknown as HTMLSelectElement
            const options = Array.from(select.options)
            const match = options.find(o => o.value && o.value !== '')
            if (match) { select.value = match.value; select.dispatchEvent(new Event('change', { bubbles: true })); return true }
            return false
          }
          el.focus()
          el.value = value
          el.dispatchEvent(new Event('input', { bubbles: true }))
          el.dispatchEvent(new Event('change', { bubbles: true }))
          return true
        }, { nameContains, value })
      }

      // カテゴリ選択（select or radio）
      let filledCategory = await trySelectField(page, 'category', '卸販売')
      if (!filledCategory) {
        // ラジオボタン対応
        filledCategory = await page.evaluate(() => {
          const radios = Array.from(document.querySelectorAll('input[type="radio"]')) as HTMLInputElement[]
          for (const radio of radios) {
            const label = radio.closest('label')?.textContent || radio.parentElement?.textContent || ''
            if (label.includes('卸') || label.includes('その他')) {
              radio.click()
              radio.dispatchEvent(new Event('change', { bubbles: true }))
              return true
            }
          }
          if (radios.length > 0) { radios[0].click(); return true }
          return false
        })
      }
      console.log(`  カテゴリ選択: ${filledCategory ? '✓' : '✗'}`)

      // ラジオ選択後、条件付きフィールド表示を待機
      await delay(1500)

      // 会社名（条件付き表示フィールド対応）
      let filledCompany = await tryFillField(page, 'company', senderInfo.company_name)
      if (!filledCompany) filledCompany = await fillByJS('会社', senderInfo.company_name)
      if (!filledCompany) filledCompany = await fillByJS('店舗', senderInfo.company_name)
      // labelテキストから探す最終手段
      if (!filledCompany) {
        filledCompany = await page.evaluate(({ companyName }) => {
          const allInputs = Array.from(document.querySelectorAll('input[type="text"]')) as HTMLInputElement[]
          for (const input of allInputs) {
            const name = input.name || ''
            if ((name.includes('会社') || name.includes('店舗')) && input.offsetParent !== null) {
              input.focus()
              input.value = companyName
              input.dispatchEvent(new Event('input', { bubbles: true }))
              input.dispatchEvent(new Event('change', { bubbles: true }))
              return true
            }
          }
          return false
        }, { companyName: senderInfo.company_name })
      }
      console.log(`  会社名入力: ${filledCompany ? '✓' : '✗'}`)

      const filledName = await tryFillField(page, 'name', senderInfo.representative)
      console.log(`  名前入力: ${filledName ? '✓' : '✗'}`)

      // フリガナ
      let filledFurigana = await tryFillField(page, 'furigana', 'コウノダイチ')
      if (!filledFurigana) filledFurigana = await fillByJS('フリガナ', 'コウノダイチ')
      console.log(`  フリガナ入力: ${filledFurigana ? '✓' : '✗'}`)

      let filledEmail = await tryFillField(page, 'email', senderInfo.email)
      if (!filledEmail) filledEmail = await fillByJS('メールアドレス', senderInfo.email)
      console.log(`  メール入力: ${filledEmail ? '✓' : '✗'}`)

      // メール確認用
      let filledEmailConfirm = await tryFillField(page, 'email_confirm', senderInfo.email)
      if (!filledEmailConfirm) {
        // 「確認」を含むメールフィールドを探す
        filledEmailConfirm = await page.evaluate(({ email }) => {
          const inputs = Array.from(document.querySelectorAll('input'))
          const el = inputs.find(el => {
            const name = el.name || ''
            return name.includes('確認') && name.includes('メール') && el.offsetParent !== null
          })
          if (!el) return false
          el.focus(); el.value = email
          el.dispatchEvent(new Event('input', { bubbles: true }))
          el.dispatchEvent(new Event('change', { bubbles: true }))
          return true
        }, { email: senderInfo.email })
      }
      console.log(`  メール確認入力: ${filledEmailConfirm ? '✓' : '✗'}`)

      // 電話番号: フォーム必須項目の場合があるので入力する（メール本文には含まない）
      const filledPhone = await tryFillField(page, 'phone', '000-0000-0000')
      console.log(`  電話入力: ${filledPhone ? '✓ (ダミー)' : '✗'}`)
      const filledBody = await tryFillField(page, 'body', item.message_content)
      console.log(`  本文入力: ${filledBody ? '✓' : '✗'}`)

      // 個人情報保護方針等のチェックボックスを全てチェック
      const checkedBoxes = await page.evaluate(() => {
        const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]')) as HTMLInputElement[]
        let count = 0
        for (const cb of checkboxes) {
          if (cb.offsetParent !== null && !cb.checked) {
            cb.click()
            cb.dispatchEvent(new Event('change', { bubbles: true }))
            count++
          }
        }
        return count
      })
      console.log(`  チェックボックス: ${checkedBoxes}件チェック`)
      await delay(500)

      if (!filledBody && !filledEmail) {
        const pageTitle = await page.title()
        const pageUrl = page.url()
        console.log(`  ⚠️ 主要フィールドが入力できません (title: ${pageTitle}, url: ${pageUrl})`)
        return { success: false, error: `フォーム入力失敗: メールも本文も入力できませんでした (${pageUrl})` }
      }

      // 送信（1回目: 「入力内容を確認する」ボタン）
      const submitted = await clickSubmitButton(page)
      console.log(`  送信ボタンクリック: ${submitted ? '✓' : '✗'}`)
      if (!submitted) {
        return { success: false, error: '送信ボタンが見つかりませんでした' }
      }

      // 確認画面が表示されるまで待つ（最大10秒）
      console.log(`  確認画面の表示を待機中...`)
      for (let i = 0; i < 10; i++) {
        await delay(1000)
        const hasSubmitButton = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'))
          return buttons.some(el => {
            const text = ((el as HTMLElement).textContent || (el as HTMLInputElement).value || '').trim()
            return text === '送信する' || (text.includes('送信') && !text.includes('確認') && !text.includes('入力'))
          })
        })
        if (hasSubmitButton) {
          console.log(`  「送信する」ボタン検出（${i + 1}秒後）`)
          break
        }
        if (i === 9) console.log(`  10秒待機しても「送信する」ボタンが見つかりません`)
      }

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

      // 送信完了の判定（ページ内容から確認）
      const completionCheck = await page.evaluate(() => {
        const text = document.body.innerText || ''
        const successKeywords = [
          'ありがとうございます', 'ありがとう', '送信完了', '送信しました',
          '受付けました', '受け付けました', '受付完了', 'お問い合わせを受け付け',
          '完了しました', '送信いたしました', 'お問い合わせを承り', '承りました',
          'お問い合わせいただき', '確認のメールを', 'メールをお送り',
          'thank you', 'submitted', 'success', 'complete',
        ]
        const errorKeywords = [
          'エラー', '入力してください', '必須', '正しく入力',
          'error', 'required', 'invalid',
        ]
        const foundSuccess = successKeywords.filter(kw => text.includes(kw))
        const foundError = errorKeywords.filter(kw => text.includes(kw))
        return { foundSuccess, foundError, textSnippet: text.substring(0, 500) }
      })

      const urlChanged = finalUrl !== formUrl
      const hasSuccessText = completionCheck.foundSuccess.length > 0
      const hasErrorText = completionCheck.foundError.length > 0

      console.log(`  URL変化: ${urlChanged ? '✓ 遷移あり' : '✗ 変化なし'}`)
      console.log(`  完了テキスト: ${hasSuccessText ? `✓ [${completionCheck.foundSuccess.join(', ')}]` : '✗ なし'}`)
      console.log(`  エラーテキスト: ${hasErrorText ? `⚠️ [${completionCheck.foundError.join(', ')}]` : '✓ なし'}`)

      // 判定ロジック
      // ⚠️ urlChanged だけでは「確認画面への遷移」と区別できないため、
      //    成功テキスト検出を必須条件にする。
      let sendStatus: '送信済み' | '送信未確認' | '失敗'
      let statusReason = ''

      if (hasErrorText && !hasSuccessText) {
        sendStatus = '失敗'
        statusReason = `エラー検出: ${completionCheck.foundError.join(', ')}`
      } else if (hasSuccessText) {
        // 成功テキストが確認できた場合のみ「送信済み」
        sendStatus = '送信済み'
        statusReason = `完了テキスト検出: ${completionCheck.foundSuccess.join(', ')}`
      } else if (urlChanged) {
        // URLは遷移したが完了テキストなし → 確認画面で止まっている可能性
        sendStatus = '送信未確認'
        statusReason = 'URLは変化しましたが完了テキストが見つかりません。確認画面で止まっている可能性があります。手動確認が必要です。'
      } else {
        sendStatus = '送信未確認'
        statusReason = '完了テキストもURL遷移も検出できず。手動確認が必要です。'
      }

      console.log(`  判定: ${sendStatus} (${statusReason})`)

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
        await supabase
          .from('send_queue')
          .update({ form_url: formUrl })
          .eq('id', item.id)
      }

      if (sendStatus === '失敗') {
        return { success: false, error: statusReason }
      }
      return { success: true, verified: sendStatus === '送信済み', reason: statusReason }
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
  company: ['input[name*="company" i]', 'input[name*="会社" i]', 'input[name*="店舗" i]', 'input[placeholder*="会社" i]', 'input[placeholder*="店舗" i]'],
  name: ['input[name="お名前"]', 'input[name*="name" i]:not([name*="company" i]):not([name*="mail" i]):not([name*="会社" i]):not([name*="店舗" i]):not([type="email"]):not([name*="フリガナ" i])', 'input[name*="氏名" i]', 'input[name*="名前" i]:not([name*="フリガナ" i])', 'input[placeholder*="名前" i]:not([placeholder*="フリガナ" i])'],
  furigana: ['input[name*="フリガナ" i]', 'input[name*="ふりがな" i]', 'input[name*="kana" i]', 'input[placeholder*="フリガナ" i]'],
  email: ['input[type="email"]', 'input[name="メールアドレス"]', 'input[name*="mail" i]:not([name*="確認" i])', 'input[name*="email" i]:not([name*="confirm" i])', 'input[placeholder*="メール" i]:not([placeholder*="確認" i])'],
  email_confirm: ['input[name*="メールアドレス(確認" i]', 'input[name*="mail_confirm" i]', 'input[name*="email_confirm" i]', 'input[name*="確認" i]'],
  phone: ['input[type="tel"]', 'input[name*="phone" i]', 'input[name*="tel" i]', 'input[name*="電話" i]', 'input[placeholder*="電話" i]'],
  body: ['textarea[name*="body" i]', 'textarea[name*="message" i]', 'textarea[name*="content" i]', 'textarea[name*="内容" i]', 'textarea[name*="inquiry" i]', 'textarea'],
  category: ['select[name*="項目" i]', 'select[name*="category" i]', 'select[name*="type" i]', 'select[name*="種類" i]'],
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

async function trySelectField(page: import('playwright').Page, fieldType: string, valueOrLabel: string): Promise<boolean> {
  const selectors = FIELD_SELECTORS[fieldType] ?? []
  for (const sel of selectors) {
    try {
      const el = await page.$(sel)
      if (el && await el.isVisible()) {
        await el.scrollIntoViewIfNeeded()
        // selectの場合、optionのテキストで部分一致選択
        const options = await el.$$eval('option', (opts: HTMLOptionElement[]) =>
          opts.map(o => ({ value: o.value, text: o.textContent?.trim() ?? '' }))
        )
        // 部分一致でオプションを探す
        const match = options.find(o =>
          o.text.includes(valueOrLabel) || valueOrLabel.includes(o.text)
        )
        if (match) {
          await el.selectOption(match.value)
          return true
        }
        // 見つからなければ最初の有効なオプション（空でない）を選択
        const firstValid = options.find(o => o.value && o.value !== '')
        if (firstValid) {
          await el.selectOption(firstValid.value)
          return true
        }
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

  // 確認画面かどうかチェック（より広いキーワードで検出）
  const pageText = await page.evaluate(() => document.body.innerText || '')
  const isConfirmPage = pageText.includes('確認') || pageText.includes('内容をご確認') ||
    pageText.includes('ご確認') || pageText.includes('confirm') || pageText.includes('Confirm')
  console.log(`  確認画面検出: ${isConfirmPage ? 'はい' : 'いいえ'}`)

  if (!isConfirmPage) return

  // 全ボタンのテキストをログ出力
  const allButtons = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], a.btn, a.button'))
    return elements.map(el => ({
      tag: el.tagName,
      text: ((el as HTMLElement).textContent || (el as HTMLInputElement).value || '').trim(),
      visible: el.getBoundingClientRect().height > 0,
    }))
  })
  console.log(`  確認画面のボタン一覧: ${JSON.stringify(allButtons)}`)

  // 最終送信ボタンを探してクリック
  const clicked = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], a.btn, a.button, a[onclick]'))

    const SEND_KEYWORDS = ['送信する', '送信', 'submit', 'Submit', '送信完了', '問い合わせを送信', 'この内容で送信']
    const EXCLUDE_KEYWORDS = ['確認する', '入力に戻る', '戻る', '修正', 'back', 'Back', 'キャンセル', '内容を確認']

    // 優先: 完全一致 or 除外ワードなし・送信ワードあり
    for (const priority of [true, false]) {
      for (const el of elements) {
        const text = ((el as HTMLElement).textContent || (el as HTMLInputElement).value || '').trim().replace(/\s+/g, '')
        const isVisible = el.getBoundingClientRect().height > 0
        if (!isVisible) continue
        const hasExclude = EXCLUDE_KEYWORDS.some(kw => text.includes(kw))
        if (hasExclude) continue
        const hasSend = SEND_KEYWORDS.some(kw => priority ? text === kw : text.includes(kw))
        if (hasSend) {
          (el as HTMLElement).click()
          return text
        }
      }
    }
    return null
  })

  if (clicked) {
    console.log(`  確認画面送信クリック: "${clicked}" ✓`)
    await delay(4000) // 送信完了ページの読み込みを待つ
  } else {
    console.log(`  ⚠️ 確認画面の送信ボタンが見つかりません`)
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

        let result: { success: boolean; error?: string; verified?: boolean; reason?: string }

        if (item.send_method === 'email') {
          result = await sendEmail(item)
        } else {
          result = await sendForm(item)
        }

        if (result.success) {
          const status = result.verified === false ? '送信未確認' : '送信済み'
          await supabase
            .from('send_queue')
            .update({
              status,
              sent_at: new Date().toISOString(),
              error_message: result.verified === false ? (result.reason ?? '完了確認なし') : null,
            })
            .eq('id', item.id)

          if (result.verified !== false) {
            await supabase
              .from('leads')
              .update({ status: '送信済み' })
              .eq('id', item.lead_id)
          }

          console.log(`  ${result.verified !== false ? '✅ 送信成功（確認済み）' : '⚠️ 送信未確認（手動確認必要）'}`)
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
