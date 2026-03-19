'use client'

import { Calendar, ChevronRight, TrendingUp, Video, ExternalLink } from 'lucide-react'
import { clsx } from 'clsx'
import type { Deal } from '@/types/deals'
import { STAGE_CONFIG } from '@/types/deals'
import ActivityTimeline from './ActivityTimeline'

interface DealCardProps {
  deal: Deal
  onClick: () => void
}

function formatAmount(amount: number): string {
  if (amount >= 100_000_000) {
    const v = amount / 100_000_000
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}億円`
  }
  if (amount >= 10_000) {
    const v = amount / 10_000
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}万円`
  }
  return `${amount.toLocaleString()}円`
}

function getDateStatus(dateStr: string): 'overdue' | 'today' | 'upcoming' {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr + 'T00:00:00')
  if (d < today) return 'overdue'
  if (d.getTime() === today.getTime()) return 'today'
  return 'upcoming'
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${y}/${m}/${day}`
}

function formatMeetingDate(isoStr: string): string {
  const d = new Date(isoStr)
  const m = d.getMonth() + 1
  const day = d.getDate()
  const h = d.getHours().toString().padStart(2, '0')
  const min = d.getMinutes().toString().padStart(2, '0')
  return `${m}/${day} ${h}:${min}`
}

export default function DealCard({ deal, onClick }: DealCardProps) {
  const cfg = STAGE_CONFIG[deal.stage] ?? STAGE_CONFIG['初回接触']

  const dateStatus =
    deal.next_action_date && deal.stage !== '成約' && deal.stage !== '失注'
      ? getDateStatus(deal.next_action_date)
      : null

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl p-4 transition-all duration-150 hover:bg-gray-800/50 group"
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: info */}
        <div className="flex items-start gap-3 min-w-0">
          {/* Stage dot */}
          <div className={clsx('w-2 h-2 rounded-full mt-1.5 shrink-0', cfg.dot)} />

          <div className="min-w-0 flex-1">
            {/* Company + Contact */}
            <p className="text-sm font-semibold text-white truncate">{deal.company_name}</p>
            {deal.contact_name && (
              <p className="text-xs text-gray-400 mt-0.5 truncate">{deal.contact_name}</p>
            )}

            {/* Stage badge */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={clsx(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
                  cfg.bg,
                  cfg.color,
                  cfg.border
                )}
              >
                <span>{cfg.emoji}</span>
                <span>{cfg.label}</span>
              </span>

              {/* Probability */}
              {deal.probability != null && (
                <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                  <TrendingUp className="w-3 h-3" />
                  {deal.probability}%
                </span>
              )}
            </div>

            {/* Next action date */}
            {deal.next_action_date && (
              <div
                className={clsx('mt-2 flex items-center gap-1 text-xs', {
                  'text-red-400': dateStatus === 'overdue',
                  'text-amber-400': dateStatus === 'today',
                  'text-gray-500': dateStatus === 'upcoming',
                })}
              >
                <Calendar className="w-3 h-3" />
                <span>
                  {dateStatus === 'overdue' && '期限切れ '}
                  {dateStatus === 'today' && '今日 '}
                  {formatDate(deal.next_action_date)}
                </span>
                {deal.next_action && (
                  <span className="text-gray-500 truncate ml-1">— {deal.next_action}</span>
                )}
              </div>
            )}

            {/* Meeting date */}
            {deal.meeting_date && (
              <div className="mt-2 flex items-center gap-1 text-xs text-blue-400">
                <Video className="w-3 h-3" />
                <span>{formatMeetingDate(deal.meeting_date)}</span>
                {deal.meeting_url && (
                  <a
                    href={deal.meeting_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="inline-flex items-center gap-0.5 text-violet-400 hover:text-violet-300 transition-colors ml-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>リンク</span>
                  </a>
                )}
              </div>
            )}

            {/* Activity timeline (last 3) */}
            {Array.isArray(deal.activity_log) && deal.activity_log.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-800">
                <ActivityTimeline
                  activities={deal.activity_log}
                  maxItems={3}
                  compact
                />
              </div>
            )}
          </div>
        </div>

        {/* Right: amount + chevron */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          {deal.amount != null && (
            <span className="text-sm font-semibold text-white">{formatAmount(deal.amount)}</span>
          )}
          <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors mt-auto" />
        </div>
      </div>
    </button>
  )
}
