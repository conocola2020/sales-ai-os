/**
 * 自前フォーム送信エンジン（API不要）
 *
 * Node.js fetch + cheerio でフォームを探索・解析・送信する。
 * 旧 form-submitter.ts (Playwright) のフィールドパターンを流用。
 */

import * as cheerio from 'cheerio'

// ─── 型定義 ─────────────────────────────────

export interface SenderInfo {
  companyName: string
  name: string
  email: string
  phone: string
}

export interface FormSendResult {
  result: 'success' | 'failed' | 'form_not_found' | 'manual'
  message: string
  contactUrl?: string
}

interface FormField {
  tag: string        // input | textarea | select
  type: string       // text | email | tel | hidden | ...
  name: string
  id: string
  placeholder: string
  value: string      // hidden field の既存値
  required: boolean
}

// ─── 定数 ────────────────────────────────────

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const FETCH_TIMEOUT = 10000

const CONTACT_PATHS = [
  '/contact', '/contact/', '/inquiry', '/inquiry/',
  '/お問い合わせ', '/contact-us', '/contactus',
  '/form', '/toiawase', '/otoiawase', '/mail',
]

const CONTACT_LINK_KEYWORDS = [
  '問い合わせ', 'お問い合わせ', 'contact', 'inquiry',
  'toiawase', 'メール', 'フォーム', 'mail',
]

// ─── フィールドパターン（旧 form-submitter.ts から流用）─────

type FieldType = 'company' | 'name' | 'email' | 'email_confirm' | 'phone' | 'body' | 'subject' | 'furigana'

const FIELD_PATTERNS: Record<FieldType, { namePatterns: string[]; labelPatterns: string[] }> = {
  company: {
    namePatterns: ['company', 'corp', 'organ', '会社名', '会社', '企業', '法人', '店舗名', '店舗', '団体'],
    labelPatterns: ['会社名', '会社', '企業', '法人', '組織', '店舗', '団体', 'company', 'organization'],
  },
  name: {
    namePatterns: ['name', 'お名前', '氏名', '名前', '担当'],
    labelPatterns: ['お名前', '氏名', '名前', '担当者', 'name', 'your name'],
  },
  furigana: {
    namePatterns: ['kana', 'フリガナ', 'ふりがな', 'furi', 'フリ'],
    labelPatterns: ['フリガナ', 'ふりがな', 'カナ', 'kana'],
  },
  email: {
    namePatterns: ['email', 'mail', 'メール', 'メールアドレス'],
    labelPatterns: ['メールアドレス', 'メール', 'email', 'mail', 'e-mail'],
  },
  email_confirm: {
    namePatterns: ['confirm', '確認', 're_mail', 're_email', 'mail_confirm', 'email_confirm'],
    labelPatterns: ['確認用', 'メール確認', 'confirm', 're-enter'],
  },
  phone: {
    namePatterns: ['phone', 'tel', '電話', '電話番号'],
    labelPatterns: ['電話番号', '電話', 'TEL', 'phone', 'tel'],
  },
  body: {
    namePatterns: ['内容', 'body', 'message', 'content', 'inquiry', '本文', 'comment', 'お問い合わせ', '備考', '要望', 'detail'],
    labelPatterns: ['内容', '本文', 'お問い合わせ', 'メッセージ', 'message', 'inquiry', 'body', '備考', 'ご要望'],
  },
  subject: {
    namePatterns: ['subject', '件名', 'title'],
    labelPatterns: ['件名', 'subject', 'タイトル'],
  },
}

// company/mail/kana を含む name フィールドは除外する
const NAME_EXCLUDE = ['company', 'corp', 'mail', 'email', 'kana', 'フリガナ', 'カナ', '会社']

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

function toKatakana(name: string): string {
  // 簡易的なカタカナ変換（河野大地 → コウノダイチ は難しいのでスキップ）
  return ''
}

// ─── フォームページ探索 ──────────────────────

async function findContactPageUrl(
  baseUrl: string
): Promise<string | null> {
  const page = await fetchHtml(baseUrl)
  if (!page) return null

  const $ = cheerio.load(page.html)

  // 1. リンクからキーワード検索
  const links: string[] = []
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || ''
    const text = $(el).text().trim().toLowerCase()
    const lowerHref = href.toLowerCase()
    for (const kw of CONTACT_LINK_KEYWORDS) {
      if (lowerHref.includes(kw) || text.includes(kw)) {
        links.push(resolveUrl(page.finalUrl, href))
        break
      }
    }
  })

  // リンク先にフォームがあるか確認
  for (const link of links) {
    const linkPage = await fetchHtml(link)
    if (!linkPage) continue
    const $link = cheerio.load(linkPage.html)
    if ($link('form').length > 0 || $link('textarea').length > 0) {
      return linkPage.finalUrl
    }
  }

  // 2. よくあるパスを試す
  const origin = new URL(baseUrl).origin
  for (const path of CONTACT_PATHS) {
    const url = `${origin}${path}`
    const pathPage = await fetchHtml(url)
    if (!pathPage) continue
    const $path = cheerio.load(pathPage.html)
    if ($path('form').length > 0 || $path('textarea').length > 0) {
      return pathPage.finalUrl
    }
  }

  return null
}

