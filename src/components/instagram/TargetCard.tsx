'use client'

import { Heart, UserPlus, MessageCircle, Users, ThumbsUp, Reply } from 'lucide-react'
import { clsx } from 'clsx'
import type { InstagramTarget } from '@/types/instagram'
import { STATUS_CONFIG } from '@/types/instagram'

interface TargetCardProps {
  target: InstagramTarget
  onEdit: () => void
  onOpenDm: () => void
  onToggleLiked: () => void
  onToggleFollowing: () => void
}

function formatFollowers(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(n % 10000 === 0 ? 0 : 1)}万`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toString()
}

function AvatarIcon({ username }: { username: string }) {
  const letter = username.charAt(0).toUpperCase()
  // Pick a color based on first char code
  const colors = [
    'from-violet-500 to-purple-600',
    'from-blue-500 to-cyan-600',
    'from-pink-500 to-rose-600',
    'from-amber-500 to-orange-600',
    'from-emerald-500 to-teal-600',
  ]
  const color = colors[username.charCodeAt(0) % colors.length]
  return (
    <div
      className={clsx(
        'w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold text-sm shrink-0',
        color
      )}
    >
      {letter}
    </div>
  )
}

export default function TargetCard({
  target,
  onEdit,
  onOpenDm,
  onToggleLiked,
  onToggleFollowing,
}: TargetCardProps) {
  const cfg = STATUS_CONFIG[target.status]

  return (
    <div className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl p-4 transition-all duration-150">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <button onClick={onEdit} className="shrink-0">
          <AvatarIcon username={target.username} />
        </button>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <button
                onClick={onEdit}
                className="text-sm font-semibold text-white hover:text-violet-400 transition-colors truncate block"
              >
                @{target.username}
              </button>
              {target.display_name && (
                <p className="text-xs text-gray-400 mt-0.5 truncate">{target.display_name}</p>
              )}
            </div>

            {/* Status badge */}
            <span
              className={clsx(
                'shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
                cfg.bg,
                cfg.color,
                cfg.border
              )}
            >
              <span>{cfg.emoji}</span>
              <span>{cfg.label}</span>
            </span>
          </div>

          {/* Bio */}
          {target.bio && (
            <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{target.bio}</p>
          )}

          {/* Meta row: industry + follower count + engagement */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            {target.industry && (
              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                {target.industry}
              </span>
            )}
            {target.follower_count != null && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Users className="w-3 h-3" />
                {formatFollowers(target.follower_count)}
              </span>
            )}
            {target.engagement_rate != null && (
              <span className="text-xs text-gray-500">
                エンゲ {target.engagement_rate}%
              </span>
            )}
          </div>

          {/* Action row */}
          <div className="mt-3 flex items-center gap-1 flex-wrap">
            {/* いいね toggle */}
            <button
              onClick={e => { e.stopPropagation(); onToggleLiked() }}
              title={target.liked ? 'いいね済み（クリックで解除）' : 'いいね'}
              className={clsx(
                'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all',
                target.liked
                  ? 'bg-pink-500/15 text-pink-400 border-pink-500/30'
                  : 'bg-gray-800 text-gray-500 border-gray-700 hover:text-pink-400 hover:border-pink-500/30'
              )}
            >
              <Heart className={clsx('w-3 h-3', target.liked && 'fill-pink-400')} />
              {target.liked ? 'いいね済' : 'いいね'}
            </button>

            {/* フォロー toggle */}
            <button
              onClick={e => { e.stopPropagation(); onToggleFollowing() }}
              title={target.following ? 'フォロー済み（クリックで解除）' : 'フォロー'}
              className={clsx(
                'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all',
                target.following
                  ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                  : 'bg-gray-800 text-gray-500 border-gray-700 hover:text-blue-400 hover:border-blue-500/30'
              )}
            >
              <UserPlus className="w-3 h-3" />
              {target.following ? 'フォロー済' : 'フォロー'}
            </button>

            {/* DM ボタン */}
            <button
              onClick={e => { e.stopPropagation(); onOpenDm() }}
              title="DMを管理"
              className={clsx(
                'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all',
                target.dm_sent
                  ? 'bg-violet-500/15 text-violet-400 border-violet-500/30'
                  : 'bg-gray-800 text-gray-500 border-gray-700 hover:text-violet-400 hover:border-violet-500/30'
              )}
            >
              <MessageCircle className={clsx('w-3 h-3', target.dm_sent && 'fill-violet-400/30')} />
              {target.dm_sent ? 'DM済み' : 'DM送信'}
            </button>

            {/* Reaction badges */}
            <div className="ml-auto flex items-center gap-1">
              {target.liked_back && (
                <span title="いいね返しあり" className="flex items-center gap-0.5 text-xs text-pink-400">
                  <ThumbsUp className="w-3 h-3" />
                </span>
              )}
              {target.followed_back && (
                <span title="フォロー返しあり" className="flex items-center gap-0.5 text-xs text-blue-400">
                  <UserPlus className="w-3 h-3" />
                </span>
              )}
              {target.dm_replied && (
                <span title="DM返信あり" className="flex items-center gap-0.5 text-xs text-amber-400">
                  <Reply className="w-3 h-3" />
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
