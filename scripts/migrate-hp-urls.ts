/**
 * website_url にサウナイキタイ以外のURL（＝企業HP）が入っている984件を
 * company_url にコピーする一括移行スクリプト
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function supabaseSelect(query: string): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/leads?${query}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  })
  if (!res.ok) throw new Error(`SELECT error: ${res.status}`)
  return res.json()
}

async function supabaseUpdate(id: string, data: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${id}`, {
    method: 'PATCH',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`UPDATE error: ${res.status}`)
}

function normalizeUrl(url: string): string {
  let cleaned = url.replace(/&amp;/g, '&')
  try {
    const parsed = new URL(cleaned)
    for (const key of [...parsed.searchParams.keys()]) {
      if (key.startsWith('utm_')) parsed.searchParams.delete(key)
    }
    if (parsed.pathname.split('/').filter(Boolean).length > 1) return parsed.origin + '/'
    const result = parsed.toString()
    return result.endsWith('?') ? result.slice(0, -1) : result
  } catch { return cleaned }
}

async function main() {
  console.log('📊 website_url にサウナイキタイ以外のURLが入っているリードを取得中...')

  let all: any[] = []
  let offset = 0
  while (true) {
    const batch = await supabaseSelect(
      `select=id,company_name,website_url,company_url&website_url=neq.null&website_url=neq.&website_url=not.like.*sauna-ikitai.com*&company_url=is.null&order=created_at.asc&offset=${offset}&limit=100`
    )
    all = all.concat(batch)
    if (batch.length < 100) break
    offset += 100
  }
  // Also empty string
  offset = 0
  while (true) {
    const batch = await supabaseSelect(
      `select=id,company_name,website_url,company_url&website_url=neq.null&website_url=neq.&website_url=not.like.*sauna-ikitai.com*&company_url=eq.&order=created_at.asc&offset=${offset}&limit=100`
    )
    all = all.concat(batch)
    if (batch.length < 100) break
    offset += 100
  }

  console.log(`📋 対象: ${all.length}件\n`)

  let count = 0
  for (const lead of all) {
    const normalized = normalizeUrl(lead.website_url)
    await supabaseUpdate(lead.id, { company_url: normalized })
    count++
    if (count % 100 === 0) console.log(`  ${count}/${all.length} 完了...`)
  }

  console.log(`\n✅ ${count}件の company_url を設定しました`)
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
