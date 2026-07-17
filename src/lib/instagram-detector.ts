/**
 * Instagram URL 検出モジュール
 *
 * 店舗HPのHTMLから店舗自身のInstagramアカウントURLを抽出する。
 * scripts/find-instagram-from-hp.ts から切り出した共通モジュール。
 */

const TIMEOUT_MS = 8000

export async function findInstagramUrl(websiteUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const res = await fetch(websiteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ja,en;q=0.9',
      },
      signal: controller.signal,
      redirect: 'follow',
    })
    clearTimeout(timeout)

    if (!res.ok) return null
    const html = await res.text()

    // Instagram URLパターンを探す（施設自身のアカウント）
    const patterns = [
      // href="https://www.instagram.com/username/"
      /href=["'](https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9_.]+\/?)['"]/gi,
      // content="https://www.instagram.com/username" (meta tags)
      /content=["'](https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9_.]+\/?)['"]/gi,
    ]

    const found = new Set<string>()
    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(html)) !== null) {
        let url = match[1].trim()
        // 末尾スラッシュを統一
        if (!url.endsWith('/')) url += '/'
        // 一般的なアカウント（instagram.com自体やハッシュタグページ等を除外）
        if (
          !url.includes('/p/') &&
          !url.includes('/explore/') &&
          !url.includes('/accounts/') &&
          !url.includes('/reel/') &&
          !url.includes('/stories/') &&
          url !== 'https://www.instagram.com/' &&
          url !== 'https://instagram.com/'
        ) {
          found.add(url)
        }
      }
    }

    // 最初に見つかったInstagram URLを返す
    return found.size > 0 ? [...found][0] : null
  } catch {
    return null
  }
}

export function extractUsername(igUrl: string): string {
  const match = igUrl.match(/instagram\.com\/([a-zA-Z0-9_.]+)/)
  return match ? match[1] : ''
}
