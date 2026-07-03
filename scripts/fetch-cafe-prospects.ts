/**
 * カフェ見込み顧客取得スクリプト
 *
 * npm run fetch:cafe -- --area nagoya-naka --limit 50 --dry-run
 * npm run fetch:cafe -- --area nagoya-naka --limit 50
 */

import { createInterface } from 'readline/promises'
import { stdin as input, stdout as output } from 'process'
import { createClient } from '@supabase/supabase-js'
import { isBlacklisted } from '../src/lib/cafe-prospects/blacklist'
import { isCafeType, isOperational, hasWebsite } from '../src/lib/cafe-prospects/filters'
import { searchText, type SearchTextResponse } from '../src/lib/cafe-prospects/places-client'
import { SEARCH_AREAS } from '../src/lib/cafe-prospects/search-areas'
import type { CafeProspectRow, FetchStats, RawPlace, SearchAreaConfig } from '../src/lib/cafe-prospects/types'

// ─── 設定 ─────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const DELAY_BETWEEN_QUERIES_MS = 1000
const BATCH_SIZE = 100
const MAX_API_REQUESTS = 200

const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null

// ─── サンプルデータ（dry-run 用） ──────────────

const DRY_RUN_PLACES: RawPlace[] = [
  {
    id: 'dry_starbucks_sakae',
    displayName: { text: 'スターバックスコーヒー 栄店' },
    formattedAddress: '愛知県名古屋市中区栄',
    addressComponents: [
      { longText: '愛知県', shortText: '愛知県', types: ['administrative_area_level_1'] },
      { longText: '名古屋市', shortText: '名古屋市', types: ['locality'] },
    ],
    location: { latitude: 35.1688, longitude: 136.906 },
    types: ['cafe', 'coffee_shop', 'food'],
    primaryType: 'coffee_shop',
    websiteUri: 'https://example.com/starbucks',
    rating: 4.0,
    userRatingCount: 120,
    businessStatus: 'OPERATIONAL',
  },
  {
    id: 'dry_private_cafe_1',
    displayName: { text: '喫茶 青葉' },
    formattedAddress: '愛知県名古屋市中区大須',
    addressComponents: [
      { longText: '愛知県', shortText: '愛知県', types: ['administrative_area_level_1'] },
      { longText: '名古屋市', shortText: '名古屋市', types: ['locality'] },
    ],
    location: { latitude: 35.1599, longitude: 136.9041 },
    types: ['cafe', 'food'],
    primaryType: 'cafe',
    nationalPhoneNumber: '052-000-0000',
    websiteUri: 'https://example.com/aoba',
    rating: 4.4,
    userRatingCount: 34,
    businessStatus: 'OPERATIONAL',
  },
  {
    id: 'dry_private_cafe_no_site',
    displayName: { text: '珈琲 つばめ' },
    formattedAddress: '愛知県名古屋市中区丸の内',
    addressComponents: [
      { longText: '愛知県', shortText: '愛知県', types: ['administrative_area_level_1'] },
      { longText: '名古屋市', shortText: '名古屋市', types: ['locality'] },
    ],
    location: { latitude: 35.173, longitude: 136.899 },
    types: ['coffee_shop', 'food'],
    primaryType: 'coffee_shop',
    rating: 4.2,
    userRatingCount: 18,
    businessStatus: 'OPERATIONAL',
  },
  {
    id: 'dry_restaurant',
    displayName: { text: 'レストラン中央' },
    formattedAddress: '愛知県名古屋市中区錦',
    types: ['restaurant', 'food'],
    primaryType: 'restaurant',
    websiteUri: 'https://example.com/restaurant',
    businessStatus: 'OPERATIONAL',
  },
  {
    id: 'dry_closed_cafe',
    displayName: { text: 'カフェ 夕凪' },
    formattedAddress: '愛知県名古屋市中区新栄',
    types: ['cafe', 'food'],
    primaryType: 'cafe',
    websiteUri: 'https://example.com/yunagi',
    businessStatus: 'CLOSED_PERMANENTLY',
  },
  {
    id: 'dry_cat_cafe',
    displayName: { text: '猫カフェ もふもふ' },
    formattedAddress: '愛知県名古屋市中区栄',
    types: ['cafe', 'food'],
    primaryType: 'cafe',
    websiteUri: 'https://example.com/cat',
    businessStatus: 'OPERATIONAL',
  },
  {
    id: 'dry_komeda',
    displayName: { text: 'コメダ珈琲店 名古屋店' },
    formattedAddress: '愛知県名古屋市中区',
    types: ['cafe', 'coffee_shop', 'food'],
    primaryType: 'cafe',
    websiteUri: 'https://example.com/komeda',
    businessStatus: 'OPERATIONAL',
  },
]

