'use client'

import { useState, useMemo } from 'react'
import {
  Plus, Search, Users, MessageCircle, Heart, TrendingUp,
  UserCheck, ChevronDown, ChevronUp, Filter,
} from 'lucide-react'
import { clsx } from 'clsx'
import type { InstagramTarget, InstagramStatus, InstagramStats } from '@/types/instagram'
import { INSTAGRAM_STATUSES, STATUS_CONFIG } from '@/types/instagram'
import { toggleFlag } from '@/app/dashboard/instagram/actions'
import TargetCard from './TargetCard'
import TargetFormModal from './TargetFormModal'
import DmModal from './DmModal'

// ──────────────────────────────────────────
// Props
// ──────────────────────────────────────────
interface InstagramPageProps {
  initialTargets: InstagramTarget[]
  initialStats: InstagramStats
}

// ──────────────────────────────────────────
// Stats card
// ──────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500">{label}</span>
        <div className={clsx('p-1.5 rounded-lg', color)}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

// ──────────────────────────────────────────
// Main component
// ──────────────────────────────────────────
type StatusFilter = 'all' | 'approached' | InstagramStatus

const FILTER_TABS: { label: string; value: StatusFilter }[] = [
  { label: '全て', value: 'all' },
  { label: '👋 アプローチ候補', value: 'approached' },
  ...INSTAGRAM_STATUSES.map(s => ({
    label: `${STATUS_CONFIG[s].emoji} ${STATUS_CONFIG[s].label}`,
    value: s as StatusFilter,
  })),
]