// ─── フォーム解析 ────────────────────────────

function detectCF7(html: string): { isCF7: boolean; formId?: string } {
  const $ = cheerio.load(html)
  const wpcf7 = $('input[name="_wpcf7"]')
  if (wpcf7.length > 0) {
    return { isCF7: true, formId: wpcf7.val() as string }
  }
  return { isCF7: false }
}

function parseFormFields(html: string): { fields: FormField[]; action: string; method: string } {
  const $ = cheerio.load(html)

  // メインのフォームを探す（複数ある場合、textarea を含むものを優先）
  let $form = $('form').filter((_, el) => $(el).find('textarea').length > 0).first()
  if ($form.length === 0) $form = $('form').first()
  if ($form.length === 0) return { fields: [], action: '', method: 'POST' }

  const action = $form.attr('action') || ''
  const method = ($form.attr('method') || 'POST').toUpperCase()

  const fields: FormField[] = []

  $form.find('input, textarea, select').each((_, el) => {
    const $el = $(el)
    const tag = el.tagName.toLowerCase()
    const type = ($el.attr('type') || (tag === 'textarea' ? 'textarea' : 'text')).toLowerCase()
    const name = $el.attr('name') || ''
    const id = $el.attr('id') || ''
    const placeholder = $el.attr('placeholder') || ''
    const value = $el.val() as string || ''
    const required = $el.attr('required') !== undefined

    // submit/button/image はスキップ
    if (['submit', 'button', 'image', 'reset', 'file'].includes(type)) return

    fields.push({ tag, type, name, id, placeholder, value, required })
  })

  return { fields, action, method }
}

// ─── フィールドマッピング ────────────────────

function matchField(field: FormField, fieldType: FieldType): boolean {
  const patterns = FIELD_PATTERNS[fieldType]
  const lowerName = field.name.toLowerCase()
  const lowerId = field.id.toLowerCase()
  const lowerPlaceholder = field.placeholder.toLowerCase()

  // name フィールドの特殊処理：company/mail/kana を含む場合は除外
  if (fieldType === 'name') {
    for (const excl of NAME_EXCLUDE) {
      if (lowerName.includes(excl) || lowerId.includes(excl)) return false
    }
  }

  // email_confirm: 確認用メールフィールドの検出
  if (fieldType === 'email' && (lowerName.includes('confirm') || lowerName.includes('確認') || lowerName.includes('re_'))) {
    return false
  }

  for (const pat of patterns.namePatterns) {
    const lowerPat = pat.toLowerCase()
    if (lowerName.includes(lowerPat) || lowerId.includes(lowerPat) || lowerPlaceholder.includes(lowerPat)) {
      return true
    }
  }

  // type ベースのマッチング
  if (fieldType === 'email' && field.type === 'email') return true
  if (fieldType === 'phone' && field.type === 'tel') return true

  return false
}

function mapFieldsToValues(
  fields: FormField[],
  sender: SenderInfo,
  messageContent: string,
  subject?: string,
): Record<string, string> {
  const result: Record<string, string> = {}

  // hidden フィールドは既存値をそのまま保持
  for (const f of fields) {
    if (f.type === 'hidden' && f.value) {
      result[f.name] = f.value
    }
  }

  // 各フィールドタイプに対してマッチング
  const visibleFields = fields.filter(f => f.type !== 'hidden')
  const matched = new Set<string>()

  const mapping: [FieldType, string][] = [
    ['company', sender.companyName],
    ['name', sender.name],
    ['furigana', toKatakana(sender.name)],
    ['email', sender.email],
    ['email_confirm', sender.email],
    ['phone', sender.phone],
    ['subject', subject || ''],
    ['body', messageContent],
  ]

  for (const [fieldType, value] of mapping) {
    if (!value) continue
    for (const f of visibleFields) {
      if (matched.has(f.name)) continue
      if (matchField(f, fieldType)) {
        result[f.name] = value
        matched.add(f.name)
        break
      }
    }
  }

  // textarea が body にマッチしなかった場合、最初の textarea を本文として使う
  if (!Object.values(result).includes(messageContent)) {
    const firstTextarea = visibleFields.find(f => f.tag === 'textarea' && !matched.has(f.name))
    if (firstTextarea) {
      result[firstTextarea.name] = messageContent
      matched.add(firstTextarea.name)
    }
  }

  // checkbox で「同意」「プライバシー」が含まれるものはチェック
  for (const f of fields) {
    if (f.type === 'checkbox') {
      const lower = (f.name + f.id).toLowerCase()
      if (lower.includes('agree') || lower.includes('同意') || lower.includes('privacy') || lower.includes('プライバシー')) {
        result[f.name] = f.value || 'on'
      }
    }
  }

  return result
}

