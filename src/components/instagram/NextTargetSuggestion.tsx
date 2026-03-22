'use client'

import type { InstagramTarget } from '@/types/instagram'
import { MessageCircle, Sparkles } from 'lucide-react'

interface NextTargetSuggestionProps {
  targets: InstagramTarget[]
  canSendNow: boolean
  onOpenDm: (target: InstagramTarget) => void
}

export default function NextTargetSuggestion({
  targets,
  canSendNow,
  onOpenDm,
}: NextTargetSuggestionProps) {
  const next = targets.find(t => !t.dm_sent && t.status !== 'NG')

  if (!next) return null

  return (
    <div className="bg-gray-900 border border-violet-500/20 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-violet-400" />
        <span className="text-sm font-semibold text-violet-300">次のおすすめターゲット</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white">@{next.username}</p>
          {next.display_name && (
            <p className="text-xs text-gray-500 mt-0.5">{next.display_name}</p>
          )}
        </div>
        <button
          onClick={() => onOpenDm(next)}
          disabled={!canSendNow}
          className="flex items-center gap-1.5 px-3 py-2 bg-violet-600/20 border border-violet-500/30 text-violet-300 rounded-lg text-xs font-medium hover:bg-violet-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          DM送信
        </button>
      </div>
    </div>
  )
}