export default function InstagramPage({ initialTargets, initialStats }: InstagramPageProps) {
  const [targets, setTargets] = useState<InstagramTarget[]>(initialTargets)
  const [stats, setStats] = useState<InstagramStats>(initialStats)

  // Modals
  const [formTarget, setFormTarget] = useState<InstagramTarget | null | undefined>(undefined)
  // undefined = closed, null = create new, InstagramTarget = edit existing
  const [dmTarget, setDmTarget] = useState<InstagramTarget | null>(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')

  // Candidate panel collapse
  const [showCandidates, setShowCandidates] = useState(true)

  // ── Derived stats ──────────────────────────────────────────────
  const computedStats = useMemo<InstagramStats>(() => {
    const total = targets.length
    const approached = targets.filter(t => t.liked || t.following).length
    const dmSent = targets.filter(t => t.dm_sent).length
    const replied = targets.filter(t => t.dm_replied).length
    const converted = targets.filter(t => t.status === '成約').length
    const replyRate = dmSent > 0 ? Math.round((replied / dmSent) * 100) : null
    return { total, approached, dmSent, replied, converted, replyRate }
  }, [targets])

  const displayStats = targets.length > 0 ? computedStats : stats

  // ── Candidate lists ────────────────────────────────────────────
  const likeCandidates = useMemo(
    () => targets.filter(t => !t.liked && t.status !== '成約' && t.status !== 'NG').slice(0, 10),
    [targets]
  )
  const followCandidates = useMemo(
    () => targets.filter(t => !t.following && t.status !== '成約' && t.status !== 'NG').slice(0, 10),
    [targets]
  )

  // ── Filtered list ──────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = targets

    if (statusFilter === 'approached') {
      list = list.filter(t => !t.liked || !t.following)
    } else if (statusFilter !== 'all') {
      list = list.filter(t => t.status === statusFilter)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        t =>
          t.username.toLowerCase().includes(q) ||
          (t.display_name ?? '').toLowerCase().includes(q) ||
          (t.bio ?? '').toLowerCase().includes(q) ||
          (t.industry ?? '').toLowerCase().includes(q)
      )
    }

    return list
  }, [targets, statusFilter, search])

  // ── Optimistic state helpers ───────────────────────────────────
  const updateLocal = (updated: InstagramTarget) =>
    setTargets(prev => prev.map(t => (t.id === updated.id ? updated : t)))

  const removeLocal = (id: string) =>
    setTargets(prev => prev.filter(t => t.id !== id))

  const addLocal = (t: InstagramTarget) =>
    setTargets(prev => [t, ...prev])

  // ── Quick toggle (liked / following) ──────────────────────────
  const handleToggleLiked = async (target: InstagramTarget) => {
    const newVal = !target.liked
    updateLocal({ ...target, liked: newVal })
    const { data, error } = await toggleFlag(target.id, 'liked', newVal)
    if (error || !data) {
      updateLocal(target) // revert
    } else {
      updateLocal(data)
    }
  }

  const handleToggleFollowing = async (target: InstagramTarget) => {
    const newVal = !target.following
    updateLocal({ ...target, following: newVal })
    const { data, error } = await toggleFlag(target.id, 'following', newVal)
    if (error || !data) {
      updateLocal(target)
    } else {
      updateLocal(data)
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Page header ── */}
      <div className="px-6 py-5 border-b border-gray-800 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-semibold text-white">Instagram 半自動化</h1>
          <button
            onClick={() => setFormTarget(null)}
            className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            ターゲット追加
          </button>
        </div>
        <p className="text-sm text-gray-500">Instagramアカウントへのアプローチを管理する</p>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 min-h-0">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard
            label="総ターゲット"
            value={displayStats.total}
            icon={Users}
            color="bg-gray-800 text-gray-400"
          />
          <StatCard
            label="アプローチ済み"
            value={displayStats.approached}
            sub={displayStats.total > 0 ? `${Math.round((displayStats.approached / displayStats.total) * 100)}%` : undefined}
            icon={Heart}
            color="bg-pink-500/10 text-pink-400"
          />
          <StatCard
            label="DM送信"
            value={displayStats.dmSent}
            icon={MessageCircle}
            color="bg-violet-500/10 text-violet-400"
          />
          <StatCard
            label="返信あり"
            value={displayStats.replied}
            icon={UserCheck}
            color="bg-amber-500/10 text-amber-400"
          />
          <StatCard
            label="返信率"
            value={displayStats.replyRate != null ? `${displayStats.replyRate}%` : '—'}
            sub={`成約: ${displayStats.converted}件`}
            icon={TrendingUp}
            color="bg-emerald-500/10 text-emerald-400"
          />
        </div>

        {/* ── Approach candidates panel ── */}
        {(likeCandidates.length > 0 || followCandidates.length > 0) && (
          <div className="bg-gray-900 border border-blue-500/20 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowCandidates(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-blue-400 hover:bg-blue-500/5 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                アプローチ候補 — いいね {likeCandidates.length}件 / フォロー {followCandidates.length}件
              </span>
              {showCandidates ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {showCandidates && (
              <div className="px-4 pb-4 space-y-4">
                {/* Like candidates */}
                {likeCandidates.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">❤️ いいね候補</p>
                    <div className="flex flex-wrap gap-2">
                      {likeCandidates.map(t => (
                        <button
                          key={t.id}
                          onClick={() => handleToggleLiked(t)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/20 text-pink-400 rounded-lg text-xs font-medium transition-all"
                        >
                          <Heart className="w-3 h-3" />
                          @{t.username}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Follow candidates */}
                {followCandidates.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">👥 フォロー候補</p>
                    <div className="flex flex-wrap gap-2">
                      {followCandidates.map(t => (
                        <button
                          key={t.id}
                          onClick={() => handleToggleFollowing(t)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 rounded-lg text-xs font-medium transition-all"
                        >
                          <Users className="w-3 h-3" />
                          @{t.username}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Filter tabs + search ── */}
        <div className="space-y-3">
          {/* Status filter tabs */}
          <div className="flex gap-1.5 flex-wrap">
            {FILTER_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                  statusFilter === tab.value
                    ? 'bg-violet-600/20 text-violet-400 border-violet-500/30'
                    : 'bg-gray-900 text-gray-400 border-gray-800 hover:border-gray-700'
                )}
              >
                {tab.label}
                {tab.value === 'all' && (
                  <span className="ml-1.5 text-gray-500 font-normal">{targets.length}</span>
                )}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ユーザー名・業種・プロフィールで検索..."
              className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>
        </div>

        {/* ── Target list ── */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center mb-4">
              <Users className="w-7 h-7 text-gray-600" />
            </div>
            {search || statusFilter !== 'all' ? (
              <>
                <p className="text-gray-400 font-medium">条件に一致するターゲットがありません</p>
                <p className="text-sm text-gray-600 mt-1">フィルターや検索条件を変更してください</p>
              </>
            ) : (
              <>
                <p className="text-gray-400 font-medium">ターゲットがまだいません</p>
                <p className="text-sm text-gray-600 mt-1 mb-4">
                  「ターゲット追加」からInstagramアカウントを登録してください
                </p>
                <button
                  onClick={() => setFormTarget(null)}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  最初のターゲットを追加
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 pb-1">
              {filtered.length}件{filtered.length < targets.length ? ` / 全${targets.length}件` : ''}
            </p>
            {filtered.map(target => (
              <TargetCard
                key={target.id}
                target={target}
                onEdit={() => setFormTarget(target)}
                onOpenDm={() => setDmTarget(target)}
                onToggleLiked={() => handleToggleLiked(target)}
                onToggleFollowing={() => handleToggleFollowing(target)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Modals ── */}

      {/* Target form (create / edit) */}
      {formTarget !== undefined && (
        <TargetFormModal
          target={formTarget}
          onClose={() => setFormTarget(undefined)}
          onSaved={saved => {
            if (formTarget === null) {
              addLocal(saved)
            } else {
              updateLocal(saved)
            }
            setFormTarget(undefined)
          }}
          onDeleted={id => {
            removeLocal(id)
            setFormTarget(undefined)
          }}
        />
      )}

      {/* DM modal */}
      {dmTarget && (
        <DmModal
          target={dmTarget}
          onClose={() => setDmTarget(null)}
          onUpdated={updated => {
            updateLocal(updated)
            setDmTarget(updated)
          }}
        />
      )}
    </div>
  )
}
