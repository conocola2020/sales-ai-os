/**
 * 見込み顧客 連絡先抽出スクリプト（Phase 3・業種汎用）
 *
 * prospects の website を巡回し、メール / 問い合わせフォーム / Instagram を
 * 抽出して email / contact_form_url / instagram_url / contact_method を埋める。
 *
 * npm run enrich:prospects -- --limit 10 --dry-run
 * npm run enrich:prospects -- --industry 焼肉 --limit 30
 * npm run enrich:prospects
 */

import { createClient } from '@supabase/supabase-js'
import { detectContact } from '../src/lib/contact-detector'
import { findInstagramUrl } from '../src/lib/instagram-detector'
import { classifyWebsite } from '../src/lib/website-classifier'

// ─── 設定 ─────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const CONCURRENCY = 3
const DELAY_BETWEEN_BATCHES_MS = 1500
const FETCH_PAGE_SIZE = 500

const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null

// ─── 型定義 ─────────────────────────────────

type ContactMethod = 'form' | 'email' | 'instagram' | 'manual' | 'none'

interface CliOptions {
  limit: number | null
  dryRun: boolean
  force: boolean
  userId: string
  verbose: boolean
  /** 指定時はこの業種のみ処理（未指定=全業種） */
  industry: string | null
}

interface TargetRow {
  id: string
  name: string
  website: string
}

interface EnrichResult {
  email: string | null
  contactFormUrl: string | null
  instagramUrl: string | null
  contactMethod: ContactMethod
  hasRecaptcha: boolean
  error: string | null
}

// ─── 状態 ───────────────────────────────────

const startedAt = Date.now()
const stats: Record<ContactMethod, number> & { processed: number; updateErrors: number } = {
  form: 0,
  manual: 0,
  email: 0,
  instagram: 0,
  none: 0,
  processed: 0,
  updateErrors: 0,
}

// ─── ヘルパ ─────────────────────────────────

function getArg(args: string[], name: string): string | null {
  const idx = args.indexOf(name)
  if (idx >= 0) return args[idx + 1] || null
  const prefixed = args.find(arg => arg.startsWith(`${name}=`))
  return prefixed ? prefixed.slice(name.length + 1) : null
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name)
}

function parsePositiveInt(value: string | null, fallback: number | null): number | null {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return min > 0 ? `${min}分${sec}秒` : `${sec}秒`
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2)
  return {
    limit: parsePositiveInt(getArg(args, '--limit'), null),
    dryRun: hasFlag(args, '--dry-run'),
    force: hasFlag(args, '--force'),
    userId: getArg(args, '--user-id') || process.env.OWNER_USER_ID || '',
    verbose: hasFlag(args, '--verbose'),
    industry: getArg(args, '--industry'),
  }
}

// website の種別判定は共通モジュール（src/lib/website-classifier.ts）を使用

// ─── 判定ロジック ─────────────────────────────

function decideContactMethod(r: {
  contactFormUrl: string | null
  hasRecaptcha: boolean
  email: string | null
  instagramUrl: string | null
}): ContactMethod {
  // フォームあり & recaptchaなし → 自動フォーム送信可能
  if (r.contactFormUrl && !r.hasRecaptcha) return 'form'
  // フォームあり & recaptchaあり → 自動送信不可（Chrome経由/手動）
  if (r.contactFormUrl && r.hasRecaptcha) return 'manual'
  if (r.email) return 'email'
  if (r.instagramUrl) return 'instagram'
  return 'none'
}

async function enrichOne(website: string): Promise<EnrichResult> {
  const classified = classifyWebsite(website)

  // website が Instagram プロフィール → それ自体が連絡先（巡回不要）
  if (classified.kind === 'instagram') {
    return {
      email: null,
      contactFormUrl: null,
      instagramUrl: classified.instagramUrl,
      contactMethod: classified.instagramUrl ? 'instagram' : 'none',
      hasRecaptcha: false,
      error: classified.instagramUrl ? null : 'InstagramのURLからユーザー名を特定できず',
    }
  }

  // SNS・グルメポータルは自社HPではない → 巡回しない（フォーム誤検出防止）
  if (classified.kind === 'sns' || classified.kind === 'portal') {
    return {
      email: null,
      contactFormUrl: null,
      instagramUrl: null,
      contactMethod: 'none',
      hasRecaptcha: false,
      error: `自社HPではない（${classified.hostname}）`,
    }
  }

  const [contact, instagramUrl] = await Promise.all([
    detectContact(website),
    findInstagramUrl(website),
  ])

  const contactFormUrl = contact.method === 'form' ? contact.contactUrl || null : null
  const email = contact.email || null
  const hasRecaptcha = contact.hasRecaptcha || false

  return {
    email,
    contactFormUrl,
    instagramUrl,
    contactMethod: decideContactMethod({ contactFormUrl, hasRecaptcha, email, instagramUrl }),
    hasRecaptcha,
    error: contact.error || null,
  }
}

// ─── DB ─────────────────────────────────────

