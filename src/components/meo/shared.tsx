import clsx from 'clsx'
import { Star } from 'lucide-react'
import type { CitationStatus, ReviewReplyStatus } from '@/types/meo'

// ── サイテーション連携ステータスのバッジ ──
export function CitationStatusBadge({ status }: { status: CitationStatus }) {
  const styles: Record<CitationStatus, string> = {
    同期済み: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
    送信済み: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
    未連携: 'bg-gray-500/10 text-gray-400 border-gray-300/40',
    エラー: 'bg-red-500/10 text-red-600 border-red-500/30',
  }
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium whitespace-nowrap',
        styles[status]
      )}
    >
      <span
        className={clsx('w-1.5 h-1.5 rounded-full', {
          'bg-emerald-400': status === '同期済み',
          'bg-amber-400': status === '送信済み',
          'bg-gray-400': status === '未連携',
          'bg-red-400': status === 'エラー',
        })}
      />
      {status}
    </span>
  )
}

// ── 口コミ返信ステータスのバッジ ──
export function ReplyStatusBadge({ status }: { status: ReviewReplyStatus }) {
  const styles: Record<ReviewReplyStatus, string> = {
    未返信: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
    下書き: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    返信済み: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
    自動返信済: 'bg-violet-500/10 text-violet-600 border-violet-500/30',
    返信不要: 'bg-gray-500/10 text-gray-400 border-gray-300/40',
  }
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-medium whitespace-nowrap',
        styles[status]
      )}
    >
      {status}
    </span>
  )
}

// ── 星評価 ──
export function Stars({ rating }: { rating: number | null }) {
  const r = rating ?? 0
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={clsx(
            'w-3.5 h-3.5',
            i <= r ? 'text-amber-600 fill-amber-400' : 'text-gray-700'
          )}
        />
      ))}
    </span>
  )
}

// ── 統計カード ──
export function StatCard({
  label,
  value,
  sub,
  accent = 'violet',
}: {
  label: string
  value: string
  sub?: string
  accent?: 'violet' | 'emerald' | 'amber' | 'sky'
}) {
  const accents = {
    violet: 'text-violet-600',
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
    sky: 'text-sky-400',
  }
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <p className="text-xs text-gray-500 mb-1.5">{label}</p>
      <p className={clsx('text-2xl font-bold', accents[accent])}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

// ── デモモードバナー ──
export function DemoBanner({ isDemo }: { isDemo: boolean }) {
  if (!isDemo) return null
  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-sm text-amber-600">
      <span className="font-semibold">デモモード:</span>{' '}
      ログインするとSupabaseの実データ（コーノスパイス）に接続されます。
    </div>
  )
}
