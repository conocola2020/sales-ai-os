/**
 * company_url の正規化・修正スクリプト
 *
 * - サブページURLをルートドメインに変換
 * - UTMパラメータ除去
 * - &amp; を & に変換
 *
 * npx tsx scripts/fix-company-urls.ts [--apply]
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function supabaseSelect(query: string): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/leads?${query}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) throw new Error(`SELECT error: ${res.status}`)
  return res.json()
}

async function supabaseUpdate(id: string, data: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`UPDATE error: ${res.status}`)
}

function normalizeUrl(url: string): string {
  // Decode HTML entities
  let cleaned = url.replace(/&amp;/g, '&')

  try {
    const parsed = new URL(cleaned)
    // Remove UTM parameters
    for (const key of [...parsed.searchParams.keys()]) {
      if (key.startsWith('utm_')) parsed.searchParams.delete(key)
    }
    // Convert to origin (root domain) if path looks like a sub-page
    const path = parsed.pathname
    // Keep root or single-level paths, normalize deeper paths to root
    if (path.split('/').filter(Boolean).length > 1) {
      // Sub-page detected - use just the origin
      return parsed.origin + '/'
    }
    // Clean up trailing params if empty
    const result = parsed.toString()
    return result.endsWith('?') ? result.slice(0, -1) : result
  } catch {
    return cleaned
  }
}

async function main() {
  const apply = process.argv.includes('--apply')

  const leads = await supabaseSelect(
    'select=id,company_name,company_url&company_url=neq.null&company_url=neq.&order=created_at.asc&limit=1000'
  )

  console.log(`📋 company_url が設定されているリード: ${leads.length}件\n`)

  let fixCount = 0
  const fixes: { id: string; name: string; before: string; after: string }[] = []

  for (const lead of leads) {
    const normalized = normalizeUrl(lead.company_url)
    if (normalized !== lead.company_url) {
      fixes.push({
        id: lead.id,
        name: lead.company_name,
        before: lead.company_url,
        after: normalized,
      })
      fixCount++
    }
  }

  if (fixes.length === 0) {
    console.log('✅ 修正が必要なURLはありません')
    return
  }

  console.log(`🔧 修正が必要: ${fixCount}件\n`)
  for (const fix of fixes) {
    console.log(`  ${fix.name}`)
    console.log(`    前: ${fix.before}`)
    console.log(`    後: ${fix.after}`)
    console.log('')
  }

  if (apply) {
    console.log('📝 DBを更新中...')
    for (const fix of fixes) {
      await supabaseUpdate(fix.id, { company_url: fix.after })
      console.log(`  ✅ ${fix.name}`)
    }
    console.log(`\n✅ ${fixCount}件を更新しました`)
  } else {
    console.log('💡 実際に更新するには --apply オプションを付けてください')
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
