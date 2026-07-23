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
  /** 氏名フリガナ（カタカナ）。フリガナ必須フォーム対応 */
  nameKana?: string
  email: string
  phone: string
}

export interface FormSendResult {
  result: 'success' | 'failed' | 'form_not_found' | 'manual'
  message: string
  contactUrl?: string
  /** 送信証拠（送信完了/リダイレクト先のスナップショット） */
  evidence?: SendEvidence
}

export interface SendEvidence {
  /** 送信POST先 */
  submittedTo: string
  /** 送信後に到達した最終URL（サンクスページ等） */
  finalUrl: string
  /** リダイレクトが発生したか */
  redirected: boolean
  /** HTTPステータス */
  httpStatus: number
  /** 成功判定の根拠キーワード（本文から検出したもの） */
  matchedKeywords: string[]
  /** 送信完了ページの本文抜粋（タグ除去・先頭600字） */
  responseText: string
}

/** レスポンスHTMLから証拠用のテキスト抜粋を作る */
function extractResponseText(html: string): string {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.slice(0, 600)
}

interface FormField {
  tag: string        // input | textarea | select
  type: string       // text | email | tel | hidden | ...
  name: string
  id: string
  placeholder: string
  value: string      // hidden field の既存値
  required: boolean
  /** select/radio の選択肢（value と表示ラベル） */
  options?: { value: string; label: string }[]
  /** このフィールドの近傍ラベルテキスト */
  label?: string
}

/** 送信/確認/戻る等のボタン（input・button 両対応） */
interface SubmitButton {
  name: string
  value: string
  label: string
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

// ─── Cookie 維持（多段フォーム対応の要）────────
// MW WP Form 等は「入力→確認→完了」の各段階をサーバーのセッションCookieで
// 紐付ける。fetch は Set-Cookie を自動保持しないので、1回の送信フロー全体で
// 共有する Cookie ジャーを自前で持ち、リダイレクトも手動追跡して各hopの
// Set-Cookie を確実に拾う（curl -L -c/-b 相当）。

type CookieJar = Map<string, string>

function readSetCookies(res: Response): string[] {
  const h = res.headers as unknown as { getSetCookie?: () => string[] }
  if (typeof h.getSetCookie === 'function') return h.getSetCookie()
  const single = res.headers.get('set-cookie')
  return single ? [single] : []
}

function storeCookies(jar: CookieJar, res: Response): void {
  for (const c of readSetCookies(res)) {
    const first = c.split(';')[0]
    const eq = first.indexOf('=')
    if (eq > 0) {
      const name = first.slice(0, eq).trim()
      const value = first.slice(eq + 1).trim()
      if (name) jar.set(name, value)
    }
  }
}

function cookieHeader(jar: CookieJar): string {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
}

interface FetchResult {
  res: Response
  html: string
  finalUrl: string
}

/** Cookie を維持しつつリダイレクトを手動追跡する fetch。各hopの Set-Cookie を jar に蓄積。 */
async function fetchCookieAware(
  url: string,
  jar: CookieJar,
  init: { method?: string; body?: string; referer?: string } = {},
  maxRedirects = 6,
): Promise<FetchResult> {
  let currentUrl = url
  let method = (init.method || 'GET').toUpperCase()
  let body: string | undefined = init.body

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
    const cookie = cookieHeader(jar)
    const headers: Record<string, string> = {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    }
    if (cookie) headers['Cookie'] = cookie
    if (init.referer) headers['Referer'] = init.referer
    if (method === 'POST') headers['Content-Type'] = 'application/x-www-form-urlencoded'

    let res: Response
    try {
      res = await fetch(currentUrl, { method, headers, body, redirect: 'manual', signal: controller.signal })
    } finally {
      clearTimeout(timer)
    }
    storeCookies(jar, res)

    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get('location')
      if (!loc) return { res, html: await res.text().catch(() => ''), finalUrl: currentUrl }
      const nextUrl = resolveUrl(currentUrl, loc)
      // 303、および 301/302 の POST は GET に変わる（PRGパターン）
      if (res.status === 303 || ((res.status === 301 || res.status === 302) && method === 'POST')) {
        method = 'GET'
        body = undefined
      }
      init.referer = currentUrl
      currentUrl = nextUrl
      continue
    }

