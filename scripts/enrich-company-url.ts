/**
 * 既存リードの company_url を一括取得・更新するスクリプト
 *
 * サウナイキタイの施設ページ (website_url) から公式HPのURLを抽出し、
 * leads テーブルの company_url カラムに保存する。
 *
 * 使い方:
 *   npx tsx scripts/enrich-company-url.ts [--limit N] [--start N] [--dry-run]
 *
 * 環境変数:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import type { Browser, Page } from 'puppeteer'
import fs from 'fs'
import path from 'path'

puppeteer.use(StealthPlugin())

// ── Config ──────────────────────────────────────────
const DELAY_MS = 2000
const NAV_TIMEOUT = 25000
const BATCH_SIZE = 100
const COOKIE_FILE = path.join(__dirname, '.sauna-cookies.json')

// ── Supabase ────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください')
  process.exit(1)
}

// Supabase REST API を直接使う（依存を最小化）
async function supabaseSelect(table: string, query: string): Promise<any[]> {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY!,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
  })
  if (!res.ok) throw new Error(`Supabase SELECT error: ${res.status} ${await res.text()}`)
  return res.json()
}

async function supabaseUpdate(table: string, id: string, data: Record<string, unknown>): Promise<void> {
  const url = `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY!,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`Supabase UPDATE error: ${res.status} ${await res.text()}`)
}

// ── Helpers ─────────────────────────────────────────
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

function normalizeUrl(url: string): string {
  let cleaned = url.replace(/&amp;/g, '&')
  try {
    const parsed = new URL(cleaned)
    for (const key of [...parsed.searchParams.keys()]) {
      if (key.startsWith('utm_')) parsed.searchParams.delete(key)
    }
    // サブページはルートドメインに変換
    if (parsed.pathname.split('/').filter(Boolean).length > 1) {
      return parsed.origin + '/'
    }
    const result = parsed.toString()
    return result.endsWith('?') ? result.slice(0, -1) : result
  } catch { return cleaned }
}

async function safeTitle(page: Page): Promise<string> {
  try { return await page.title() } catch { return '' }
}

// ── Extract HP URL ──────────────────────────────────
function extractOfficialHP(html: string): string | null {
  const patterns = [
    /HP\s*<\/(?:dt|th|span|div|p|a|label)[^>]*>[\s\S]{0,500}?<a[^>]*href=["'](https?:\/\/[^"']+)["']/i,
    />\s*HP\s*<\/[^>]+>[\s\S]{0,500}?href=["'](https?:\/\/[^"']+)["']/i,
    /<a[^>]*href=["'](https?:\/\/(?!.*sauna-ikitai\.com)[^"']+)["'][^>]*>[^<]*(?:公式|ホームページ)/i,
  ]
  for (const p of patterns) {
    const m = html.match(p)
    if (m && !m[1].includes('sauna-ikitai.com')) return m[1]
  }

  const exclude = /sauna-ikitai\.com|google\.|rakuten\.|facebook\.|twitter\.|instagram\.|youtube\.|line\.me|apple\.|amazon\.|googletagmanager|googleapis|gstatic|cloudflare|jsdelivr|bootstrapcdn|awswaf|sentry|hotjar|clarity|doubleclick|adsense/i
  for (const m of html.matchAll(/<a[^>]*href=["'](https?:\/\/[^"']+)["']/gi)) {
    if (!exclude.test(m[1])) return m[1]
  }
  return null
}

// ── Puppeteer navigation with WAF/CAPTCHA handling ──
async function navigateSauna(page: Page, url: string): Promise<string | null> {
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: NAV_TIMEOUT })
  } catch (e: any) {
    console.log(`  ⚠ ナビゲーション警告: ${e.message?.slice(0, 80)}`)
    await sleep(2000)
  }

  const title = await safeTitle(page)
  if (title && title !== 'Human Verification' && title !== '') {
    try { return await page.content() } catch { return null }
  }

  if (title === '') {
    await sleep(3000)
    try { await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }) } catch {}
    const t2 = await safeTitle(page)
    if (t2 && t2 !== 'Human Verification') {
      try { return await page.content() } catch { return null }
    }
  }

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

// ── Main ────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2)
  const limitIdx = args.indexOf('--limit')
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity
  const startIdx = args.indexOf('--start')
  const startFrom = startIdx >= 0 ? parseInt(args[startIdx + 1], 10) : 0
  const dryRun = args.includes('--dry-run')

  // company_url が null で website_url にサウナイキタイを含むリードを取得
  console.log('\n📊 Supabaseからリードを取得中...')

  let allLeads: any[] = []
  let offset = 0

  while (true) {
    const batch = await supabaseSelect(
      'leads',
      `select=id,company_name,website_url,company_url&website_url=like.*sauna-ikitai.com*&company_url=is.null&order=created_at.asc&offset=${offset}&limit=${BATCH_SIZE}`
    )
    allLeads = allLeads.concat(batch)
    if (batch.length < BATCH_SIZE) break
    offset += BATCH_SIZE
  }

  // Also get leads with empty string company_url
  offset = 0
  while (true) {
    const batch = await supabaseSelect(
      'leads',
      `select=id,company_name,website_url,company_url&website_url=like.*sauna-ikitai.com*&company_url=eq.&order=created_at.asc&offset=${offset}&limit=${BATCH_SIZE}`
    )
    allLeads = allLeads.concat(batch)
    if (batch.length < BATCH_SIZE) break
    offset += BATCH_SIZE
  }

  console.log(`📋 対象リード: ${allLeads.length}件`)

  // Apply start/limit
  const leads = allLeads.slice(startFrom, startFrom + (limit === Infinity ? allLeads.length : limit))
  console.log(`🔍 処理対象: ${startFrom + 1}〜${startFrom + leads.length}件目\n`)

  if (leads.length === 0) {
    console.log('✅ 処理対象のリードがありません')
    return
  }

  if (dryRun) {
    console.log('🏃 ドライラン - 最初の10件を表示:')
    leads.slice(0, 10).forEach((l: any, i: number) => {
      console.log(`  ${i + 1}. ${l.company_name} → ${l.website_url}`)
    })
    return
  }

  // Launch browser
  console.log('🚀 ブラウザ起動中（CAPTCHAが出たら手動で解いてください）...')
  const browser: Browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled', '--window-size=1280,900'],
    defaultViewport: { width: 1280, height: 800 },
  })
  const page: Page = await browser.newPage()

  // Restore cookies
  if (fs.existsSync(COOKIE_FILE)) {
    try {
      const cookies = JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf-8'))
      await page.setCookie(...cookies)
      console.log('  🍪 前回のクッキーを復元\n')
    } catch {}
  }

  let found = 0
  let failed = 0
  let skipped = 0

  try {
    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i]
      console.log(`[${startFrom + i + 1}/${startFrom + leads.length}] ${lead.company_name}`)
      console.log(`  サウナイキタイ: ${lead.website_url}`)

      if (!lead.website_url || !lead.website_url.includes('sauna-ikitai.com')) {
        console.log('  ⏭ スキップ\n')
        skipped++
        continue
      }

      try {
        const html = await navigateSauna(page, lead.website_url)
        if (!html || html.length < 5000) {
          console.log('  ❌ ページ取得失敗\n')
          failed++
          await sleep(DELAY_MS)
          continue
        }

        const hp = extractOfficialHP(html)
        if (hp) {
          const normalized = normalizeUrl(hp)
          console.log(`  ✅ 公式HP: ${normalized}`)
          await supabaseUpdate('leads', lead.id, { company_url: normalized })
          console.log('  💾 DB更新完了\n')
          found++
        } else {
          console.log('  ⚠ 公式HP見つからず\n')
          failed++
        }
      } catch (err: any) {
        console.log(`  ❌ エラー: ${err.message?.slice(0, 100)}\n`)
        failed++
      }

      await sleep(DELAY_MS)
    }
  } finally {
    await browser.close()
  }

  console.log('─'.repeat(50))
  console.log(`✅ 完了: ${leads.length}件処理`)
  console.log(`  公式HP取得: ${found}件`)
  console.log(`  取得失敗: ${failed}件`)
  console.log(`  スキップ: ${skipped}件`)
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1) })
