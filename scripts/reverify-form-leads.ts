/**
 * フォーム型リードの再検証スクリプト
 *
 * 旧フォーム判定（formタグがあれば採用）はポータルの検索ボックス等を
 * 問い合わせフォームと誤検出していた。厳格化した detectContact で再判定し、
 * リード登録条件（メール or フォーム必須）を満たさなくなった行を整理する。
 *
 * 各リードの処理:
 *   - フォーム検出   → contact_url を更新して維持
 *   - メールのみ検出 → contact_method='email' に降格
 *   - どちらも無し   → リード削除（元prospectがIGを持てばIG管理へ戻す）
 *
 * npm run reverify:leads -- --company ツムグ --dry-run
 * npm run reverify:leads -- --suspicious --limit 30
 * npm run reverify:leads -- --suspicious
 */

import { createClient } from '@supabase/supabase-js'
import { detectContact, isTrustedFormHost } from '../src/lib/contact-detector'
import { classifyWebsite } from '../src/lib/website-classifier'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const CONCURRENCY = 3
const DELAY_BETWEEN_BATCHES_MS = 1200
const FETCH_PAGE_SIZE = 500

const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null

interface CliOptions {
  suspiciousOnly: boolean
  limit: number | null
  dryRun: boolean
  company: string | null
  userId: string
}

interface LeadRow {
  id: string
  company_name: string
  website_url: string | null
  contact_url: string | null
  email: string | null
}

const stats = { keptForm: 0, urlFixed: 0, demotedEmail: 0, deleted: 0, errors: 0, processed: 0 }
const startedAt = Date.now()

function getArg(args: string[], name: string): string | null {
  const idx = args.indexOf(name)
  if (idx >= 0) return args[idx + 1] || null
  const prefixed = args.find(arg => arg.startsWith(`${name}=`))
  return prefixed ? prefixed.slice(name.length + 1) : null
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name)
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2)
  const limitRaw = getArg(args, '--limit')
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : null
  return {
    suspiciousOnly: hasFlag(args, '--suspicious'),
    limit: Number.isFinite(limit as number) && (limit as number) > 0 ? limit : null,
    dryRun: hasFlag(args, '--dry-run'),
    company: getArg(args, '--company'),
    userId: getArg(args, '--user-id') || process.env.OWNER_USER_ID || '',
  }
}

/**
 * 疑わしい =
 *  a) website 自体がポータル/SNS（ポータルのフォームを拾っている可能性）
 *  b) フォームURLが自社ドメイン外かつ既知フォームサービスでもない
 */
function isSuspicious(lead: LeadRow): boolean {
  if (!lead.contact_url || !lead.website_url) return false
  try {
    if (classifyWebsite(lead.website_url).kind !== 'own_site') return true
    if (isTrustedFormHost(lead.contact_url, lead.website_url)) return false
    return true
  } catch {
    return true
  }
}

async function fetchTargets(opts: CliOptions): Promise<LeadRow[]> {
  const rows: LeadRow[] = []
  let offset = 0
  while (true) {
    let query = supabase!
      .from('leads')
      .select('id, company_name, website_url, contact_url, email')
      .eq('user_id', opts.userId)
      .eq('contact_method', 'form')
      .eq('status', '未着手')
      .not('contact_url', 'is', null)
      .not('website_url', 'is', null)
      .order('created_at', { ascending: true })
      .range(offset, offset + FETCH_PAGE_SIZE - 1)
    if (opts.company) {
      query = query.ilike('company_name', `%${opts.company}%`)
    }
    const { data, error } = await query
    if (error) throw new Error(`対象取得エラー: ${error.message}`)
    rows.push(...((data || []) as LeadRow[]))
    if (!data || data.length < FETCH_PAGE_SIZE) break
    offset += FETCH_PAGE_SIZE
  }

  const filtered = opts.suspiciousOnly ? rows.filter(isSuspicious) : rows
  return opts.limit ? filtered.slice(0, opts.limit) : filtered
}