async function fetchTargets(opts: CliOptions): Promise<TargetRow[]> {
  if (!supabase) throw new Error('Supabase 接続情報がありません')

  const targets: TargetRow[] = []
  let offset = 0

  while (true) {
    let query = supabase
      .from('prospects')
      .select('id, name, website')
      .eq('user_id', opts.userId)
      .eq('status', 'untouched')
      .not('website', 'is', null)
      .neq('website', '')
      .order('created_at', { ascending: true })
      .range(offset, offset + FETCH_PAGE_SIZE - 1)

    if (!opts.force) {
      query = query.is('contact_method', null)
    }
    if (opts.industry) {
      query = query.eq('industry', opts.industry)
    }

    const { data, error } = await query
    if (error) throw new Error(`対象取得エラー: ${error.message}`)

    targets.push(...((data || []) as TargetRow[]))

    if (opts.limit && targets.length >= opts.limit) {
      return targets.slice(0, opts.limit)
    }
    if (!data || data.length < FETCH_PAGE_SIZE) {
      return targets
    }
    offset += FETCH_PAGE_SIZE
  }
}

async function saveResult(row: TargetRow, result: EnrichResult, opts: CliOptions): Promise<void> {
  if (opts.dryRun || !supabase) return

  const { error } = await supabase
    .from('prospects')
    .update({
      email: result.email,
      contact_form_url: result.contactFormUrl,
      instagram_url: result.instagramUrl,
      contact_method: result.contactMethod,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id)
    .eq('user_id', opts.userId)

  if (error) {
    stats.updateErrors++
    console.error(`   ❌ DB更新エラー（${row.name}）: ${error.message}`)
  }
}

// ─── 出力 ───────────────────────────────────

function describeResult(r: EnrichResult): string {
  const parts: string[] = []
  if (r.contactFormUrl) {
    parts.push(r.hasRecaptcha ? 'form（recaptchaあり→manual）' : 'form（recaptchaなし）')
  }
  if (r.email) parts.push(`email: ${r.email}`)
  if (r.instagramUrl) parts.push('IG: あり')
  if (parts.length === 0) parts.push(r.error ? `none（${r.error}）` : 'none')
  return `${r.contactMethod} ← ${parts.join(' / ')}`
}

function printSummary(total: number): void {
  const reachable = stats.form + stats.manual + stats.email + stats.instagram
  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✅ 連絡先抽出 完了')
  console.log(`   処理: ${stats.processed}件 / 対象${total}件`)
  console.log(`   ├ form（自動送信可）: ${stats.form}件`)
  console.log(`   ├ manual（フォーム+recaptcha）: ${stats.manual}件`)
  console.log(`   ├ email: ${stats.email}件`)
  console.log(`   ├ instagram: ${stats.instagram}件`)
  console.log(`   └ none（連絡手段なし）: ${stats.none}件`)
  console.log(`   営業可能（none以外）: ${reachable}件 / ${stats.processed}件`)
  if (stats.updateErrors > 0) {
    console.log(`   ⚠️ DB更新エラー: ${stats.updateErrors}件`)
  }
  console.log(`   所要時間: ${formatDuration(Date.now() - startedAt)}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

// ─── メイン ─────────────────────────────────

async function main(): Promise<void> {
  const opts = parseArgs()

  if (!supabase) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が設定されていません')
    process.exit(1)
  }
  if (!opts.userId) {
    console.error('❌ OWNER_USER_ID（または --user-id）が設定されていません')
    process.exit(1)
  }

  console.log('🔍 連絡先抽出を開始します')
  console.log(`   モード: ${opts.dryRun ? 'dry-run（DB更新なし）' : '本番（DB更新あり）'}`)
  console.log(`   上限: ${opts.limit ?? 'なし（全件）'} / 再処理: ${opts.force ? 'あり（--force）' : 'なし'}`)
  console.log('')

  const targets = await fetchTargets(opts)
  console.log(`   対象: ${targets.length}件（website あり・status='untouched'${opts.force ? '' : '・未処理'}${opts.industry ? `・業種=${opts.industry}` : ''}）`)
  console.log('')

  if (targets.length === 0) {
    console.log('処理対象がありません。')
    return
  }

  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY)

    await Promise.all(
      batch.map(async (row, j) => {
        const index = i + j + 1
        try {
          const result = await enrichOne(row.website)
          stats[result.contactMethod]++
          stats.processed++
          console.log(`[${index}/${targets.length}] ${row.name}（${row.website}）`)
          console.log(`   → ${describeResult(result)}`)
          await saveResult(row, result, opts)
        } catch (err) {
          // enrichOne 内部で握りつぶせなかった想定外エラーも1件失敗として継続
          const message = err instanceof Error ? err.message : 'unknown error'
          const result: EnrichResult = {
            email: null,
            contactFormUrl: null,
            instagramUrl: null,
            contactMethod: 'none',
            hasRecaptcha: false,
            error: message,
          }
          stats.none++
          stats.processed++
          console.log(`[${index}/${targets.length}] ${row.name}（${row.website}）`)
          console.log(`   → none（エラー: ${message}）`)
          await saveResult(row, result, opts)
        }
      })
    )

    // 相手サーバーへの配慮（バッチ間で待機）
    if (i + CONCURRENCY < targets.length) {
      await sleep(DELAY_BETWEEN_BATCHES_MS)
    }
  }

  printSummary(targets.length)
}

main().catch(err => {
  console.error('❌ エラー:', err)
  printSummary(stats.processed)
  process.exit(1)
})
