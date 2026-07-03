/**
 * カフェ見込み顧客 昇格スクリプト（cafe_prospects → leads）
 *
 * 連絡先抽出済み（contact_method あり）の cafe_prospects を leads に昇格し、
 * 既存の送信パイプライン（文面生成 → send_queue → フォーム送信）に乗せられる状態にする。
 *
 * このスクリプトは leads を作るだけで、send_queue には一切触れない（送信しない）。
 *
 * npm run promote:cafe -- --method form --limit 10 --dry-run
 * npm run promote:cafe -- --method form
 * npm run promote:cafe -- --method form,manual,email
 */

import { createClient } from '@supabase/supabase-js'

// ─── 設定 ─────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const FETCH_PAGE_SIZE = 500
const VALID_METHODS = ['form', 'manual', 'email', 'instagram'] as const

const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null

// ─── 型定義 ─────────────────────────────────

interface CliOptions {
  methods: string[]
  limit: number | null
  dryRun: boolean
  userId: string
}

interface ProspectRow {
  id: string
  name: string
  website: string | null
  phone: string | null
  email: string | null
  contact_form_url: string | null
  instagram_url: string | null
  contact_method: string
}

interface ExistingLead {
  id: string
  company_name: string
  company_url: string | null
  website_url: string | null
}

// ─── 状態 ───────────────────────────────────

const startedAt = Date.now()
const stats = {
  promoted: 0,
  linkedExisting: 0,
  skippedNameDup: 0,
  errors: 0,
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

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return min > 0 ? `${min}分${sec}秒` : `${sec}秒`
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2)
  const methodsRaw = getArg(args, '--method') || 'form'
  const methods = methodsRaw.split(',').map(m => m.trim()).filter(Boolean)

  const invalid = methods.filter(m => !VALID_METHODS.includes(m as (typeof VALID_METHODS)[number]))
  if (invalid.length > 0) {
    console.error(`❌ 不正な --method: ${invalid.join(', ')}`)
    console.error(`   利用可能: ${VALID_METHODS.join(', ')}`)
    process.exit(1)
  }

  return {
    methods,
    limit: parsePositiveInt(getArg(args, '--limit'), null),
    dryRun: hasFlag(args, '--dry-run'),
    userId: getArg(args, '--user-id') || process.env.OWNER_USER_ID || '',
  }
}

/** URL照合用の正規化（プロトコル・www・末尾スラッシュを無視） */
function normalizeUrl(url: string | null): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '').toLowerCase()
    const path = u.pathname.replace(/\/+$/, '')
    return `${host}${path}`
  } catch {
    return url.trim().toLowerCase() || null
  }
}

// ─── DB ─────────────────────────────────────

async function fetchAllPages<T>(fetchPage: (offset: number) => Promise<T[]>): Promise<T[]> {
  const rows: T[] = []
  let offset = 0
  while (true) {
    const page = await fetchPage(offset)
    rows.push(...page)
    if (page.length < FETCH_PAGE_SIZE) return rows
    offset += FETCH_PAGE_SIZE
  }
}

async function fetchTargets(opts: CliOptions): Promise<ProspectRow[]> {
  if (!supabase) throw new Error('Supabase 接続情報がありません')

  const all = await fetchAllPages<ProspectRow>(async offset => {
    const { data, error } = await supabase!
      .from('cafe_prospects')
      .select('id, name, website, phone, email, contact_form_url, instagram_url, contact_method')
      .eq('user_id', opts.userId)
      .eq('status', 'untouched')
      .is('lead_id', null)
      .in('contact_method', opts.methods)
      .order('created_at', { ascending: true })
      .range(offset, offset + FETCH_PAGE_SIZE - 1)
    if (error) throw new Error(`対象取得エラー: ${error.message}`)
    return (data || []) as ProspectRow[]
  })

  return opts.limit ? all.slice(0, opts.limit) : all
}

async function fetchExistingLeads(opts: CliOptions): Promise<ExistingLead[]> {
  return fetchAllPages<ExistingLead>(async offset => {
    const { data, error } = await supabase!
      .from('leads')
      .select('id, company_name, company_url, website_url')
      .eq('user_id', opts.userId)
      .range(offset, offset + FETCH_PAGE_SIZE - 1)
    if (error) throw new Error(`既存リード取得エラー: ${error.message}`)
    return (data || []) as ExistingLead[]
  })
}

