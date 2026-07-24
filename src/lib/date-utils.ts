/**
 * 営業日候補日生成ユーティリティ
 * 土日祝を除いた翌営業日3日分を自動生成
 */

// 日本の祝日（2025-2027年）
const JAPANESE_HOLIDAYS: Set<string> = new Set([
  // 2025
  '2025-01-01', '2025-01-13', '2025-02-11', '2025-02-23', '2025-02-24',
  '2025-03-20', '2025-04-29', '2025-05-03', '2025-05-04', '2025-05-05',
  '2025-05-06', '2025-07-21', '2025-08-11', '2025-09-15', '2025-09-23',
  '2025-10-13', '2025-11-03', '2025-11-23', '2025-11-24', '2025-12-23',
  // 2026
  '2026-01-01', '2026-01-12', '2026-02-11', '2026-02-23', '2026-03-20',
  '2026-04-29', '2026-05-03', '2026-05-04', '2026-05-05', '2026-05-06',
  '2026-07-20', '2026-08-11', '2026-09-21', '2026-09-22', '2026-09-23',
  '2026-10-12', '2026-11-03', '2026-11-23', '2026-12-23',
  // 2027
  '2027-01-01', '2027-01-11', '2027-02-11', '2027-02-23', '2027-03-21',
  '2027-03-22', '2027-04-29', '2027-05-03', '2027-05-04', '2027-05-05',
  '2027-07-19', '2027-08-11', '2027-09-20', '2027-09-23', '2027-10-11',
  '2027-11-03', '2027-11-23',
])

/** Date → 'YYYY-MM-DD'（ローカル日付） */
export function toDateKey(date: Date): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function isBusinessDay(date: Date): boolean {
  const day = date.getDay()
  if (day === 0 || day === 6) return false // 土日
  return !JAPANESE_HOLIDAYS.has(toDateKey(date)) // 祝日
}

/**
 * 商談提示日の候補を生成する。
 * ルール（オーナー決定 2026-07-24）:
 *  - 作成日から minLeadDays 日後以降（既定7日）
 *  - 土日・祝日を除く
 *  - blockedDates（終日イベントのある日 'YYYY-MM-DD'）を除く
 *  - その中から count 日（既定3）
 *
 * @param blockedDates カレンダーの終日イベント日。アプリUI生成時は空（＝土日祝のみ考慮）。
 *   バッチ準備時に Google カレンダーの終日イベントを渡すと除外される。
 */
export function getNextBusinessDays(
  count: number = 3,
  minLeadDays: number = 7,
  blockedDates: Set<string> = new Set(),
): { date: Date; formatted: string }[] {
  const now = new Date()
  const jstOffset = 9 * 60 * 60 * 1000
  const jstNow = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + jstOffset)

  const current = new Date(jstNow)
  current.setDate(current.getDate() + minLeadDays) // 作成日から minLeadDays 日後以降

  const results: { date: Date; formatted: string }[] = []
  let guard = 0
  while (results.length < count && guard < 400) {
    guard++
    if (isBusinessDay(current) && !blockedDates.has(toDateKey(current))) {
      const month = current.getMonth() + 1
      const day = current.getDate()
      const dayNames = ['日', '月', '火', '水', '木', '金', '土']
      results.push({
        date: new Date(current),
        formatted: `${month}月${day}日（${dayNames[current.getDay()]}）`,
      })
    }
    current.setDate(current.getDate() + 1)
  }

  return results
}

/**
 * CTA用の候補日テキストを生成
 * 例:
 * ・3月19日（水）9:00〜19:00
 * ・3月20日（木）9:00〜19:00
 * ・3月21日（金）9:00〜19:00
 */
export function generateCandidateDatesText(
  timeRange: string = '9:00〜19:00',
  blockedDates: Set<string> = new Set(),
): string {
  const days = getNextBusinessDays(3, 7, blockedDates)
  return days.map(d => `・${d.formatted} ${timeRange}`).join('\n')
}

/**
 * CTA全文を生成（候補日 + TimeRexリンク）
 */
export function generateCtaWithDates(
  bookingUrl: string = 'https://timerex.net/s/daichi_3022_c34c/a78a4d68',
  timeRange: string = '9:00〜19:00',
  blockedDates: Set<string> = new Set(),
): string {
  const dates = generateCandidateDatesText(timeRange, blockedDates)
  return [
    'ぜひ一度、15分ほどオンラインでお話しさせていただけないでしょうか。',
    '下記の日程でご都合いかがでしょうか。',
    '',
    dates,
    '',
    '上記以外でも柔軟に対応可能です。下記より空き日時をお選びいただけます。',
    '',
    '▼ 無料相談を予約する（15分）',
    bookingUrl,
  ].join('\n')
}
