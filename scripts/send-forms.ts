/**
 * ローカルフォーム一括送信スクリプト
 *
 * npm run send で実行。send_queue の「確認待ち」アイテムを
 * 自前エンジン（fetch + cheerio）で順番に送信する。
 *
 * ローカルPCのIPからアクセスするため、クラウドIPブロック（403）を回避できる。
 *
 * 使い方:
 *   npm run send            # 確認待ちを全件送信
 *   npm run send -- --limit 10  # 10件だけ送信
 *   npm run send -- --dry-run   # 送信せずにフォーム検出のみ
 */

import { createClient } from '@supabase/supabase-js'
import { sendForm, type SenderInfo, type FormSendResult } from '../src/lib/form-sender'

// ─── 設定 ─────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const DELAY_BETWEEN_SENDS_MS = 3000 // 送信間隔（サーバー負荷対策）

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ 環境変数が未設定です:')
  console.error('  NEXT_PUBLIC_SUPABASE_URL')
  console.error('  SUPABASE_SERVICE_ROLE_KEY または NEXT_PUBLIC_SUPABASE_ANON_KEY')
  console.error('')
  console.error('.env.local ファイルを確認してください。')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─── 型定義 ─────────────────────────────────

interface QueueItem {
  id: string
  message_content: string
  subject: string | null
  lead_id: string
  lead: {
    id: string
    company_name: string
    company_url: string | null
    contact_url: string | null
  }
}

interface SendStats {
  total: number
  success: number
  failed: number
  formNotFound: number
  manual: number
  skipped: number
}

