/**
 * サウナイキタイからサウナ施設情報を収集するスクリプト
 *
 * 使い方:
 *   npx tsx scripts/scrape-sauna-ikitai.ts --prefecture aichi --pages 3
 *   npx tsx scripts/scrape-sauna-ikitai.ts --prefecture tokyo --pages 5 --output csv
 *   npx tsx scripts/scrape-sauna-ikitai.ts --prefecture aichi --skip-existing
 *
 * オプション:
 *   --prefecture  都道府県（英語名: tokyo, osaka, aichi, etc.）
 *   --pages       取得ページ数（デフォルト: 全ページ）
 *   --output      出力形式: csv | supabase (デフォルト: csv)
 *   --skip-existing 既にDB登録済みの施設をスキップ
 *   --find-instagram  各施設のHPからInstagram URLを自動検出（遅い）
 */

import * as fs from 'fs'

// -------------------------------------------------------
// 都道府県マッピング
// -------------------------------------------------------
const PREFECTURES: Record<string, string> = {
  hokkaido: 'hokkaido', aomori: 'aomori', iwate: 'iwate', miyagi: 'miyagi',
  akita: 'akita', yamagata: 'yamagata', fukushima: 'fukushima',
  ibaraki: 'ibaraki', tochigi: 'tochigi', gunma: 'gunma', saitama: 'saitama',
  chiba: 'chiba', tokyo: 'tokyo', kanagawa: 'kanagawa',
  niigata: 'niigata', toyama: 'toyama', ishikawa: 'ishikawa', fukui: 'fukui',
  yamanashi: 'yamanashi', nagano: 'nagano', gifu: 'gifu', shizuoka: 'shizuoka',
  aichi: 'aichi', mie: 'mie',
  shiga: 'shiga', kyoto: 'kyoto', osaka: 'osaka', hyogo: 'hyogo',
  nara: 'nara', wakayama: 'wakayama',
  tottori: 'tottori', shimane: 'shimane', okayama: 'okayama', hiroshima: 'hiroshima',
  yamaguchi: 'yamaguchi',
  tokushima: 'tokushima', kagawa: 'kagawa', ehime: 'ehime', kochi: 'kochi',
  fukuoka: 'fukuoka', saga: 'saga', nagasaki: 'nagasaki', kumamoto: 'kumamoto',
  oita: 'oita', miyazaki: 'miyazaki', kagoshima: 'kagoshima', okinawa: 'okinawa',
}

// -------------------------------------------------------
// 型定義
// -------------------------------------------------------
interface SaunaFacility {
  sauna_ikitai_id: string
  name: string
  address: string
  phone: string
  website_url: string
  instagram_url: string
  facility_type: string
  prefecture: string
}

// -------------------------------------------------------
// HTML fetch helper
// -------------------------------------------------------
async function fetchHtml(url: string, retries: number = 2): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
          'Accept-Encoding': 'identity',
        },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`)
      const text = await res.text()
      if (text.length < 100 && attempt < retries) {
        await delay(3000)
        continue
      }
      return text
    } catch (err) {
      if (attempt < retries) {
        await delay(2000)
        continue
      }
      throw err
    }
  }
  return ''
}

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

// -------------------------------------------------------
// 一覧ページから施設IDと施設名を取得
// -------------------------------------------------------
async function fetchFacilityList(
  prefecture: string,
  page: number
): Promise<{ id: string; name: string }[]> {
  const url = `https://sauna-ikitai.com/search?prefecture%5B%5D=${prefecture}&page=${page}`
  console.log(`  [一覧] ${url}`)

  const html = await fetchHtml(url)
  const results: { id: string; name: string }[] = []
  const seen = new Set<string>()

  // Full URL pattern: href="https://sauna-ikitai.com/saunas/12345"
  // 施設名は後続の<h3>タグ内
  const idRegex = /href="https?:\/\/sauna-ikitai\.com\/saunas\/(\d+)"/g
  let match

  while ((match = idRegex.exec(html)) !== null) {
    const id = match[1]
    if (seen.has(id)) continue
    seen.add(id)

    // 後続のHTMLから<h3>タグ内の施設名を取得
    const afterLink = html.slice(match.index, match.index + 500)
    const nameMatch = afterLink.match(/<h3[^>]*>\s*([^<]+)\s*<\/h3>/)
    const name = nameMatch ? nameMatch[1].trim() : ''

    if (name) {
      // HTMLエンティティをデコード
      const decodedName = name
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
      results.push({ id, name: decodedName })
    }
  }

  return results
}