// ─── 型定義 ─────────────────────────────────

interface CliOptions {
  area: string
  limit: number | null
  target: number
  dryRun: boolean
  noBlacklistSave: boolean
  userId: string
  verbose: boolean
  yes: boolean
}

interface QueryResult {
  places: RawPlace[]
  pagesFetched: number
  lastPageResults: number
}

// ─── 状態 ───────────────────────────────────

let apiRequestCount = 0
let summaryPrinted = false
const startedAt = Date.now()
const stats: FetchStats = {
  totalApiCalls: 0,
  rawCount: 0,
  uniqueCount: 0,
  duplicateCount: 0,
  notCafeTypeCount: 0,
  closedCount: 0,
  blacklistedCount: 0,
  adoptedWithWebsite: 0,
  adoptedWithoutWebsite: 0,
  savedCount: 0,
  errorCount: 0,
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
  const area = getArg(args, '--area') || 'nagoya-naka'
  const limit = parsePositiveInt(getArg(args, '--limit'), null)
  const target = parsePositiveInt(getArg(args, '--target'), 1000) || 1000
  const dryRun = hasFlag(args, '--dry-run')
  const userId = getArg(args, '--user-id') || process.env.OWNER_USER_ID || (dryRun ? '00000000-0000-0000-0000-000000000000' : '')

  return {
    area,
    limit,
    target,
    dryRun,
    noBlacklistSave: hasFlag(args, '--no-blacklist-save'),
    userId,
    verbose: hasFlag(args, '--verbose'),
    yes: hasFlag(args, '--yes'),
  }
}

function extractAddressComponent(place: RawPlace, type: string): string | null {
  return place.addressComponents?.find(component => component.types?.includes(type))?.longText || null
}

function placeName(place: RawPlace): string {
  return place.displayName?.text || '(名称なし)'
}

function classifyPlace(place: RawPlace): { status: CafeProspectRow['status']; reason: string | null } {
  if (!isCafeType(place.types, place.primaryType)) {
    return { status: 'excluded', reason: 'not_cafe_type' }
  }
  if (!isOperational(place.businessStatus)) {
    return { status: 'excluded', reason: 'closed' }
  }
  const blacklist = isBlacklisted(placeName(place), place.types)
  if (blacklist.matched) {
    return { status: 'excluded', reason: blacklist.reason }
  }
  return { status: 'untouched', reason: null }
}

function toRow(place: RawPlace, userId: string, status: CafeProspectRow['status'], reason: string | null): CafeProspectRow {
  return {
    user_id: userId,
    place_id: place.id,
    name: placeName(place),
    formatted_address: place.formattedAddress || null,
    prefecture: extractAddressComponent(place, 'administrative_area_level_1'),
    phone: place.nationalPhoneNumber || null,
    website: place.websiteUri || null,
    latitude: place.location?.latitude ?? null,
    longitude: place.location?.longitude ?? null,
    rating: place.rating ?? null,
    user_rating_count: place.userRatingCount ?? null,
    primary_type: place.primaryType || null,
    business_status: place.businessStatus || null,
    status,
    notes: reason,
    raw_data: place,
    source: 'google_places_api',
  }
}

async function promptUser(message: string): Promise<boolean> {
  const rl = createInterface({ input, output })
  const answer = await rl.question(message)
  rl.close()
  return answer.trim().toLowerCase() === 'y'
}

async function beforeApiCall(opts: CliOptions): Promise<void> {
  apiRequestCount++
  stats.totalApiCalls = apiRequestCount

  if (apiRequestCount <= MAX_API_REQUESTS) return

  console.warn(`⚠️  API 呼び出しが ${MAX_API_REQUESTS} 件を超えました（現在 ${apiRequestCount} 件）`)
  console.warn('   想定: 約125〜150件（50クエリ×最大3ページ） / Enterprise SKU 無料枠: 1,000件/月')

  if (opts.yes) return

  const ok = await promptUser('   続行しますか？ [y/N]: ')
  if (!ok) {
    console.log('🛑 ユーザー判断により処理を停止しました。')
    printSummary(opts.target)
    process.exit(0)
  }
}

