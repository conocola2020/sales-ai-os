/**
 * Instagram 橋渡しスクリプト（Phase 3B）
 *
 * prospects のうち「Instagram が唯一の連絡手段」の行（contact_method='instagram'）を
 * instagram_targets に登録し、既存の Instagram DM 基盤（安全システム・DmModal・
 * ig.me 半自動送信）でそのまま運用できるようにする。
 *
 * - DM送信は一切しない（登録のみ）。送信ペースは instagram_safety_settings が律速する
 * - form/email 組はフォーム送信パイプライン側で扱うため対象外（同一店への二重アプローチ防止）
 * - 重複は UNIQUE (user_id, username)（migration 020）+ ignoreDuplicates で排除
 *
 * npm run bridge:instagram -- --limit 20 --dry-run
 * npm run bridge:instagram -- --industry 焼肉
 * npm run bridge:instagram
 */

import { createClient } from '@supabase/supabase-js'
import { extractUsername } from '../src/lib/instagram-detector'

// ─── 設定 ─────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const FETCH_PAGE_SIZE = 500
const UPSERT_CHUNK = 500

/** Instagramの予約パス（ユーザー名として無効） */
const RESERVED_USERNAMES = new Set([
  'p', 'reel', 'reels', 'explore', 'stories', 'accounts', 'direct', 'tv',
])

const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null

// ─── 型定義 ─────────────────────────────────

interface CliOptions {
  industry: string | null
  limit: number | null
  dryRun: boolean
  userId: string
}

interface ProspectRow {
  id: string
  name: string
  formatted_address: string | null
  website: string | null
  instagram_url: string | null
  industry: string | null
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

function parseArgs(): CliOptions {
  const args = process.argv.slice(2)
  return {
    industry: getArg(args, '--industry'),
    limit: parsePositiveInt(getArg(args, '--limit'), null),
    dryRun: hasFlag(args, '--dry-run'),
    userId: getArg(args, '--user-id') || process.env.OWNER_USER_ID || '',
  }
}

/** instagram_url からユーザー名を抽出・正規化（無効なら null） */
function toUsername(instagramUrl: string): string | null {
  const raw = extractUsername(instagramUrl)
  if (!raw) return null
  const username = raw.replace(/^@/, '').trim().toLowerCase()
  if (!username || RESERVED_USERNAMES.has(username)) return null
  if (!/^[a-z0-9_.]+$/.test(username)) return null
  return username
}

// ─── DB ─────────────────────────────────────

async function fetchTargets(opts: CliOptions): Promise<ProspectRow[]> {
  if (!supabase) throw new Error('Supabase 接続情報がありません')

  const rows: ProspectRow[] = []
  let offset = 0
  while (true) {
    let query = supabase
      .from('prospects')
      .select('id, name, formatted_address, website, instagram_url, industry')
      .eq('user_id', opts.userId)
      .eq('status', 'untouched')
      .eq('contact_method', 'instagram')
      .not('instagram_url', 'is', null)
      .order('created_at', { ascending: true })
      .range(offset, offset + FETCH_PAGE_SIZE - 1)
    if (opts.industry) {
      query = query.eq('industry', opts.industry)
    }
    const { data, error } = await query
    if (error) throw new Error(`対象取得エラー: ${error.message}`)
    rows.push(...((data || []) as ProspectRow[]))
    if (opts.limit && rows.length >= opts.limit) return rows.slice(0, opts.limit)
    if (!data || data.length < FETCH_PAGE_SIZE) return rows
    offset += FETCH_PAGE_SIZE
  }
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

  console.log('📸 prospects → instagram_targets 橋渡しを開始します')
  console.log(`   モード: ${opts.dryRun ? 'dry-run（DB更新なし）' : '本番（DB更新あり）'}`)
  console.log(`   業種: ${opts.industry ?? '全業種'} / 上限: ${opts.limit ?? 'なし（全件）'}`)
  console.log('')

  const prospects = await fetchTargets(opts)
  console.log(`   対象: ${prospects.length}件（contact_method='instagram'・未昇格）`)

  // ユーザー名抽出 + スクリプト内重複排除（同一アカウントの多店舗は1件に）
  const byUsername = new Map<string, ProspectRow>()
  let invalid = 0
  for (const p of prospects) {
    const username = toUsername(p.instagram_url || '')
    if (!username) {
      invalid++
      console.log(`   ⚠️ ユーザー名を抽出できずスキップ: ${p.name}（${p.instagram_url}）`)
      continue
    }
    if (!byUsername.has(username)) byUsername.set(username, p)
  }
  const inBatchDup = prospects.length - invalid - byUsername.size

  console.log(`   抽出成功: ${byUsername.size}アカウント（無効${invalid} / 同一アカウント重複${inBatchDup}）`)
  console.log('')

  if (byUsername.size === 0) {
    console.log('登録対象がありません。')
    return
  }

  const rows = [...byUsername.entries()].map(([username, p]) => ({
    user_id: opts.userId,
    username,
    display_name: p.name,
    industry: p.industry,
    status: '未対応' as const,
    notes: `prospect:${p.id}${p.formatted_address ? ` / ${p.formatted_address}` : ''}`,
  }))

  if (opts.dryRun) {
    rows.slice(0, 20).forEach(row => console.log(`   [DRY] @${row.username} ← ${row.display_name}（${row.industry}）`))
    if (rows.length > 20) console.log(`   ... 他 ${rows.length - 20}件`)
    console.log('')
    console.log(`✅ dry-run 完了: ${rows.length}件が登録対象（DB更新なし）`)
    return
  }

  // 登録済み件数を差分で数える（ignoreDuplicates のため upsert 結果では判別できない）
  const { count: before } = await supabase
    .from('instagram_targets')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', opts.userId)

  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK)
    const { error } = await supabase
      .from('instagram_targets')
      .upsert(chunk, { onConflict: 'user_id,username', ignoreDuplicates: true })
    if (error) {
      console.error(`❌ 登録エラー（${chunk.length}件）: ${error.message}`)
      process.exit(1)
    }
    console.log(`   登録処理: ${Math.min(i + UPSERT_CHUNK, rows.length)}/${rows.length}`)
  }

  const { count: after } = await supabase
    .from('instagram_targets')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', opts.userId)

  const created = (after ?? 0) - (before ?? 0)
  const skipped = rows.length - created

  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✅ 橋渡し 完了')
  console.log(`   対象prospects: ${prospects.length}件`)
  console.log(`   ├ 新規登録: ${created}件`)
  console.log(`   ├ 既存と重複（スキップ）: ${skipped}件`)
  console.log(`   ├ 同一アカウント集約: ${inBatchDup}件`)
  console.log(`   └ ユーザー名抽出不可: ${invalid}件`)
  console.log('   ※ DM送信はしていません。送信は Instagram ダッシュボードから（安全システム準拠）')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main().catch(err => {
  console.error('❌ エラー:', err)
  process.exit(1)
})
