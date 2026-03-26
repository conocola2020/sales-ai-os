import fs from 'fs'
import path from 'path'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import type { Browser, Page } from 'puppeteer'

puppeteer.use(StealthPlugin())

// ── Config ──────────────────────────────────────────
const DELAY_MS = 2000
const NAV_TIMEOUT = 25000
const SAVE_INTERVAL = 50
const COOKIE_FILE = path.join(__dirname, '.sauna-cookies.json')

// ── CSV helpers ─────────────────────────────────────
function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++ }
      else if (ch === '"') inQuotes = false
      else current += ch
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { fields.push(current); current = '' }
      else current += ch
    }
  }
  fields.push(current)
  return fields
}

function escapeCSVField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n'))
    return '"' + field.replace(/"/g, '""') + '"'
  return field
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

function saveCSV(csvPath: string, header: string, rows: string[][]) {
  const out = [header, ...rows.map((r) => r.map(escapeCSVField).join(','))].join('\n') + '\n'
  fs.writeFileSync(csvPath, out, 'utf-8')
}

// ── Extract HP URL ───────────────────────────────────
function extractOfficialHP(html: string): string | null {
  // サウナイキタイの基本情報にある "HP" ラベル直後のリンク
  const patterns = [
    /HP\s*<\/(?:dt|th|span|div|p|a|label)[^>]*>[\s\S]{0,500}?<a[^>]*href=["'](https?:\/\/[^"']+)["']/i,
    />\s*HP\s*<\/[^>]+>[\s\S]{0,500}?href=["'](https?:\/\/[^"']+)["']/i,
    /<a[^>]*href=["'](https?:\/\/(?!.*sauna-ikitai\.com)[^"']+)["'][^>]*>[^<]*(?:公式|ホームページ)/i,
  ]
  for (const p of patterns) {
    const m = html.match(p)
    if (m && !m[1].includes('sauna-ikitai.com')) return m[1]
  }

  // Fallback: first external link (exclude known platforms)
  const exclude = /sauna-ikitai\.com|google\.|rakuten\.|facebook\.|twitter\.|instagram\.|youtube\.|line\.me|apple\.|amazon\.|googletagmanager|googleapis|gstatic|cloudflare|jsdelivr|bootstrapcdn|awswaf|sentry|hotjar|clarity|doubleclick|adsense/i
  for (const m of html.matchAll(/<a[^>]*href=["'](https?:\/\/[^"']+)["']/gi)) {
    if (!exclude.test(m[1])) return m[1]
  }
  return null
}

// ── Extract email ────────────────────────────────────
function extractEmails(html: string): string[] {
  const emailRe = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
  const mailto = [...html.matchAll(/mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi)].map((m) => m[1].toLowerCase())
  const cleaned = html.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, '')
  const text = [...cleaned.matchAll(emailRe)].map((m) => m[0].toLowerCase())
  const noise = /example\.com|test\.com|email\.com|sentry\.|wixpress|w3\.org|schema\.org|noreply|no-reply|@x\.|@[0-9]/i
  return [...new Set([...mailto, ...text])].filter((e) => !noise.test(e) && !/\.(png|jpg|svg|gif)$/i.test(e))
}

// ── Extract phone ────────────────────────────────────
function extractPhone(html: string): string | null {
  const tel = html.match(/<a[^>]*href=["']tel:([^"']+)["']/i)
  if (tel) return tel[1].replace(/[ー−\s]/g, '-')
  const ph = html.match(/(?:TEL|tel|電話|☎)[^0-9]*(\d{2,4}[-ー]?\d{2,4}[-ー]?\d{3,4})/i)
  if (ph) return ph[1].replace(/[ー−]/g, '-')
  return null
}

// ── Plain fetch (for official HP, no WAF) ────────────
async function fetchHtml(url: string): Promise<string | null> {
  try {
    const c = new AbortController()
    const t = setTimeout(() => c.abort(), 15000)
    const r = await fetch(url, {
      signal: c.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html', 'Accept-Language': 'ja,en;q=0.9',
      },
      redirect: 'follow',
    })
    clearTimeout(t)
    if (!r.ok) return null
    return Buffer.from(await r.arrayBuffer()).toString('utf-8')
  } catch { return null }
}

// ── Safe page.title() wrapper ────
async function safeTitle(page: Page): Promise<string> {
  try { return await page.title() } catch { return '' }
}

// ── Puppeteer: navigate with WAF/CAPTCHA handling ────
async function navigateSauna(page: Page, url: string): Promise<string | null> {
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: NAV_TIMEOUT })
  } catch (e: any) {
    // Navigation failed - try to recover
    console.log(`  ⚠ ナビゲーション警告: ${e.message?.slice(0, 80)}`)
    await sleep(2000)
  }

  // Check if real content loaded
  const title = await safeTitle(page)
  if (title && title !== 'Human Verification' && title !== '') {
    try { return await page.content() } catch { return null }
  }

  // WAF challenge page - wait for auto-resolve
  if (title === '') {
    await sleep(3000)
    try { await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }) } catch {}
    const t2 = await safeTitle(page)
    if (t2 && t2 !== 'Human Verification') {
      try { return await page.content() } catch { return null }
    }
  }

  // CAPTCHA page - need manual solving
  if (await safeTitle(page) === 'Human Verification') {
    console.log('  🔒 CAPTCHA検知 - 手動で解いてください...')
    for (let w = 0; w < 60; w++) {
      await sleep(2000)
      const currentTitle = await safeTitle(page)
      if (currentTitle !== 'Human Verification' && currentTitle !== '') {
        console.log('  ✅ CAPTCHA通過!')
        try {
          const cookies = await page.cookies()
          fs.writeFileSync(COOKIE_FILE, JSON.stringify(cookies), 'utf-8')
        } catch {}
        try { return await page.content() } catch { return null }
      }
    }
    console.log('  ⏰ CAPTCHA タイムアウト')
    return null
  }

  try { return await page.content() } catch { return null }
}

