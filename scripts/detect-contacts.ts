/**
 * ローカル連絡方法検出スクリプト
 *
 * npm run detect            # contact_method未設定のリードを全件検出
 * npm run detect -- --limit 10   # 10件だけ検出
 * npm run detect -- --prefecture 和歌山県  # 和歌山県のリードだけ
 * npm run detect -- --force      # 検出済みも含め全件再検出
 */

import { createClient } from '@supabase/supabase-js'
import { detectContact, type ContactDetectionResult } from '../src/lib/contact-detector'

// ─── 設定 ─────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const DELAY_MS = 1000 // 検出間隔
const CONCURRENCY = 3 // 同時実行数

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ 環境変数が未設定です。.env.local を確認してください。')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─── 型定義 ─────────────────────────────────

interface LeadRow {
  id: string
  company_name: string
  company_url: string | null
  website_url: string | null
  contact_method: string | null
  contact_url: string | null
  email: string | null
}

// ─── メイン処理 ──────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const force = args.includes('--force')
  const limitIdx = args.indexOf('--limit')
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1] || '999', 10) : 999
  const prefIdx = args.indexOf('--prefecture')
  const prefecture = prefIdx >= 0 ? args[prefIdx + 1] : null

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🔍 連絡方法検出')
  console.log(`   モード: ${force ? '全件再検出' : '未検出のみ'}`)
  console.log(`   上限: ${limit}件`)
  if (prefecture) console.log(`   都道府県: ${prefecture}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')

  // リード取得
  let query = supabase
    .from('leads')
    .select('id, company_name, company_url, website_url, contact_method, contact_url, email')
    .order('created_at', { ascending: true })
    .limit(limit)

  if (!force) {
    query = query.is('contact_method', null)
  }
  if (prefecture) {
    query = query.eq('prefecture', prefecture)
  }

  const { data: leads, error } = await query

  if (error) {
    console.error('❌ リード取得エラー:', error.message)
    process.exit(1)
  }

  const items = (leads || []) as LeadRow[]

  // HPのURLがないリードはスキップ
  const withUrl = items.filter(l => l.company_url || l.website_url)
  const noUrl = items.filter(l => !l.company_url && !l.website_url)

  // URLなしリードを'none'に設定
  if (noUrl.length > 0) {
    const ids = noUrl.map(l => l.id)
    await supabase
      .from('leads')
      .update({ contact_method: 'none', updated_at: new Date().toISOString() })
      .in('id', ids)
    console.log(`⏭️ URLなし: ${noUrl.length}件 → 'none' に設定`)
  }

  if (withUrl.length === 0) {
    console.log('✅ 検出対象のリードはありません。')
    return
  }

  console.log(`📋 対象: ${withUrl.length}件`)
  console.log('')

  // 検出実行
  const stats = { form: 0, email: 0, none: 0, error: 0 }
  const results: { company: string; method: string; detail: string }[] = []

  // 同時実行制御
  let i = 0
  async function processNext(): Promise<void> {
    while (i < withUrl.length) {
      const idx = i++
      const lead = withUrl[idx]
      const primaryUrl = lead.company_url || lead.website_url!
      const fallbackUrl = lead.company_url && lead.website_url && lead.company_url !== lead.website_url
        ? lead.website_url : null

      console.log(`[${idx + 1}/${withUrl.length}] ${lead.company_name}`)

      let result: ContactDetectionResult
      try {
        result = await detectContact(primaryUrl)
        // 主URLで見つからなければフォールバックURLも試す
        if (result.method === 'none' && fallbackUrl) {
          const fallbackResult = await detectContact(fallbackUrl)
          if (fallbackResult.method !== 'none') result = fallbackResult
        }
      } catch (err) {
        result = { method: 'none', error: err instanceof Error ? err.message : 'unknown' }
      }

      // DB更新
      const update: Record<string, unknown> = {
        contact_method: result.method,
        updated_at: new Date().toISOString(),
      }
      if (result.contactUrl) update.contact_url = result.contactUrl
      if (result.email && !lead.email) update.email = result.email

      await supabase.from('leads').update(update).eq('id', lead.id)

      // 集計
      switch (result.method) {
        case 'form':
          console.log(`  📝 フォーム発見: ${result.contactUrl}${result.hasRecaptcha ? ' (reCAPTCHA)' : ''}`)
          stats.form++
          break
        case 'email':
          console.log(`  📧 メール発見: ${result.email}`)
          stats.email++
          break
        case 'none':
          console.log(`  ❌ 検出なし${result.error ? `: ${result.error}` : ''}`)
          stats.none++
          break
      }

      results.push({
        company: lead.company_name,
        method: result.method,
        detail: result.contactUrl || result.email || result.error || '',
      })

      await new Promise(r => setTimeout(r, DELAY_MS))
    }
  }

  // 並行実行
  const workers = Array.from({ length: Math.min(CONCURRENCY, withUrl.length) }, () => processNext())
  await Promise.all(workers)

  // レポート
  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📊 検出結果レポート')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`   合計:        ${withUrl.length + noUrl.length}件`)
  console.log(`   📝 フォーム:  ${stats.form}件`)
  console.log(`   📧 メール:    ${stats.email}件`)
  console.log(`   ❌ なし:      ${stats.none + noUrl.length}件`)
  console.log('')

  if (stats.form > 0) {
    console.log('【フォーム検出】')
    results.filter(r => r.method === 'form').forEach(r => console.log(`  - ${r.company}: ${r.detail}`))
    console.log('')
  }

  if (stats.email > 0) {
    console.log('【メール検出】')
    results.filter(r => r.method === 'email').forEach(r => console.log(`  - ${r.company}: ${r.detail}`))
    console.log('')
  }
}

main().catch(err => {
  console.error('❌ スクリプトエラー:', err)
  process.exit(1)
})