// -------------------------------------------------------
// 施設詳細ページから情報を取得
// -------------------------------------------------------
async function fetchFacilityDetail(id: string): Promise<Partial<SaunaFacility>> {
  const url = `https://sauna-ikitai.com/saunas/${id}`
  const html = await fetchHtml(url)

  const info: Partial<SaunaFacility> = { sauna_ikitai_id: id }

  // テーブル形式: <th class="c-table_th">ラベル</th>\n<td class="c-table_td">値</td>
  const extractTableField = (label: string): string => {
    const regex = new RegExp(
      `c-table_th">${label}</th>[\\s\\S]*?c-table_td">([\\s\\S]*?)</td>`,
    )
    const m = html.match(regex)
    if (!m) return ''
    // HTMLタグを除去してテキストのみ
    return m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  }

  // HP URL は <a href="..."> 内にあるので別処理
  const extractHpUrl = (): string => {
    const regex = /c-table_th">HP<\/th>[\s\S]*?c-table_td">[\s\S]*?href="(https?:\/\/[^"]+)"/
    const m = html.match(regex)
    return m ? m[1].trim() : ''
  }

  // JS必須ページの検出
  if (html.includes('JavaScript is disabled') && html.length < 2000) {
    return info // 最低限の情報のみ返す
  }

  // 施設名 (h2 or h1)
  const nameMatch = html.match(/<h2[^>]*>([^<]+)<\/h2>/)
    || html.match(/<h1[^>]*>([^<]+)<\/h1>/)
  if (nameMatch) info.name = nameMatch[1].trim()

  info.address = extractTableField('住所')
  info.phone = extractTableField('TEL')
  info.website_url = extractHpUrl()
  info.facility_type = extractTableField('施設タイプ')

  // Instagram URL（施設のSNSリンク、sauna_ikitaiのは除外）
  const igMatches = [...html.matchAll(/href="(https?:\/\/(?:www\.)?instagram\.com\/[^"]+)"/g)]
  for (const m of igMatches) {
    if (!m[1].includes('sauna_ikitai')) {
      info.instagram_url = m[1].trim()
      break
    }
  }

  return info
}

// -------------------------------------------------------
// 施設のHPからInstagram URLを探す
// -------------------------------------------------------
async function findInstagramFromWebsite(websiteUrl: string): Promise<string | null> {
  try {
    const html = await fetchHtml(websiteUrl)
    const igMatch = html.match(/href=["'](https?:\/\/(?:www\.)?instagram\.com\/[^"']+)["']/)
    if (igMatch) return igMatch[1]

    // og:see_also やmeta tagからも探す
    const metaMatch = html.match(/content=["'](https?:\/\/(?:www\.)?instagram\.com\/[^"']+)["']/)
    if (metaMatch) return metaMatch[1]

    return null
  } catch {
    return null
  }
}

// -------------------------------------------------------
// 総ページ数を取得
// -------------------------------------------------------
async function getTotalPages(prefecture: string): Promise<number> {
  const url = `https://sauna-ikitai.com/search?prefecture%5B%5D=${prefecture}&page=1`
  const html = await fetchHtml(url)

  // ページネーションの最後の数字を探す
  const pageLinks = [...html.matchAll(/page=(\d+)/g)]
  let maxPage = 1
  for (const m of pageLinks) {
    const p = parseInt(m[1])
    if (p > maxPage) maxPage = p
  }
  return maxPage
}