async function fetchAreaPlaces(area: SearchAreaConfig, opts: CliOptions, remaining: () => number): Promise<QueryResult> {
  if (opts.dryRun) {
    const places = DRY_RUN_PLACES.slice(0, opts.limit ?? DRY_RUN_PLACES.length)
    return { places, pagesFetched: 1, lastPageResults: places.length }
  }

  const places: RawPlace[] = []
  let pageToken: string | undefined
  let pagesFetched = 0
  let lastPageResults = 0

  for (let page = 1; page <= 3; page++) {
    if (pageToken) await sleep(2100)

    const res: SearchTextResponse = await searchText({
      textQuery: area.textQuery,
      pageToken,
      onApiCall: () => beforeApiCall(opts),
    })

    pagesFetched++
    lastPageResults = res.places.length
    places.push(...res.places)
    console.log(`   ページ${page}: ${res.places.length}件取得`)

    if (remaining() <= 0) break
    if (!res.nextPageToken) break
    pageToken = res.nextPageToken
  }

  return { places, pagesFetched, lastPageResults }
}

async function upsertRows(rows: CafeProspectRow[], dryRun: boolean): Promise<number> {
  if (rows.length === 0) return 0

  if (dryRun) {
    rows.forEach(row => console.log(`   [DRY] 保存予定: ${row.name} (${row.status}${row.notes ? `/${row.notes}` : ''})`))
    return rows.length
  }

  if (!supabase) {
    console.error('❌ Supabase 環境変数が未設定です。.env.local を確認してください。')
    process.exit(1)
  }

  // 既存チェックは複合UNIQUE (user_id, place_id) に合わせ user_id でも絞る。
  // service_role キーは RLS を bypass するため、絞らないと他ユーザーの同一 place_id を
  // 誤って拾い、verified/promoted 保護が別ユーザーの状態を参照してしまう。
  const ownerId = rows[0].user_id
  const existingByPlaceId = new Map<string, { status: string | null; notes: string | null }>()
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const placeIds = rows.slice(i, i + BATCH_SIZE).map(row => row.place_id)
    const { data, error } = await supabase
      .from('cafe_prospects')
      .select('place_id, status, notes')
      .eq('user_id', ownerId)
      .in('place_id', placeIds)

    if (error) {
      console.error('⚠️  既存チェックに失敗しました:', error.message)
      continue
    }

    for (const item of data || []) {
      existingByPlaceId.set(item.place_id, { status: item.status, notes: item.notes })
    }
  }

  const rowsToUpsert = rows.map(row => {
    const existing = existingByPlaceId.get(row.place_id)
    if (!existing || !existing.status || existing.status === 'untouched' || existing.status === 'excluded') {
      return row
    }

    return {
      ...row,
      status: existing.status as CafeProspectRow['status'],
      notes: existing.notes,
    }
  })

  let saved = 0
  for (let i = 0; i < rowsToUpsert.length; i += BATCH_SIZE) {
    const batch = rowsToUpsert.slice(i, i + BATCH_SIZE)
    const { error } = await supabase
      .from('cafe_prospects')
      .upsert(batch, { onConflict: 'user_id,place_id', ignoreDuplicates: false })

    if (!error) {
      saved += batch.length
      continue
    }

    console.error(`❌ 保存エラー（${batch.length}件）:`, error.message)
    for (let j = 0; j < batch.length; j += 10) {
      const smallBatch = batch.slice(j, j + 10)
      const retry = await supabase
        .from('cafe_prospects')
        .upsert(smallBatch, { onConflict: 'user_id,place_id', ignoreDuplicates: false })
      if (retry.error) {
        console.error(`❌ 再投入失敗（${smallBatch.length}件）:`, retry.error.message)
        stats.errorCount += smallBatch.length
      } else {
        saved += smallBatch.length
      }
    }
  }

  return saved
}

