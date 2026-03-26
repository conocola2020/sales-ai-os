/**
 * 既存リードのHP URLからInstagram URLを自動検出するスクリプト
 *
 * 使い方:
 *   npx tsx scripts/find-instagram-from-hp.ts
 *   npx tsx scripts/find-instagram-from-hp.ts --limit 50
 *   npx tsx scripts/find-instagram-from-hp.ts --csv sauna_leads.csv --limit 100
 *   npx tsx scripts/find-instagram-from-hp.ts --db  (Supabaseから読んでDBに書き戻す)
 *
 * CSVモード: CSVファイルのURL列からInstagramを探し、結果を新CSVに出力
 * DBモード: Supabaseのleadsテーブルからcompany_urlを読み、instagram_urlを更新
 */

import * as fs from 'fs'

// -------------------------------------------------------
// Config
// -------------------------------------------------------
const CONCURRENCY = 3    // 同時リクエスト数
const DELAY_MS = 1500    // リクエスト間隔
const TIMEOUT_MS = 8000  // 1リクエストのタイムアウト

// -------------------------------------------------------
// Instagram URL 検出
// -------------------------------------------------------
async function findInstagramUrl(websiteUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const res = await fetch(websiteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ja,en;q=0.9',
      },
      signal: controller.signal,
      redirect: 'follow',
    })
    clearTimeout(timeout)

    if (!res.ok) return null
    const html = await res.text()

    // Instagram URLパターンを探す（施設自身のアカウント）
    const patterns = [
      // href="https://www.instagram.com/username/"
      /href=["'](https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9_.]+\/?)['"]/gi,
      // content="https://www.instagram.com/username" (meta tags)
      /content=["'](https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9_.]+\/?)['"]/gi,
    ]

    const found = new Set<string>()
    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(html)) !== null) {
        let url = match[1].trim()
        // 末尾スラッシュを統一
        if (!url.endsWith('/')) url += '/'
        // 一般的なアカウント（instagram.com自体やハッシュタグページ等を除外）
        if (
          !url.includes('/p/') &&
          !url.includes('/explore/') &&
          !url.includes('/accounts/') &&
          !url.includes('/reel/') &&
          !url.includes('/stories/') &&
          url !== 'https://www.instagram.com/' &&
          url !== 'https://instagram.com/'
        ) {
          found.add(url)
        }
      }
    }

    // 最初に見つかったInstagram URLを返す
    return found.size > 0 ? [...found][0] : null
  } catch {
    return null
  }
}

// -------------------------------------------------------
// Instagram URLからユーザー名を抽出
// -------------------------------------------------------
function extractUsername(igUrl: string): string {
  const match = igUrl.match(/instagram\.com\/([a-zA-Z0-9_.]+)/)
  return match ? match[1] : ''
}

// -------------------------------------------------------
// CSV読み込み
// -------------------------------------------------------
function parseCsv(content: string): Record<string, string>[] {
  const lines = content.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  // BOM除去
  const headerLine = lines[0].replace(/^\uFEFF/, '')
  const headers = headerLine.split(',').map(h => h.replace(/^"/, '').replace(/"$/, '').trim())

  return lines.slice(1).map(line => {
    const values: string[] = []
    let current = ''
    let inQuotes = false
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    values.push(current.trim())

    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = values[i] || '' })
    return row
  })
}

// -------------------------------------------------------
// delay
// -------------------------------------------------------
function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

// -------------------------------------------------------
// メイン
// -------------------------------------------------------
async function main() {
  const args = process.argv.slice(2)
  const getArg = (name: string) => {
    const i = args.indexOf(`--${name}`)
    return i >= 0 && i + 1 < args.length ? args[i + 1] : null
  }

  const csvFile = getArg('csv') || 'sauna_leads.csv'
  const limit = getArg('limit') ? parseInt(getArg('limit')!) : 0

  console.log(`🔍 HP URLからInstagram URLを自動検出`)
  console.log(`   CSV: ${csvFile}`)
  console.log('')

  // CSV読み込み
  if (!fs.existsSync(csvFile)) {
    console.error(`❌ ファイルが見つかりません: ${csvFile}`)
    process.exit(1)
  }

  const csvContent = fs.readFileSync(csvFile, 'utf-8')
  const rows = parseCsv(csvContent)

  // URL列を特定
  const urlKey = Object.keys(rows[0] || {}).find(k =>
    k.includes('URL') || k.includes('url') || k.includes('HP') || k.includes('website')
  )
  const nameKey = Object.keys(rows[0] || {}).find(k =>
    k.includes('会社名') || k.includes('施設名') || k.includes('name')
  )

  if (!urlKey) {
    console.error('❌ URL列が見つかりません')
    process.exit(1)
  }

  console.log(`   URL列: "${urlKey}", 施設名列: "${nameKey || '?'}"`)

  // URLがある行だけフィルタ
  const withUrl = rows.filter(r => r[urlKey] && r[urlKey].startsWith('http'))
  const toProcess = limit > 0 ? withUrl.slice(0, limit) : withUrl

  console.log(`   全${rows.length}件中、URL有: ${withUrl.length}件`)
  console.log(`   処理対象: ${toProcess.length}件`)
  console.log('')

  // 処理
  let found = 0
  let errors = 0
  const results: { name: string; url: string; instagram: string; username: string }[] = []

  for (let i = 0; i < toProcess.length; i++) {
    const row = toProcess[i]
    const name = nameKey ? row[nameKey] : `施設${i + 1}`
    const url = row[urlKey]

    process.stdout.write(`  [${i + 1}/${toProcess.length}] ${name}...`)

    const igUrl = await findInstagramUrl(url)

    if (igUrl) {
      const username = extractUsername(igUrl)
      found++
      results.push({ name, url, instagram: igUrl, username })
      console.log(` 📸 @${username}`)
    } else {
      console.log(` —`)
    }

    // 一定間隔で待つ
    if ((i + 1) % CONCURRENCY === 0) {
      await delay(DELAY_MS)
    }
  }

  // 結果サマリー
  console.log('')
  console.log('════════════════════════════════════════')
  console.log(`✅ 検出完了`)
  console.log(`   処理: ${toProcess.length}件`)
  console.log(`   Instagram発見: ${found}件 (${Math.round((found / toProcess.length) * 100)}%)`)
  console.log(`   エラー: ${errors}件`)
  console.log('════════════════════════════════════════')

  // Instagram発見リストをCSV出力
  if (results.length > 0) {
    console.log('')
    console.log('📸 発見したInstagramアカウント:')
    results.forEach(r => {
      console.log(`   ${r.name}: @${r.username} (${r.instagram})`)
    })

    // CSVファイルに保存
    const outputFile = `instagram_found_${new Date().toISOString().slice(0, 10)}.csv`
    const csvHeaders = 'ユーザー名,表示名,業種,備考'
    const csvRows = results.map(r =>
      `"${r.username}","${r.name}","サウナ・温浴施設","HP: ${r.url}"`
    )
    fs.writeFileSync(outputFile, '\uFEFF' + [csvHeaders, ...csvRows].join('\n'), 'utf-8')
    console.log(`\n📁 Instagram CSVインポート用ファイル: ${outputFile}`)
    console.log(`   → Instagram画面の「CSVインポート」から取り込めます`)
  }
}

main().catch(err => {
  console.error('❌ エラー:', err)
  process.exit(1)
})