// ─── フォーム送信 ────────────────────────────

async function submitCF7Form(
  pageUrl: string,
  formId: string,
  formData: Record<string, string>,
  html: string,
): Promise<FormSendResult> {
  const $ = cheerio.load(html)

  // CF7 の hidden フィールドを追加
  const data = new URLSearchParams()
  data.append('_wpcf7', formId)
  data.append('_wpcf7_version', $('input[name="_wpcf7_version"]').val() as string || '5.9')
  data.append('_wpcf7_locale', 'ja')
  data.append('_wpcf7_unit_tag', $('input[name="_wpcf7_unit_tag"]').val() as string || `wpcf7-f${formId}-o1`)
  data.append('_wpcf7_container_post', '0')
  data.append('_wpcf7_posted_data_hash', '')

  for (const [key, val] of Object.entries(formData)) {
    if (!key.startsWith('_wpcf7')) {
      data.append(key, val)
    }
  }

  const origin = new URL(pageUrl).origin
  const apiUrl = `${origin}/wp-json/contact-form-7/v1/contact-forms/${formId}/feedback`

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': pageUrl,
        'Origin': origin,
      },
      body: data.toString(),
    })

    const text = await res.text()
    let json: { status: string; message?: string; invalid_fields?: unknown[] }
    try {
      json = JSON.parse(text)
    } catch {
      return {
        result: 'failed',
        message: `CF7 APIがJSONを返しませんでした (HTTP ${res.status}): ${text.substring(0, 100)}`,
      }
    }

    if (json.status === 'mail_sent') {
      return {
        result: 'success',
        message: `CF7 送信成功: ${json.message || 'mail_sent'}`,
        contactUrl: pageUrl,
      }
    }

    return {
      result: 'failed',
      message: `CF7 送信失敗: ${json.status} — ${json.message || ''}`,
    }
  } catch (err) {
    return {
      result: 'failed',
      message: `CF7 API エラー: ${err instanceof Error ? err.message : 'unknown'}`,
    }
  }
}

async function submitHtmlForm(
  pageUrl: string,
  action: string,
  method: string,
  formData: Record<string, string>,
): Promise<FormSendResult> {
  const actionUrl = action ? resolveUrl(pageUrl, action) : pageUrl

  try {
    const body = new URLSearchParams(formData)
    const res = await fetch(actionUrl, {
      method: method || 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': pageUrl,
      },
      body: body.toString(),
      redirect: 'follow',
    })

    const responseHtml = await res.text()
    const lower = responseHtml.toLowerCase()

    // 成功判定
    const successKeywords = ['ありがとう', '送信完了', '受け付け', 'thank', 'complete', '完了', '承り']
    const isSuccess = successKeywords.some(kw => lower.includes(kw))

    // 確認画面判定（送信はまだ完了していない）
    const confirmKeywords = ['確認', 'confirm', '入力内容']
    const isConfirm = confirmKeywords.some(kw => lower.includes(kw)) && !isSuccess

    if (isConfirm) {
      // 確認画面の場合、submitボタンを探してもう一度POST
      return await handleConfirmPage(res.url, responseHtml, formData)
    }

    if (isSuccess || res.redirected) {
      return {
        result: 'success',
        message: `フォーム送信成功${res.redirected ? ` (リダイレクト: ${res.url})` : ''}`,
        contactUrl: pageUrl,
      }
    }

    // エラー判定
    const errorKeywords = ['エラー', 'error', '必須', 'required', '入力してください']
    const hasError = errorKeywords.some(kw => lower.includes(kw))

    if (hasError) {
      return { result: 'failed', message: 'フォームバリデーションエラーが検出されました' }
    }

    // レスポンスコードで判定
    if (res.ok) {
      return {
        result: 'success',
        message: `HTTP ${res.status} — レスポンスから成功/失敗を判定できませんが、送信完了の可能性があります`,
        contactUrl: pageUrl,
      }
    }

    return { result: 'failed', message: `HTTP ${res.status}` }
  } catch (err) {
    return {
      result: 'failed',
      message: `送信エラー: ${err instanceof Error ? err.message : 'unknown'}`,
    }
  }
}

