'use client'

import { Building2, ExternalLink, Circle } from 'lucide-react'
import clsx from 'clsx'
import type { Reply } from '@/types/replies'
import { SENTIMENT_CONFIG } from '@/types/replies'

interface ReplyCardProps {
  reply: Reply
  onClick: (reply: Reply) => void
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'たった今'
  if (minutes < 60) return `${minutes}分前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}時間前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}日前`
  return new Date(dateStr).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
}

export default function ReplyCard({ reply, onClick }: ReplyCardProps) {
  const cfg = SENTIMENT_CONFIG[reply.sentiment]
  const lead = reply.lead

  return (
    <button
      onClick={() => onClick(reply)}
      className={clsx(
        'w-full text-left rounded-xl border transition-all group',
        reply.is_read
          ? 'bg-gray-900 border-gray-800 hover:border-gray-700'
          : 'bg-gray-900/80 border-gray-700 hover:border-violet-500/50 shadow-sm shadow-violet-500/5'
      )}
    >
      <div className="flex items-start gap-3 p-4">
        {/* Unread dot */}
        <div className="flex-shrink-0 mt-1.5">
          {!reply.is_read ? (
            <Circle className="w-2 h-2 text-violet-400 fill-violet-400" />
          ) : (
            <div className="w-2 h-2" />
          )}
        </div>

        {/* Avatar */}
        <div
          className={clsx(
            'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold border',
            reply.is_read
              ? 'bg-gray-800 border-gray-700 text-gray-400'
              : 'bg-gray-700 border-gray-600 text-white'
          )}
        >
          {lead?.company_name?.charAt(0) ?? '?'}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Header row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={clsx(
                  'text-sm font-semibold truncate',
                  reply.is_read ? 'text-gray-300' : 'text-white'
                )}
              >
                {lead?.company_name ?? '不明な会社'}
              </span>
              {lead?.contact_name && (
                <span className="text-xs text-gray-500 truncate hidden sm:block">
                  {lead.contact_name}
                </span>
              )}
            </div>
            <span className="text-xs text-gray-600 flex-shrink-0">
              {timeAgo(reply.created_at)}
            </span>
          </div>

          {/* Sentiment badge */}
          <div className="flex items-center gap-2">
            <span
              className={clsx(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border',
                cfg.bg,
                cfg.border,
                cfg.color
              )}
            >
              {cfg.emoji} {cfg.label}
            </span>
            {lead?.website_url && (
              <a
                href={lead.website_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="text-gray-600 hover:text-gray-400 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          {/* Reply preview */}
          <p
            className={clsx(
              'text-xs leading-relaxed line-clamp-2',
              reply.is_read ? 'text-gray-500' : 'text-gray-400'
            )}
          >
            {reply.content}
          </p>

          {/* AI response indicator */}
          {reply.ai_response && (
            <div className="flex items-center gap-1.5 text-[11px] text-violet-400/70">
              <Building2 className="w-3 h-3" />
              <span>返信文案あり</span>
            </div>
          )}
        </div>
      </div>
    </button>
  )
}