// ─── メイン処理 ──────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const limitArg = args.find(a => a.startsWith('--limit'))
  const limit = limitArg ? parseInt(args[args.indexOf(limitArg) + 1] || '999', 10) : 999

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📮 ローカルフォーム一括送信')
  console.log(`   モード: ${dryRun ? 'DRY RUN（送信しない）' : '本番送信'}`)
  console.log(`   上限: ${limit}件`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')

  // 1. 送信者プロフィール取得
  const { data: settings, error: settingsErr } = await supabase
    .from('user_settings')
    .select('company_name, representative, company_email, company_phone')
    .limit(1)
    .single()

  if (settingsErr || !settings?.representative || !settings?.company_email) {
    console.error('❌ 送信者情報が未設定です。設定ページで入力してください。')
    process.exit(1)
  }

  const sender: SenderInfo = {
    companyName: settings.company_name,
    name: settings.representative,
    email: settings.company_email,
    phone: settings.company_phone || '',
  }

  console.log(`👤 送信者: ${sender.name}（${sender.companyName}）`)
  console.log(`📧 メール: ${sender.email}`)
  console.log('')

  // 2. 確認待ちアイテム取得
  // 既に送信済みのlead_idを取得（重複送信防止）
  const { data: sentLeads } = await supabase
    .from('send_queue')
    .select('lead_id')
    .eq('status', '送信済み')

  const sentLeadIds = new Set((sentLeads || []).map(s => s.lead_id))
  console.log(`🚫 送信済み企業: ${sentLeadIds.size}件（スキップ対象）`)
  console.log('')

  const { data: items, error: fetchErr } = await supabase
    .from('send_queue')
    .select(`
      id, message_content, subject, lead_id,
      lead:lead_id (id, company_name, company_url, contact_url)
    `)
    .eq('status', '確認待ち')
    .eq('send_method', 'form')
    .order('created_at', { ascending: true })
    .limit(limit + 100) // 送信済みスキップ分を余分に取得

  if (fetchErr) {
    console.error('❌ キュー取得エラー:', fetchErr.message)
    process.exit(1)
  }

  const allItems = (items || []) as unknown as QueueItem[]

  // 既に送信済みの企業をスキップ
  const queue = allItems
    .filter(item => !sentLeadIds.has(item.lead_id))
    .slice(0, limit)

  const skippedDuplicates = allItems.length - queue.length
  if (skippedDuplicates > 0) {
    console.log(`⏭️ 送信済み企業をスキップ: ${skippedDuplicates}件`)
  }

  if (queue.length === 0) {
    console.log('✅ 送信対象のアイテムはありません。')
    return
  }

  console.log(`📋 対象: ${queue.length}件`)
  console.log('')

  // 3. 各アイテムを順番に処理
  const stats: SendStats = {
    total: queue.length,
    success: 0,
    failed: 0,
    formNotFound: 0,
    manual: 0,
    skipped: 0,
  }

  const results: { company: string; result: string; message: string }[] = []

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i]
    const lead = item.lead
    const companyUrl = lead.company_url

    console.log(`[${i + 1}/${queue.length}] ${lead.company_name}`)

    if (!companyUrl) {
      console.log('  ⏭️ 企業URLなし — スキップ')
      stats.skipped++
      results.push({ company: lead.company_name, result: 'skipped', message: '企業URLなし' })
      continue
    }

    // 冪等性チェック: ステータスを「送信承認済み」にロック
    const { error: lockErr } = await supabase
      .from('send_queue')
      .update({ status: '送信承認済み', updated_at: new Date().toISOString() })
      .eq('id', item.id)
      .eq('status', '確認待ち')

    if (lockErr) {
      console.log('  ⏭️ ロック失敗 — スキップ')
      stats.skipped++
      results.push({ company: lead.company_name, result: 'skipped', message: 'ロック失敗' })
      continue
    }

    if (dryRun) {
      console.log(`  🔍 DRY RUN: ${companyUrl}`)
      // ステータスを戻す
      await supabase
        .from('send_queue')
        .update({ status: '確認待ち', updated_at: new Date().toISOString() })
        .eq('id', item.id)
      stats.skipped++
      results.push({ company: lead.company_name, result: 'dry-run', message: companyUrl })
      continue
    }

    // フォーム送信実行
    let result: FormSendResult
    try {
      result = await sendForm(
        companyUrl,
        lead.contact_url || undefined,
        sender,
        item.message_content,
        item.subject || undefined,
      )
    } catch (err) {
      result = {
        result: 'failed',
        message: err instanceof Error ? err.message : 'unknown error',
      }
    }

    // 結果に応じてDB更新
    switch (result.result) {
      case 'success':
        await supabase
          .from('send_queue')
          .update({
            status: '送信済み',
            sent_at: new Date().toISOString(),
            screenshot_url: `form_engine:${JSON.stringify(result)}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id)

        await supabase
          .from('leads')
          .update({ status: '送信済み', updated_at: new Date().toISOString() })
          .eq('id', lead.id)

        if (result.contactUrl) {
          await supabase
            .from('leads')
            .update({ contact_url: result.contactUrl, updated_at: new Date().toISOString() })
            .eq('id', lead.id)
        }

        console.log(`  ✅ 送信成功: ${result.message}`)
        stats.success++
        break

      case 'form_not_found':
        await supabase
          .from('send_queue')
          .update({
            status: 'form_not_found',
            error_message: result.message,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id)

        console.log(`  🔍 フォーム未検出: ${result.message}`)
        stats.formNotFound++
        break

      case 'manual':
        await supabase
          .from('send_queue')
          .update({
            status: '手動対応',
            error_message: result.message,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id)

        console.log(`  ⚠️ 手動対応: ${result.message}`)
        stats.manual++
        break

      case 'failed':
      default:
        // 失敗 → 確認待ちに戻す（Chrome MCPでリトライ可能）
        await supabase
          .from('send_queue')
          .update({
            status: '確認待ち',
            error_message: `ローカル送信失敗: ${result.message}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id)

        console.log(`  ❌ 失敗（確認待ちに復元）: ${result.message}`)
        stats.failed++
        break
    }

    results.push({ company: lead.company_name, result: result.result, message: result.message })

    // 送信間隔
    if (i < queue.length - 1) {
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_SENDS_MS))
    }
  }

  // 4. 完了レポート
  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📊 送信完了レポート')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`   合計:         ${stats.total}件`)
  console.log(`   ✅ 送信成功:   ${stats.success}件`)
  console.log(`   ❌ 失敗:       ${stats.failed}件（確認待ちに復元 → Chrome MCPで再送信可能）`)
  console.log(`   🔍 フォーム未検出: ${stats.formNotFound}件`)
  console.log(`   ⚠️ 手動対応:   ${stats.manual}件（CAPTCHA等）`)
  console.log(`   ⏭️ スキップ:   ${stats.skipped}件`)
  console.log('')

  if (stats.success > 0) {
    console.log('【送信成功】')
    results.filter(r => r.result === 'success').forEach(r => console.log(`  - ${r.company}`))
    console.log('')
  }

  if (stats.failed > 0) {
    console.log('【失敗（Chrome MCPで再送信可能）】')
    results.filter(r => r.result === 'failed').forEach(r => console.log(`  - ${r.company}: ${r.message}`))
    console.log('')
  }

  if (stats.formNotFound > 0) {
    console.log('【フォーム未検出】')
    results.filter(r => r.result === 'form_not_found').forEach(r => console.log(`  - ${r.company}`))
    console.log('')
  }

  if (stats.manual > 0) {
    console.log('【手動対応】')
    results.filter(r => r.result === 'manual').forEach(r => console.log(`  - ${r.company}: ${r.message}`))
    console.log('')
  }
}

main().catch(err => {
  console.error('❌ スクリプトエラー:', err)
  process.exit(1)
})