async function handleConfirmPage(
  confirmUrl: string,
  confirmHtml: string,
  originalData: Record<string, string>,
): Promise<FormSendResult> {
  // 確認ページのフォームを解析して送信ボタンを見つける
  const $ = cheerio.load(confirmHtml)
  const $form = $('form').first()
  if ($form.length === 0) {
    return { result: 'failed', message: '確認画面のフォームが見つかりません' }
  }

  const action = $form.attr('action') || ''
  const method = ($form.attr('method') || 'POST').toUpperCase()

  // hidden フィールドから新しいデータを構築
  const data: Record<string, string> = {}
  $form.find('input[type="hidden"]').each((_, el) => {
    const name = $(el).attr('name') || ''
    const value = $(el).val() as string || ''
    if (name) data[name] = value
  })

  // 送信ボタンの name/value を追加
  $form.find('input[type="submit"]').each((_, el) => {
    const name = $(el).attr('name') || ''
    const value = $(el).val() as string || ''
    const lowerValue = value.toLowerCase()
    // 「送信」「送る」ボタンを選択（「戻る」「修正」は除外）
    if (lowerValue.includes('送信') || lowerValue.includes('submit') || lowerValue.includes('send')) {
      if (name) data[name] = value
    }
  })

  const actionUrl = action ? resolveUrl(confirmUrl, action) : confirmUrl

  try {
    const body = new URLSearchParams(data)
    const res = await fetch(actionUrl, {
      method,
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': confirmUrl,
      },
      body: body.toString(),
      redirect: 'follow',
    })

    const html = await res.text()
    const lower = html.toLowerCase()
    const successKeywords = ['ありがとう', '送信完了', '受け付け', 'thank', 'complete', '完了', '承り']

    if (successKeywords.some(kw => lower.includes(kw)) || res.redirected) {
      return {
        result: 'success',
        message: `確認画面経由で送信成功${res.redirected ? ` (${res.url})` : ''}`,
        contactUrl: confirmUrl,
      }
    }

    return { result: 'failed', message: '確認画面からの送信結果を判定できませんでした' }
  } catch (err) {
    return {
      result: 'failed',
      message: `確認画面送信エラー: ${err instanceof Error ? err.message : 'unknown'}`,
    }
  }
}

// ─── メインエントリポイント ──────────────────

export async function sendForm(
  companyUrl: string,
  contactUrl: string | undefined,
  sender: SenderInfo,
  messageContent: string,
  subject?: string,
): Promise<FormSendResult> {
  // 1. フォームページを探す
  let formPageUrl = contactUrl || null
  if (!formPageUrl) {
    formPageUrl = await findContactPageUrl(companyUrl)
  }

  if (!formPageUrl) {
    return { result: 'form_not_found', message: 'お問い合わせフォームが見つかりませんでした' }
  }

  // 2. フォームページのHTMLを取得
  const formPage = await fetchHtml(formPageUrl)
  if (!formPage) {
    return { result: 'failed', message: `フォームページの取得に失敗しました: ${formPageUrl}` }
  }

  // 3. reCAPTCHA チェック
  const lower = formPage.html.toLowerCase()
  if (lower.includes('g-recaptcha') || lower.includes('h-captcha') || lower.includes('recaptcha')) {
    return { result: 'manual', message: 'CAPTCHA が検出されました。手動対応が必要です。' }
  }

  // 4. CF7 判定
  const cf7 = detectCF7(formPage.html)

  // 5. フォームフィールド解析
  const { fields, action, method } = parseFormFields(formPage.html)

  if (fields.length === 0) {
    return { result: 'form_not_found', message: 'フォームフィールドが検出されませんでした' }
  }

  // 6. フィールドマッピング
  const formData = mapFieldsToValues(fields, sender, messageContent, subject)

  // 本文が入っていなければ失敗
  if (!Object.values(formData).some(v => v.includes(messageContent.substring(0, 50)))) {
    return { result: 'failed', message: '本文フィールドのマッピングに失敗しました' }
  }

  // 7. 送信
  if (cf7.isCF7 && cf7.formId) {
    return await submitCF7Form(formPage.finalUrl, cf7.formId, formData, formPage.html)
  }

  return await submitHtmlForm(formPage.finalUrl, action, method, formData)
}
