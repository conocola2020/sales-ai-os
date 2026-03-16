/**
 * 企業HPからコンテンツを取得・構造化する共通ユーティリティ
 */

// ---------------------------------------------------------------------------
// HTML Utilities
// ---------------------------------------------------------------------------

export function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(nav|footer|header|aside)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(p|div|h[1-6]|li|br|tr)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export function extractMeta(html: string): { title: string; description: string } {
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i)
  const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : ''
  const descMatch =
    html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ??
    html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i)
  const description = descMatch ? descMatch[1].trim() : ''
  return { title, description }
}

// ---------------------------------------------------------------------------
// Section Extractors
// ---------------------------------------------------------------------------

const MENU_KEYWORDS = ['メニュー', '料金', 'ドリンク', 'フード', '食事', '飲み物', 'カフェ', 'レストラン', '売店', '自販機', 'ビール', 'コーヒー', 'ジュース']
const FACILITY_KEYWORDS = ['サウナ', '露天', '水風呂', '岩盤浴', '休憩', 'ラウンジ', 'ととのい', '外気浴', 'ロウリュ', 'アウフグース', 'ミスト', '薬草', '炭酸泉', 'バレル']
const SNS_PATTERNS = [
  /https?:\/\/(www\.)?instagram\.com\/[^\s"'<>]+/gi,
  /https?:\/\/(www\.)?(twitter|x)\.com\/[^\s"'<>]+/gi,
  /https?:\/\/line\.me\/[^\s"'<>]+/gi,
]

function extractSectionByKeywords(text: string, keywords: string[], contextLines = 3): string[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const matches: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (keywords.some(kw => line.includes(kw))) {
      const start = Math.max(0, i)
      const end = Math.min(lines.length, i + contextLines + 1)
      matches.push(lines.slice(start, end).join(' '))
    }
  }
  // Deduplicate similar entries
  const unique = [...new Set(matches)]
  return unique.slice(0, 15)
}

function extractSnsLinks(html: string): string[] {
  const links: string[] = []
  for (const pattern of SNS_PATTERNS) {
    const matches = html.match(pattern)
    if (matches) links.push(...matches)
  }
  return [...new Set(links)].slice(0, 5)
}

// ---------------------------------------------------------------------------
// Structured HP Content
// ---------------------------------------------------------------------------

export interface StructuredHpContent {
  title: string
  description: string
  facilityInfo: string[]
  menuInfo: string[]
  snsLinks: string[]
  bodyText: string
  additionalPages: { path: string; text: string }[]
}

async function fetchSinglePage(url: string, timeoutMs = 10000): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en;q=0.9',
      },
    })
    clearTimeout(timeout)
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

const ADDITIONAL_PATHS = ['/menu', '/price', '/about', '/food', '/drink', '/facility']

/**
 * メインURL + 追加ページをまとめて取得し、構造化データを返す
 */
export async function fetchStructuredHpContent(
  url: string,
  maxBodyChars = 6000
): Promise<StructuredHpContent | null> {
  try {
    const mainHtml = await fetchSinglePage(url, 12000)
    if (!mainHtml) return null

    const { title, description } = extractMeta(mainHtml)
    const bodyText = stripHtml(mainHtml)

    // Extract structured sections from main page
    const facilityInfo = extractSectionByKeywords(bodyText, FACILITY_KEYWORDS)
    const menuInfo = extractSectionByKeywords(bodyText, MENU_KEYWORDS)
    const snsLinks = extractSnsLinks(mainHtml)

    // Fetch additional pages in parallel (best-effort)
    const baseUrl = new URL(url).origin
    const additionalPages: { path: string; text: string }[] = []

    const additionalResults = await Promise.allSettled(
      ADDITIONAL_PATHS.map(async (path) => {
        const html = await fetchSinglePage(`${baseUrl}${path}`, 8000)
        if (!html) return null
        const text = stripHtml(html)
        if (text.length < 50) return null // Nearly empty page
        return { path, text: text.slice(0, 2000) }
      })
    )

    for (const result of additionalResults) {
      if (result.status === 'fulfilled' && result.value) {
        additionalPages.push(result.value)
        // Also extract menu info from sub-pages
        const subMenuInfo = extractSectionByKeywords(result.value.text, MENU_KEYWORDS)
        menuInfo.push(...subMenuInfo)
      }
    }

    return {
      title,
      description,
      facilityInfo: [...new Set(facilityInfo)].slice(0, 10),
      menuInfo: [...new Set(menuInfo)].slice(0, 15),
      snsLinks,
      bodyText: bodyText.slice(0, maxBodyChars),
      additionalPages,
    }
  } catch {
    return null
  }
}

/**
 * 構造化データをプロンプト用テキストに変換
 */
export function formatStructuredContent(content: StructuredHpContent): string {
  const parts: string[] = []

  if (content.title) parts.push(`タイトル: ${content.title}`)
  if (content.description) parts.push(`説明: ${content.description}`)

  if (content.facilityInfo.length > 0) {
    parts.push('', '【施設特徴】')
    content.facilityInfo.forEach(info => parts.push(`- ${info}`))
  }

  if (content.menuInfo.length > 0) {
    parts.push('', '【メニュー・価格・ドリンク・フード情報】')
    content.menuInfo.forEach(info => parts.push(`- ${info}`))
  }

  if (content.snsLinks.length > 0) {
    parts.push('', '【SNS】')
    content.snsLinks.forEach(link => parts.push(`- ${link}`))
  }

  if (content.additionalPages.length > 0) {
    for (const page of content.additionalPages) {
      parts.push('', `【サブページ: ${page.path}】`)
      parts.push(page.text.slice(0, 1000))
    }
  }

  parts.push('', '【HPテキスト本文（抜粋）】')
  parts.push(content.bodyText.slice(0, 3000))

  return parts.join('\n')
}

/**
 * 後方互換: 旧fetchHpContentと同じインターフェース
 */
export async function fetchHpContent(
  url: string,
  maxBodyChars = 6000
): Promise<string | null> {
  const structured = await fetchStructuredHpContent(url, maxBodyChars)
  if (!structured) return null
  return formatStructuredContent(structured)
}