    const html = await res.text()
    return { res, html, finalUrl: currentUrl }
  }
  throw new Error('リダイレクトが多すぎます')
}

// ─── ユーティリティ ──────────────────────────

async function fetchHtml(url: string, jar?: CookieJar): Promise<{ html: string; finalUrl: string } | null> {
  try {
    const j = jar ?? new Map()
    const { res, html, finalUrl } = await fetchCookieAware(url, j, {})
    if (!res.ok) return null
    return { html, finalUrl }
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
  // ひらがな→カタカナは変換できる。漢字は変換不能なので、
  // 変換後にカタカナ/長音/空白のみになった場合だけ採用（それ以外は nameKana に委ねる）
  const kata = name.replace(/[ぁ-ゖ]/g, ch => String.fromCharCode(ch.charCodeAt(0) + 0x60))
  return /^[゠-ヿ　\s ー]+$/.test(kata) ? kata : ''
}

// ─── フォームページ探索 ──────────────────────

async function findContactPageUrl(
  baseUrl: string,
  jar?: CookieJar,
): Promise<string | null> {
  const page = await fetchHtml(baseUrl, jar)
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

function parseFormFields(html: string): {
  fields: FormField[]
  submitButtons: SubmitButton[]
  action: string
  method: string
} {
  const $ = cheerio.load(html)

  // メインのフォームを探す（複数ある場合、textarea を含むものを優先）
  let $form = $('form').filter((_, el) => $(el).find('textarea').length > 0).first()
  if ($form.length === 0) $form = $('form').first()
  if ($form.length === 0) return { fields: [], submitButtons: [], action: '', method: 'POST' }

  const action = $form.attr('action') || ''
  const method = ($form.attr('method') || 'POST').toUpperCase()

  const fields: FormField[] = []
  const submitButtons: SubmitButton[] = []

  // radio は name ごとに選択肢をまとめる
  const radioGroups = new Map<string, FormField>()

  $form.find('input, textarea, select, button').each((_, el) => {
    const $el = $(el)
    const tag = el.tagName.toLowerCase()
    const type = ($el.attr('type') || (tag === 'textarea' ? 'textarea' : tag === 'select' ? 'select' : tag === 'button' ? 'submit' : 'text')).toLowerCase()
    const name = $el.attr('name') || ''
    const id = $el.attr('id') || ''
    const placeholder = $el.attr('placeholder') || ''
    const value = ($el.attr('value') ?? ($el.val() as string) ?? '') || ''
    const required = $el.attr('required') !== undefined

    // 送信/ボタン系は submitButtons に回す（name 付きのみ有効）
    if (['submit', 'image'].includes(type) || tag === 'button') {
      if (type === 'reset') return
      const label = ($el.text() || $el.attr('value') || '').trim()
      if (name || value || label) submitButtons.push({ name, value, label })
      return
    }
    if (type === 'button' || type === 'file') return

    // 近傍ラベル（同一idのlabel、または親labelのテキスト）
    let label = ''
    if (id) label = $(`label[for="${id}"]`).text().trim()
    if (!label) label = $el.closest('label').text().trim()

    if (type === 'radio') {
      const g = radioGroups.get(name)
      const opt = { value, label: label || value }
      if (g) {
        g.options!.push(opt)
        if (required) g.required = true
      } else {
        const f: FormField = { tag, type, name, id, placeholder, value: '', required, options: [opt], label }
        radioGroups.set(name, f)
        fields.push(f)
      }
      return
    }

    if (tag === 'select') {
      const options: { value: string; label: string }[] = []
      $el.find('option').each((_, o) => {
        const ov = $(o).attr('value')
        const ol = $(o).text().trim()
        options.push({ value: ov ?? ol, label: ol })
      })
      fields.push({ tag, type: 'select', name, id, placeholder, value, required, options, label })
      return
    }

    fields.push({ tag, type, name, id, placeholder, value, required, label })
  })

  return { fields, submitButtons, action, method }
}

/** 前進（確認/送信）ボタンを選ぶ。戻る/修正/リセットは除外。 */
function pickForwardButton(buttons: SubmitButton[]): SubmitButton | null {
  const back = ['戻る', '修正', 'back', 'reset', 'クリア', 'キャンセル', 'cancel']
  const forward = ['確認', '送信', 'confirm', 'send', 'submit', 'next', '進む', '送る', 'go']
  const isBack = (b: SubmitButton) => back.some(k => (b.value + b.label).toLowerCase().includes(k.toLowerCase()))
  const isForward = (b: SubmitButton) => forward.some(k => (b.value + b.label).toLowerCase().includes(k.toLowerCase()))
  return buttons.find(b => isForward(b) && !isBack(b)) ?? buttons.find(b => !isBack(b) && b.name) ?? null
}

/** 完了（送信）ボタンを選ぶ。確認/戻る系より「送信・完了」を優先。 */
function pickSendButton(buttons: SubmitButton[]): SubmitButton | null {
  const back = ['戻る', '修正', 'back', 'reset']
  const send = ['送信する', '送信', 'send', '完了', 'submit', '申し込む', 'この内容で']
  const isBack = (b: SubmitButton) => back.some(k => (b.value + b.label).toLowerCase().includes(k.toLowerCase()))
  const isSend = (b: SubmitButton) => send.some(k => (b.value + b.label).toLowerCase().includes(k.toLowerCase()))
  return buttons.find(b => isSend(b) && !isBack(b)) ?? buttons.find(b => !isBack(b) && b.name) ?? null
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

  // 各フィールドタイプに対してマッチング（テキスト系のみ。radio/select/checkbox は別処理）
  const TEXT_LIKE = new Set(['text', 'email', 'tel', 'textarea', 'search', 'url', 'number', 'password', ''])
  const visibleFields = fields.filter(f => f.type !== 'hidden' && TEXT_LIKE.has(f.type))
  const matched = new Set<string>()

  // 姓名を分割（スペース区切り）
  const nameParts = sender.name.split(/[\s　]+/)
  const lastName = nameParts[0] || sender.name
  const firstName = nameParts[1] || ''

  const mapping: [FieldType, string][] = [
    ['company', sender.companyName],
    ['name', sender.name],
    ['furigana', sender.nameKana?.trim() || toKatakana(sender.name)],
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

  // 姓名が分かれているフォームに対応（lastname/firstname パターン）
  for (const f of visibleFields) {
    if (matched.has(f.name)) continue
    const lower = (f.name + f.id + f.placeholder).toLowerCase()
    if ((lower.includes('lastname') || lower.includes('sei') || f.placeholder === '姓') && !lower.includes('kana') && !lower.includes('フリガナ')) {
      result[f.name] = lastName
      matched.add(f.name)
    } else if ((lower.includes('firstname') || lower.includes('mei') || f.placeholder === '名') && !lower.includes('kana') && !lower.includes('フリガナ')) {
      result[f.name] = firstName || lastName
      matched.add(f.name)
    }
  }

  // textarea が body にマッチしなかった場合、最初の textarea を本文として使う
  const hasBody = Object.entries(result).some(([key, val]) => {
    const field = visibleFields.find(f => f.name === key)
    return field?.tag === 'textarea' || val.length > 200
  })
  if (!hasBody) {
    const firstTextarea = visibleFields.find(f => f.tag === 'textarea' && !matched.has(f.name))
    if (firstTextarea) {
      result[firstTextarea.name] = messageContent
      matched.add(firstTextarea.name)
    }
  }

  // 同意チェックボックス（name/id だけでなくラベルテキストも見る）
  const CONSENT_KW = ['同意', '承諾', '承知', '規約', 'プライバシー', '個人情報', '保護方針', 'privacy', 'agree', 'consent', 'policy', 'terms']
  for (const f of fields) {
    if (f.type === 'checkbox') {
      const hay = `${f.name} ${f.id} ${f.placeholder} ${f.label ?? ''}`.toLowerCase()
      if (CONSENT_KW.some(k => hay.includes(k.toLowerCase()))) {
        result[f.name] = f.value || 'on'
        matched.add(f.name)
      }
    }
  }

  // ラジオ必須（お問い合わせ項目など）: 未マッピングなら最適な選択肢を選ぶ
  for (const f of fields) {
    if (f.type !== 'radio' || matched.has(f.name) || !f.options?.length) continue
    result[f.name] = pickBestOption(f.options)
    matched.add(f.name)
  }

  // select 必須: プレースホルダ以外の選択肢を選ぶ
  for (const f of fields) {
    if (f.type !== 'select' || matched.has(f.name) || !f.options?.length) continue
    // すでに body/subject 等でテキストが入っている select は上書きしない
    if (result[f.name]) continue
    const real = f.options.filter(o => o.value && !/選択|please|--|^$/.test(o.label))
    result[f.name] = pickBestOption(real.length ? real : f.options)
    matched.add(f.name)
  }

  return result
}

/** 選択肢から営業文脈に最適なものを選ぶ（卸・取引・その他を優先、無ければ先頭） */
function pickBestOption(options: { value: string; label: string }[]): string {
  const prefer = ['卸', '取引', '仕入', '導入', 'ビジネス', '法人', 'business', 'その他', 'other', '一般']
  for (const kw of prefer) {
    const hit = options.find(o => (o.value + o.label).toLowerCase().includes(kw.toLowerCase()))
    if (hit) return hit.value
  }
  return options[0]?.value ?? ''
}

// ─── フォーム送信 ────────────────────────────

async function submitCF7Form(
  pageUrl: string,
  formId: string,
  formData: Record<string, string>,
  html: string,
  jar: CookieJar,
): Promise<FormSendResult> {
  const $ = cheerio.load(html)

  // CF7 の hidden フィールドを追加（FormData 形式で送信）
  const data = new FormData()
  data.append('_wpcf7', formId)
  data.append('_wpcf7_version', $('input[name="_wpcf7_version"]').val() as string || '5.9')
  data.append('_wpcf7_locale', 'ja')
  data.append('_wpcf7_unit_tag', $('input[name="_wpcf7_unit_tag"]').val() as string || `wpcf7-f${formId}-o1`)
  data.append('_wpcf7_container_post', $('input[name="_wpcf7_container_post"]').val() as string || '0')
  data.append('_wpcf7_posted_data_hash', '')

  for (const [key, val] of Object.entries(formData)) {
    if (!key.startsWith('_wpcf7')) {
      data.append(key, val)
    }
  }

  const origin = new URL(pageUrl).origin
  const apiUrl = `${origin}/wp-json/contact-form-7/v1/contact-forms/${formId}/feedback`

  try {
    const cookie = cookieHeader(jar)
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': pageUrl,
        'Origin': origin,
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: data,
    })
    storeCookies(jar, res)

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

    // CF7 は mail_sent のみ真の成功（mail_failed/validation_failed 等は成功にしない）
    if (json.status === 'mail_sent') {
      return {
        result: 'success',
        message: `CF7 送信成功: ${json.message || 'mail_sent'}`,
        contactUrl: pageUrl,
        evidence: {
          submittedTo: apiUrl,
          finalUrl: apiUrl,
          redirected: false,
          httpStatus: res.status,
          matchedKeywords: ['mail_sent'],
          responseText: (json.message || 'mail_sent').slice(0, 600),
        },
      }
    }

    // 検証エラー等は failed、mail_failed（サーバー側メール障害）は手動確認へ
    if (json.status === 'mail_failed') {
      return { result: 'manual', message: `CF7 mail_failed（サーバー側メール送信失敗）: ${json.message || ''}` }
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

const SUCCESS_KEYWORDS = ['ありがとうございました', 'ありがとう', '送信完了', '送信いたしました', '送信しました', '受け付け', '受付けました', 'お問い合わせを受け', 'thank you', 'thankyou', '完了しました', '承りました', '承け', 'message sent', 'submission received']
const CONFIRM_KEYWORDS = ['確認画面', '入力内容をご確認', '内容をご確認', '以下の内容で', 'この内容で送信', '確認する', 'confirm your']
const ERROR_KEYWORDS = ['入力してください', '必須項目', '選択してください', 'エラーが', 'は必須です', 'invalid', 'required field']

function findKeywords(html: string, kws: string[]): string[] {
  const lower = html.toLowerCase()
  return kws.filter(kw => lower.includes(kw.toLowerCase()))
}

async function submitHtmlForm(
  pageUrl: string,
  action: string,
  method: string,
  formData: Record<string, string>,
  jar: CookieJar,
  forwardButton: SubmitButton | null,
): Promise<FormSendResult> {
  const actionUrl = action ? resolveUrl(pageUrl, action) : pageUrl

  // 前進ボタン（確認/送信）があれば name=value を含める
  const payload = { ...formData }
  if (forwardButton?.name) payload[forwardButton.name] = forwardButton.value

  try {
    const { res, html, finalUrl } = await fetchCookieAware(actionUrl, jar, {
      method: method || 'POST',
      body: new URLSearchParams(payload).toString(),
      referer: pageUrl,
    })

    const matchedSuccess = findKeywords(html, SUCCESS_KEYWORDS)
    const matchedConfirm = findKeywords(html, CONFIRM_KEYWORDS)
    const matchedError = findKeywords(html, ERROR_KEYWORDS)

    const evidence = {
      submittedTo: actionUrl,
      finalUrl,
      redirected: finalUrl !== actionUrl,
      httpStatus: res.status,
      matchedKeywords: matchedSuccess,
      responseText: extractResponseText(html),
    }

    // 明示的な成功サイン → 成功
    if (matchedSuccess.length > 0) {
      return { result: 'success', message: `フォーム送信成功（${matchedSuccess[0]}）`, contactUrl: pageUrl, evidence }
    }

    // 確認画面 → 完了ステップへ（Cookie維持）
    if (matchedConfirm.length > 0 && matchedSuccess.length === 0) {
      return await handleConfirmPage(finalUrl, html, jar)
    }

    // バリデーションエラー → 失敗
    if (matchedError.length > 0) {
      return { result: 'failed', message: `フォーム検証エラー（${matchedError[0]}）` }
    }

    // 成功サインが取れない → 「成功」と即断せず手動確認へ（誤検知防止の安全弁）
    return {
      result: 'manual',
      message: `送信は行われましたが完了サインを確認できませんでした。手動確認を推奨（HTTP ${res.status}）`,
      contactUrl: pageUrl,
      evidence,
    }
  } catch (err) {
    return { result: 'failed', message: `送信エラー: ${err instanceof Error ? err.message : 'unknown'}` }
  }
}

async function handleConfirmPage(
  confirmUrl: string,
  confirmHtml: string,
  jar: CookieJar,
): Promise<FormSendResult> {
  const $ = cheerio.load(confirmHtml)
  const $form = $('form').first()
  if ($form.length === 0) {
    return { result: 'manual', message: '確認画面のフォームが見つかりません。手動確認を推奨' }
  }

  // 確認画面に captcha が挿入されている場合は手動へ
  const lowerConfirm = confirmHtml.toLowerCase()
  if (lowerConfirm.includes('recaptcha') || lowerConfirm.includes('h-captcha')) {
    return { result: 'manual', message: '確認画面にCAPTCHAがあります。手動対応が必要です' }
  }

  const action = $form.attr('action') || ''
  const method = ($form.attr('method') || 'POST').toUpperCase()

  // 確認画面が再埋め込みする hidden 項目を全て回収（MW WP Form 等はここに全データが入る）
  const data: Record<string, string> = {}
  $form.find('input[type="hidden"]').each((_, el) => {
    const name = $(el).attr('name') || ''
    const value = ($(el).attr('value') ?? ($(el).val() as string) ?? '') || ''
    if (name) data[name] = value
  })

  // 完了（送信する）ボタンを input・button 両方から探す
  const buttons: SubmitButton[] = []
  $form.find('input[type="submit"], input[type="image"], button').each((_, el) => {
    const $el = $(el)
    if (($el.attr('type') || '').toLowerCase() === 'reset') return
    const name = $el.attr('name') || ''
    const value = ($el.attr('value') ?? ($el.val() as string) ?? '') || ''
    const label = ($el.text() || value || '').trim()
    if (name || value || label) buttons.push({ name, value, label })
  })
  const sendBtn = pickSendButton(buttons)
  if (sendBtn?.name) data[sendBtn.name] = sendBtn.value

  const actionUrl = action ? resolveUrl(confirmUrl, action) : confirmUrl

  try {
    const { res, html, finalUrl } = await fetchCookieAware(actionUrl, jar, {
      method,
      body: new URLSearchParams(data).toString(),
      referer: confirmUrl,
    })

    const matchedSuccess = findKeywords(html, SUCCESS_KEYWORDS)
    const stillConfirm = findKeywords(html, CONFIRM_KEYWORDS)
    const evidence = {
      submittedTo: actionUrl,
      finalUrl,
      redirected: finalUrl !== actionUrl,
      httpStatus: res.status,
      matchedKeywords: matchedSuccess,
      responseText: extractResponseText(html),
    }

    // 明示的な完了サイン & まだ確認画面ではない → 成功
    if (matchedSuccess.length > 0 && stillConfirm.length === 0) {
      return { result: 'success', message: `確認画面経由で送信成功（${matchedSuccess[0]}）`, contactUrl: confirmUrl, evidence }
    }

    // 完了サインが取れない（＝メール未送信の恐れ）→ 手動確認へ倒す
    return {
      result: 'manual',
      message: '確認画面からの完了を確認できませんでした。手動確認を推奨',
      contactUrl: confirmUrl,
      evidence,
    }
  } catch (err) {
    return { result: 'failed', message: `確認画面送信エラー: ${err instanceof Error ? err.message : 'unknown'}` }
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
  // 送信フロー全体で共有する Cookie ジャー（多段フォームのセッション維持）
  const jar: CookieJar = new Map()

  // 1. フォームページを探す
  let formPageUrl = contactUrl || null
  if (!formPageUrl) {
    formPageUrl = await findContactPageUrl(companyUrl, jar)
  }

  if (!formPageUrl) {
    return { result: 'form_not_found', message: 'お問い合わせフォームが見つかりませんでした' }
  }

  // 2. フォームページのHTMLを取得（GETのSet-Cookie=セッションをjarに保存）
  const formPage = await fetchHtml(formPageUrl, jar)
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
  const { fields, submitButtons, action, method } = parseFormFields(formPage.html)

  if (fields.length === 0) {
    return { result: 'form_not_found', message: 'フォームフィールドが検出されませんでした' }
  }

  // 6. フィールドマッピング
  const formData = mapFieldsToValues(fields, sender, messageContent, subject)

  // 本文が入っていなければ失敗（200文字以上の値があるかチェック）
  const hasLongText = Object.values(formData).some(v => v.length > 200)
  if (!hasLongText) {
    return { result: 'failed', message: '本文フィールドのマッピングに失敗しました' }
  }

  // 7. 送信
  if (cf7.isCF7 && cf7.formId) {
    return await submitCF7Form(formPage.finalUrl, cf7.formId, formData, formPage.html, jar)
  }

  const forwardButton = pickForwardButton(submitButtons)
  return await submitHtmlForm(formPage.finalUrl, action, method, formData, jar, forwardButton)
}
