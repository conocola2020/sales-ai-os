'use client'

import { ArrowRight, Video, StickyNote, Mail, RefreshCw } from 'lucide-react'
import { clsx } from 'clsx'
import type { DealActivity } from '@/types/deals'

interface ActivityTimelineProps {
  activities: DealActivity[]
  maxItems?: number
  compact?: boolean
}

const ACTIVITY_ICONS: Record<DealActivity['type'], React.ReactNode> = {
  stage_change: <RefreshCw className="w-3 h-3" />,
  meeting: <Video className="w-3 h-3" />,
  note: <StickyNote className="w-3 h-3" />,
  email: <Mail className="w-3 h-3" />,
}

const ACTIVITY_COLORS: Record<DealActivity['type'], { dot: string; icon: string }> = {
  stage_change: { dot: 'bg-violet-500', icon: 'text-violet-400' },
  meeting: { dot: 'bg-blue-500', icon: 'text-blue-400' },
  note: { dot: 'bg-amber-500', icon: 'text-amber-400' },
  email: { dot: 'bg-emerald-500', icon: 'text-emerald-400' },
}

function formatActivityDate(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return 'たった今'
  if (diffMin < 60) return `${diffMin}分前`
  if (diffHours < 24) return `${diffHours}時間前`
  if (diffDays < 7) return `${diffDays}日前`

  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${m}/${day}`
}

export default function ActivityTimeline({
  activities,
  maxItems,
  compact = false,
}: ActivityTimelineProps) {
  const sorted = [...activities].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
  const displayed = maxItems ? sorted.slice(0, maxItems) : sorted

  if (displayed.length === 0) {
    return (
      <p className="text-xs text-gray-600 py-2">アクティビティなし</p>
    )
  }

  return (
    <div className={clsx('relative', compact ? 'max-h-32' : 'max-h-64', 'overflow-y-auto')}>
      <div className="space-y-0">
        {displayed.map((activity, idx) => {
          const colors = ACTIVITY_COLORS[activity.type] ?? ACTIVITY_COLORS.note
          const isLast = idx === displayed.length - 1

          return (
            <div key={`${activity.date}-${idx}`} className="flex gap-2.5">
              {/* Timeline line + dot */}
              <div className="flex flex-col items-center shrink-0">
                <div
                  className={clsx(
                    'w-5 h-5 rounded-full flex items-center justify-center shrink-0',
                    colors.dot + '/20'
                  )}
                >
                  <span className={colors.icon}>{ACTIVITY_ICONS[activity.type]}</span>
                </div>
                {!isLast && (
                  <div className="w-px flex-1 bg-gray-800 my-0.5" />
                )}
              </div>

              {/* Content */}
              <div className={clsx('pb-3 min-w-0 flex-1', isLast && 'pb-0')}>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    {formatActivityDate(activity.date)}
                  </span>
                </div>
                <p className={clsx('text-gray-300 mt-0.5', compact ? 'text-[11px]' : 'text-xs')}>
                  {activity.description}
                </p>
                {activity.type === 'stage_change' && activity.from && activity.to && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">
                      {activity.from}
                    </span>
                    <ArrowRight className="w-2.5 h-2.5 text-gray-600" />
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400">
                      {activity.to}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {maxItems && sorted.length > maxItems && (
        <p className="text-[10px] text-gray-600 mt-1 text-center">
          他 {sorted.length - maxItems}件
        </p>
      )}
    </div>
  )
}