// -------------------------------------------------------
// CSV出力
// -------------------------------------------------------
function toCsv(facilities: SaunaFacility[]): string {
  const headers = ['施設名', '住所', '電話番号', 'HP URL', 'Instagram URL', '施設タイプ', 'サウナイキタイID']
  const rows = facilities.map(f => [
    f.name,
    f.address,
    f.phone,
    f.website_url,
    f.instagram_url,
    f.facility_type,
    f.sauna_ikitai_id,
  ].map(v => `"${(v || '').replace(/"/g, '""')}"`).join(','))

  return [headers.join(','), ...rows].join('\n')
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
  const hasFlag = (name: string) => args.includes(`--${name}`)

  const prefecture = getArg('prefecture') || 'aichi'
  const maxPages = getArg('pages') ? parseInt(getArg('pages')!) : 0 // 0 = all
  const output = getArg('output') || 'csv'
  const findInstagram = hasFlag('find-instagram')

  if (!PREFECTURES[prefecture]) {
    console.error(`❌ 不明な都道府県: ${prefecture}`)
    console.error(`使用可能: ${Object.keys(PREFECTURES).join(', ')}`)
    process.exit(1)
  }

  console.log(`🔍 サウナイキタイから施設情報を収集: ${prefecture}`)
  console.log(`   Instagram検出: ${findInstagram ? 'ON（HPからも探す）' : 'OFF'}`)
  console.log('')

  // 1. 総ページ数を取得
  const totalPages = await getTotalPages(prefecture)
  const pagesToFetch = maxPages > 0 ? Math.min(maxPages, totalPages) : totalPages
  console.log(`📄 総ページ数: ${totalPages} → ${pagesToFetch}ページ取得`)
  console.log('')

  // 2. 一覧ページから全施設IDを取得
  const allFacilities: { id: string; name: string }[] = []
  for (let page = 1; page <= pagesToFetch; page++) {
    const list = await fetchFacilityList(prefecture, page)
    allFacilities.push(...list)
    console.log(`   ページ ${page}/${pagesToFetch}: ${list.length}件`)
    await delay(1500) // 1.5秒待つ（サーバー負荷軽減）
  }

  console.log(`\n📊 合計 ${allFacilities.length} 施設を取得`)
  console.log('')

  // 3. 各施設の詳細を取得
  const results: SaunaFacility[] = []
  let igFound = 0

  for (let i = 0; i < allFacilities.length; i++) {
    const { id, name } = allFacilities[i]
    process.stdout.write(`  [${i + 1}/${allFacilities.length}] ${name}...`)

    try {
      const detail = await fetchFacilityDetail(id)

      // HPからInstagram検出
      if (findInstagram && !detail.instagram_url && detail.website_url) {
        process.stdout.write(' (HP確認中)')
        const igUrl = await findInstagramFromWebsite(detail.website_url)
        if (igUrl) {
          detail.instagram_url = igUrl
          igFound++
        }
        await delay(1000)
      }

      results.push({
        sauna_ikitai_id: id,
        name: detail.name || name,
        address: detail.address || '',
        phone: detail.phone || '',
        website_url: detail.website_url || '',
        instagram_url: detail.instagram_url || '',
        facility_type: detail.facility_type || '',
        prefecture,
      })

      const ig = detail.instagram_url ? ' 📸' : ''
      console.log(` ✓${ig}`)
    } catch (err) {
      console.log(` ✗ エラー: ${(err as Error).message}`)
    }

    await delay(2000) // 2秒待つ（サーバー負荷軽減）
  }

  // 4. 結果出力
  console.log('')
  console.log('════════════════════════════════════════')
  console.log(`✅ 収集完了: ${results.length}施設`)
  console.log(`   HP URL あり: ${results.filter(r => r.website_url).length}件`)
  console.log(`   Instagram あり: ${results.filter(r => r.instagram_url).length}件`)
  if (findInstagram) {
    console.log(`   HPからInstagram検出: ${igFound}件`)
  }
  console.log('════════════════════════════════════════')

  if (output === 'csv') {
    const filename = `sauna_${prefecture}_${new Date().toISOString().slice(0, 10)}.csv`
    const csv = toCsv(results)
    fs.writeFileSync(filename, '\uFEFF' + csv, 'utf-8') // BOM付きUTF-8
    console.log(`\n📁 CSV出力: ${filename}`)
    console.log(`   → CSVインポート機能でアプリに取り込めます`)
  }

  // Instagram URLがある施設のサマリー
  const withIg = results.filter(r => r.instagram_url)
  if (withIg.length > 0) {
    console.log(`\n📸 Instagram URL が見つかった施設:`)
    withIg.forEach(f => {
      console.log(`   ${f.name}: ${f.instagram_url}`)
    })
  }

  // HP URLがありInstagramがない施設（手動確認推奨）
  const withHpNoIg = results.filter(r => r.website_url && !r.instagram_url)
  if (withHpNoIg.length > 0) {
    console.log(`\n💡 HPはあるがInstagram未検出（--find-instagram で再実行推奨）: ${withHpNoIg.length}件`)
  }
}

main().catch(err => {
  console.error('❌ エラー:', err)
  process.exit(1)
})