async function handleLead(lead: LeadRow, index: number, total: number, opts: CliOptions): Promise<void> {
  const label = `[${index}/${total}] ${lead.company_name}`
  try {
    // website がポータル/SNSの場合は巡回しない（ポータル自身のフォームを拾ってしまうため）
    const classified = classifyWebsite(lead.website_url!)
    const result = classified.kind === 'own_site'
      ? await detectContact(lead.website_url!)
      : { method: 'none' as const, contactUrl: undefined, email: undefined }

    if (result.method === 'form' && result.contactUrl) {
      const changed = result.contactUrl !== lead.contact_url
      if (changed) stats.urlFixed++
      else stats.keptForm++
      console.log(`${label} → ✅ フォーム確認${changed ? '（URL修正）' : ''}`)
      if (!opts.dryRun) {
        await supabase!.from('leads').update({
          contact_url: result.contactUrl,
          email: result.email ?? lead.email,
          updated_at: new Date().toISOString(),
        }).eq('id', lead.id).eq('user_id', opts.userId)
      }
      return
    }

    const email = result.email || lead.email
    if (email) {
      stats.demotedEmail++
      console.log(`${label} → ✉️ email に降格（フォーム無し）`)
      if (!opts.dryRun) {
        await supabase!.from('leads').update({
          contact_method: 'email',
          email,
          contact_url: null,
          updated_at: new Date().toISOString(),
        }).eq('id', lead.id).eq('user_id', opts.userId)
      }
      return
    }

    // 登録条件を満たさない → 削除（元prospectがあればIG管理へ戻す）
    stats.deleted++
    console.log(`${label} → 🗑 削除（フォーム・メール無し）`)
    if (!opts.dryRun) {
      const { data: prospect } = await supabase!
        .from('prospects')
        .select('id, instagram_url')
        .eq('lead_id', lead.id)
        .maybeSingle()
      if (prospect) {
        await supabase!.from('prospects').update({
          status: 'untouched',
          lead_id: null,
          contact_method: prospect.instagram_url ? 'instagram' : 'none',
          contact_form_url: null,
          updated_at: new Date().toISOString(),
        }).eq('id', prospect.id)
      }
      await supabase!.from('leads').delete().eq('id', lead.id).eq('user_id', opts.userId)
    }
  } catch (err) {
    stats.errors++
    console.error(`${label} → ❌ エラー: ${err instanceof Error ? err.message : err}`)
  } finally {
    stats.processed++
  }
}

async function main(): Promise<void> {
  const opts = parseArgs()
  if (!supabase) {
    console.error('❌ Supabase 接続情報がありません')
    process.exit(1)
  }
  if (!opts.userId) {
    console.error('❌ OWNER_USER_ID が設定されていません')
    process.exit(1)
  }

  console.log('🔎 フォーム型リードの再検証を開始します')
  console.log(`   モード: ${opts.dryRun ? 'dry-run（DB更新なし）' : '本番（DB更新あり）'}`)
  console.log(`   対象: ${opts.suspiciousOnly ? '疑わしいもののみ（フォームURLが自社ドメイン外）' : '全フォーム型リード'}${opts.company ? ` / 社名: ${opts.company}` : ''} / 上限: ${opts.limit ?? 'なし'}`)
  console.log('')

  const targets = await fetchTargets(opts)
  console.log(`   再検証対象: ${targets.length}件`)
  console.log('')

  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY)
    await Promise.all(batch.map((lead, j) => handleLead(lead, i + j + 1, targets.length, opts)))
    if (i + CONCURRENCY < targets.length) {
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES_MS))
    }
  }

  const min = Math.floor((Date.now() - startedAt) / 60000)
  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✅ 再検証 完了')
  console.log(`   処理: ${stats.processed}件`)
  console.log(`   ├ フォーム確認（維持）: ${stats.keptForm}件`)
  console.log(`   ├ フォームURL修正: ${stats.urlFixed}件`)
  console.log(`   ├ email に降格: ${stats.demotedEmail}件`)
  console.log(`   ├ 削除（条件不足）: ${stats.deleted}件`)
  console.log(`   └ エラー: ${stats.errors}件`)
  console.log(`   所要時間: 約${min}分`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main().catch(err => {
  console.error('❌ エラー:', err)
  process.exit(1)
})