async function markPromoted(prospectId: string, leadId: string, opts: CliOptions): Promise<void> {
  const { error } = await supabase!
    .from('cafe_prospects')
    .update({ status: 'promoted', lead_id: leadId, updated_at: new Date().toISOString() })
    .eq('id', prospectId)
    .eq('user_id', opts.userId)
  if (error) throw new Error(`昇格マークエラー: ${error.message}`)
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

  console.log('⬆️  cafe_prospects → leads 昇格を開始します')
  console.log(`   モード: ${opts.dryRun ? 'dry-run（DB更新なし）' : '本番（DB更新あり）'}`)
  console.log(`   対象 contact_method: ${opts.methods.join(', ')} / 上限: ${opts.limit ?? 'なし（全件）'}`)
  console.log('')

  const [targets, existingLeads] = await Promise.all([
    fetchTargets(opts),
    fetchExistingLeads(opts),
  ])

  // 既存リードの照合インデックス（URL / 名前）
  const leadsByUrl = new Map<string, ExistingLead>()
  const leadsByName = new Map<string, ExistingLead>()
  for (const lead of existingLeads) {
    for (const url of [lead.company_url, lead.website_url]) {
      const key = normalizeUrl(url)
      if (key && !leadsByUrl.has(key)) leadsByUrl.set(key, lead)
    }
    const nameKey = lead.company_name.trim()
    if (nameKey && !leadsByName.has(nameKey)) leadsByName.set(nameKey, lead)
  }

  console.log(`   対象: ${targets.length}件 / 既存リード: ${existingLeads.length}件（重複照合用）`)
  console.log('')

  if (targets.length === 0) {
    console.log('処理対象がありません。')
    return
  }

  for (let i = 0; i < targets.length; i++) {
    const p = targets[i]
    const label = `[${i + 1}/${targets.length}] ${p.name}`

    try {
      // 1. URL一致 → 既存リードに紐付け（新規作成しない）
      const urlKey = normalizeUrl(p.website)
      const byUrl = urlKey ? leadsByUrl.get(urlKey) : undefined
      if (byUrl) {
        console.log(`${label} → 既存リードに紐付け（URL一致: ${byUrl.company_name}）`)
        if (!opts.dryRun) await markPromoted(p.id, byUrl.id, opts)
        stats.linkedExisting++
        continue
      }

      // 2. 名前完全一致 → 誤紐付けリスクがあるためスキップ（手動確認）
      const byName = leadsByName.get(p.name.trim())
      if (byName) {
        console.log(`${label} → ⚠️ スキップ（既存リードと名前一致・要手動確認: lead ${byName.id}）`)
        stats.skippedNameDup++
        continue
      }

      // 3. 新規リード作成
      if (opts.dryRun) {
        console.log(`${label} → 昇格（dry-run: ${p.contact_method} / ${p.website || 'HPなし'}）`)
        stats.promoted++
        continue
      }

      const { data: inserted, error } = await supabase
        .from('leads')
        .insert({
          user_id: opts.userId,
          company_name: p.name,
          email: p.email,
          phone: p.phone,
          website_url: p.website,
          company_url: p.website,
          contact_url: p.contact_form_url,
          contact_method: p.contact_method,
          industry: 'カフェ',
          status: '未着手',
          notes: '愛知カフェVol.1（Google Places収集）から昇格',
        })
        .select('id')
        .single()

      if (error || !inserted) {
        throw new Error(error?.message || 'insert が空応答')
      }

      await markPromoted(p.id, inserted.id, opts)

      // 同一実行内の重複作成も防ぐ
      if (urlKey) leadsByUrl.set(urlKey, { id: inserted.id, company_name: p.name, company_url: p.website, website_url: p.website })
      leadsByName.set(p.name.trim(), { id: inserted.id, company_name: p.name, company_url: p.website, website_url: p.website })

      console.log(`${label} → ✅ 昇格（${p.contact_method}）`)
      stats.promoted++
    } catch (err) {
      stats.errors++
      const message = err instanceof Error ? err.message : 'unknown error'
      console.error(`${label} → ❌ エラー: ${message}`)
    }
  }

  const total = targets.length
  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✅ 昇格 完了')
  console.log(`   対象: ${total}件`)
  console.log(`   ├ 新規リード作成: ${stats.promoted}件`)
  console.log(`   ├ 既存リードに紐付け: ${stats.linkedExisting}件`)
  console.log(`   ├ スキップ（名前重複・要確認）: ${stats.skippedNameDup}件`)
  console.log(`   └ エラー: ${stats.errors}件`)
  console.log(`   所要時間: ${formatDuration(Date.now() - startedAt)}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  if (!opts.dryRun && stats.promoted > 0) {
    console.log('')
    console.log('次のステップ: リード一覧から文面生成 → 送信キュー追加（send_queue はこのスクリプトでは触っていません）')
  }
}

main().catch(err => {
  console.error('❌ エラー:', err)
  process.exit(1)
})