function printSummary(target: number): void {
  if (summaryPrinted) return
  summaryPrinted = true

  const adoptedTotal = stats.adoptedWithWebsite + stats.adoptedWithoutWebsite
  const targetLabel = stats.adoptedWithWebsite >= target
    ? '🎯 目標達成'
    : `⚠️ 目標未達（${stats.adoptedWithWebsite}/${target}）`

  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✅ 完了')
  console.log(`   総API呼び出し数: ${apiRequestCount}`)
  console.log(`   取得（重複排除前）: ${stats.rawCount}件`)
  console.log(`   重複排除後: ${stats.uniqueCount}件`)
  console.log(`   カテゴリ外除外: ${stats.notCafeTypeCount}件（notes='not_cafe_type'）`)
  console.log(`   閉業・休業除外: ${stats.closedCount}件（notes='closed'）`)
  console.log(`   ブラックリスト除外: ${stats.blacklistedCount}件（notes='blacklist:*'）`)
  console.log(`   採用（status='untouched'）: ${adoptedTotal}件`)
  console.log(`     ├ websiteUri あり: ${stats.adoptedWithWebsite}件 ← 目標カウント対象 ${targetLabel}`)
  console.log(`     └ websiteUri なし: ${stats.adoptedWithoutWebsite}件（保存済み、目標カウント外）`)
  console.log(`   保存成功: ${stats.savedCount}件`)
  console.log(`   保存失敗: ${stats.errorCount}件`)
  console.log(`   所要時間: ${formatDuration(Date.now() - startedAt)}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📊 課金影響レポート')
  console.log(`   総 API 呼び出し数: ${apiRequestCount}`)
  console.log('   SKU 階層: Enterprise（最高SKU適用）')
  console.log(`   無料枠（1,000件/月）使用率: ${(apiRequestCount / 1000 * 100).toFixed(1)}%`)
  console.log(`   想定課金額: ${apiRequestCount <= 1000 ? '$0（無料枠内）' : `約 $${((apiRequestCount - 1000) * 0.035).toFixed(2)}（無料枠超過分）`}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

function validateEnv(opts: CliOptions): void {
  if (!opts.userId) {
    console.error('❌ OWNER_USER_ID が未設定です。--user-id または .env.local の OWNER_USER_ID を指定してください。')
    process.exit(1)
  }

  if (!opts.dryRun) {
    if (!process.env.GOOGLE_PLACES_API_KEY) {
      console.error('❌ GOOGLE_PLACES_API_KEY が未設定です。.env.local を確認してください。')
      process.exit(1)
    }
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.error('❌ NEXT_PUBLIC_SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が未設定です。')
      process.exit(1)
    }
  }
}

// ─── メイン処理 ──────────────────────────────

async function main() {
  const opts = parseArgs()
  validateEnv(opts)

  const areas = SEARCH_AREAS[opts.area]
  if (!areas) {
    console.error(`❌ 未知のエリアです: ${opts.area}`)
    console.error(`   利用可能: ${Object.keys(SEARCH_AREAS).join(', ')}`)
    process.exit(1)
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('☕ カフェ見込み顧客取得（Google Places API）')
  console.log(`   エリア: ${opts.area}`)
  console.log(`   目標件数: ${opts.target}`)
  console.log(`   上限: ${opts.limit ?? 'なし'}件`)
  console.log(`   モード: ${opts.dryRun ? 'DRY RUN（API/DBに接続しない）' : '本番'}`)
  console.log('   実行環境: 自宅IP制限済みの Mac mini 想定')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')

  const seenPlaceIds = new Set<string>()
  const groupCounts = new Map<string, number>()
  let consecutiveFullPages = 0
  let shouldStop = false

  process.on('SIGINT', () => {
    console.log('')
    console.log('🛑 中断しました。')
    printSummary(opts.target)
    process.exit(0)
  })

  for (let areaIndex = 0; areaIndex < areas.length; areaIndex++) {
    if (shouldStop) break
    if (opts.limit && stats.uniqueCount >= opts.limit) break
    if (stats.adoptedWithWebsite >= opts.target) break

    const area = areas[areaIndex]
    const groupKey = area.group ?? area.id
    const already = groupCounts.get(groupKey) ?? 0

    if (area.maxCount && already >= area.maxCount) {
      console.log(`⏭️  グループ ${groupKey} は上限 ${area.maxCount} 達成済み。スキップ: ${area.id}`)
      continue
    }

    console.log(`🔍 [${areaIndex + 1}/${areas.length}] "${area.textQuery}" 検索中...`)

    const beforeUnique = stats.uniqueCount
    const beforeBlacklisted = stats.blacklistedCount
    const beforeAdopted = stats.adoptedWithWebsite + stats.adoptedWithoutWebsite
    const rows: CafeProspectRow[] = []

    try {
      const queryResult = await fetchAreaPlaces(area, opts, () => {
        const current = groupCounts.get(groupKey) ?? 0
        return area.maxCount ? area.maxCount - current : Number.POSITIVE_INFINITY
      })

      stats.rawCount += queryResult.places.length

      if (queryResult.pagesFetched === 3 && queryResult.lastPageResults === 20) {
        consecutiveFullPages++
        console.log(`⚠️  満杯ページ（3ページ×20件）: ${area.id} - ${consecutiveFullPages}クエリ連続`)
        if (consecutiveFullPages >= 10) {
          console.warn('⚠️  満杯ページが10クエリ連続。想定より店舗密度が高い可能性あり。')
          console.warn('   このまま続行すると API 呼び出し数が想定を上回ります。注意して進めます。')
          consecutiveFullPages = 0
        }
      } else {
        consecutiveFullPages = 0
      }

      for (const place of queryResult.places) {
        if (opts.limit && stats.uniqueCount >= opts.limit) {
          shouldStop = true
          break
        }
        if (!place.id) {
          stats.errorCount++
          continue
        }
        if (seenPlaceIds.has(place.id)) {
          stats.duplicateCount++
          continue
        }

        seenPlaceIds.add(place.id)
        stats.uniqueCount++

        const classified = classifyPlace(place)
        if (classified.reason === 'not_cafe_type') stats.notCafeTypeCount++
        if (classified.reason === 'closed') stats.closedCount++
        if (classified.reason?.startsWith('blacklist:')) stats.blacklistedCount++

        if (classified.status === 'excluded' && classified.reason?.startsWith('blacklist:') && opts.noBlacklistSave) {
          if (opts.verbose) console.log(`⏭️  スキップ: ${placeName(place)}（${classified.reason}）`)
          continue
        }

        const website = hasWebsite(place)
        if (classified.status === 'untouched') {
          if (website) {
            stats.adoptedWithWebsite++
            groupCounts.set(groupKey, (groupCounts.get(groupKey) ?? 0) + 1)
          } else {
            stats.adoptedWithoutWebsite++
          }
        }

        if (opts.verbose && classified.reason) {
          console.log(`⏭️  スキップ: ${placeName(place)}（${classified.reason}）`)
        }

        rows.push(toRow(place, opts.userId, classified.status, classified.reason))

        if (area.maxCount && (groupCounts.get(groupKey) ?? 0) >= area.maxCount) {
          console.log(`   🎯 グループ ${groupKey} が上限 ${area.maxCount}件（websiteあり）に到達`)
          break
        }
        if (stats.adoptedWithWebsite >= opts.target) {
          console.log(`🎯 目標 ${opts.target}件（websiteあり）に到達。処理終了。`)
          shouldStop = true
          break
        }
      }

      const saved = await upsertRows(rows, opts.dryRun)
      stats.savedCount += saved

      const uniqueDelta = stats.uniqueCount - beforeUnique
      const duplicateDelta = queryResult.places.length - uniqueDelta
      const blacklistedDelta = stats.blacklistedCount - beforeBlacklisted
      const adoptedDelta = stats.adoptedWithWebsite + stats.adoptedWithoutWebsite - beforeAdopted
      console.log(`   ✓ ${queryResult.places.length}件取得（うち重複${Math.max(0, duplicateDelta)}、ブラックリスト${blacklistedDelta} → 採用${adoptedDelta}件）`)
      console.log('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error'
      console.error(`❌ 検索エラー: ${area.id}: ${message}`)
      stats.errorCount++

      if (message.includes('403') || message.includes('401')) {
        console.error('   APIキー認証エラーです。IP制限または Places API 設定を確認してください。')
        process.exit(2)
      }
    }

    if (!opts.dryRun) await sleep(DELAY_BETWEEN_QUERIES_MS)
  }

  printSummary(opts.target)
}

main().catch(err => {
  console.error('❌ スクリプトエラー:', err instanceof Error ? err.message : err)
  printSummary(parsePositiveInt(getArg(process.argv.slice(2), '--target'), 1000) || 1000)
  process.exit(1)
})