// ── Main ─────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2)
  const limitIdx = args.indexOf('--limit')
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity
  const startIdx = args.indexOf('--start')
  const startFrom = startIdx >= 0 ? parseInt(args[startIdx + 1], 10) - 1 : 0

  let csvPath = path.resolve(process.cwd(), 'sauna_leads.csv')
  if (!fs.existsSync(csvPath)) {
    const alt = path.resolve(process.cwd(), '..', '..', '..', 'sauna_leads.csv')
    if (fs.existsSync(alt)) csvPath = alt
    else { console.error('CSV not found'); process.exit(1) }
  }

  console.log(`\n📄 CSV: ${csvPath}`)
  const raw = fs.readFileSync(csvPath, 'utf-8')
  const lines = raw.split('\n').filter((l) => l.trim())
  const header = lines[0]
  const rows = lines.slice(1).map(parseCSVLine)

  const COL_EMAIL = 2, COL_PHONE = 3, COL_URL = 4
  const endIdx = Math.min(rows.length, startFrom + limit)
  console.log(`🔍 ${startFrom + 1}〜${endIdx}件目を処理（全${rows.length}件）\n`)

  // Launch VISIBLE browser so user can solve CAPTCHA
  console.log('🚀 ブラウザ起動中（CAPTCHAが出たら手動で解いてください）...')
  const browser: Browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled', '--window-size=1280,900'],
    defaultViewport: { width: 1280, height: 800 },
  })
  const page: Page = await browser.newPage()

  // Restore cookies if available
  if (fs.existsSync(COOKIE_FILE)) {
    try {
      const cookies = JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf-8'))
      await page.setCookie(...cookies)
      console.log('  🍪 前回のクッキーを復元\n')
    } catch {}
  }

  let hpFound = 0, emailFound = 0, phoneFound = 0

  try {
    for (let i = startFrom; i < endIdx; i++) {
      const row = rows[i]
      const name = row[0]
      const url = row[COL_URL]

      console.log(`[${i + 1}/${endIdx}] ${name}`)

      if (!url || !url.includes('sauna-ikitai.com')) {
        console.log('  ⏭ スキップ\n')
        continue
      }

      try {
        // Step 1: Get サウナイキタイ page
        const html = await navigateSauna(page, url)
        if (!html || html.length < 5000) {
          console.log('  ❌ 取得失敗\n')
          await sleep(DELAY_MS)
          continue
        }

        // Step 2: Extract HP
        const hp = extractOfficialHP(html)
        if (hp) {
          console.log(`  公式HP: ${hp}`)
          row[COL_URL] = hp
          hpFound++
        } else {
          console.log('  公式HP: —')
        }

        // Step 3: Phone from ikitai page
        const phone = extractPhone(html)
        if (phone && !row[COL_PHONE]) {
          row[COL_PHONE] = phone
          phoneFound++
        }

        // Step 4: Email from ikitai + official HP
        let emails = extractEmails(html)
        if (hp) {
          await sleep(1000)
          const hpHtml = await fetchHtml(hp)
          if (hpHtml) {
            emails = [...new Set([...emails, ...extractEmails(hpHtml)])]
            if (emails.length === 0) {
              try {
                const base = new URL(hp).origin
                for (const cp of ['/contact', '/contact/', '/inquiry']) {
                  const ch = await fetchHtml(base + cp)
                  if (ch) { const ce = extractEmails(ch); if (ce.length) { emails = ce; break } }
                  await sleep(500)
                }
              } catch {}
            }
          }
        }

        if (emails.length > 0) {
          console.log(`  メール: ${emails[0]} ✅`)
          row[COL_EMAIL] = emails[0]
          emailFound++
        } else {
          console.log('  メール: —')
        }
      } catch (entryError: any) {
        console.log(`  ⚠ エラー（スキップ）: ${entryError.message?.slice(0, 100)}\n`)
        await sleep(DELAY_MS)
        continue
      }

      console.log('')

      // Periodic save
      const processed = i - startFrom + 1
      if (processed % SAVE_INTERVAL === 0) {
        saveCSV(csvPath, header, rows)
        console.log(`  💾 保存済み (${i + 1}件目)\n`)
      }

      await sleep(DELAY_MS)
    }
  } finally {
    // Always save on exit
    saveCSV(csvPath, header, rows)
    await browser.close()
  }

  console.log('─'.repeat(50))
  console.log(`✅ 完了: ${Math.min(endIdx, rows.length) - startFrom}件処理`)
  console.log(`  公式HP: ${hpFound}件  電話: ${phoneFound}件  メール: ${emailFound}件`)
  console.log(`  CSV: ${csvPath}`)
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1) })
