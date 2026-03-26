'use client'

import { useState, useMemo, useCallback } from 'react'
import { Plus, LayoutList, Columns, CalendarDays, AlertTriangle, TrendingUp, DollarSign, Trophy, Percent, Search } from 'lucide-react'
import { clsx } from 'clsx'
import type { Deal, DealStage, DealStats } from '@/types/deals'
import { DEAL_STAGES, STAGE_CONFIG, ACTIVE_STAGES } from '@/types/deals'
import type { Lead, LeadOption } from '@/types/leads'
import DealCard from './DealCard'
import DealFormModal from './DealFormModal'
import KanbanBoard from './KanbanBoard'
import DealsCalendar from './DealsCalendar'

interface DealsPageProps {
  initialDeals: Deal[]
  leads: LeadOption[]
  initialLead?: LeadOption | null
}

type ViewMode = 'list' | 'kanban' | 'calendar'
type StageFilter = 'all' | 'active' | DealStage

function buildStats(deals: Deal[]): DealStats {
  const active = deals.filter(d => ACTIVE_STAGES.includes(d.stage as DealStage)).length
  const won = deals.filter(d => d.stage === '成約').length
  const lost = deals.filter(d => d.stage === '失注').length
  const pipelineAmount = deals
    .filter(d => ACTIVE_STAGES.includes(d.stage as DealStage))
    .reduce((sum, d) => sum + (d.amount ?? 0), 0)
  const weightedAmount = deals
    .filter(d => ACTIVE_STAGES.includes(d.stage as DealStage))
    .reduce((sum, d) => sum + (d.amount ?? 0) * ((d.probability ?? 0) / 100), 0)
  const closedCount = won + lost
  const winRate = closedCount > 0 ? Math.round((won / closedCount) * 100) : null
  return { total: deals.length, active, won, lost, pipelineAmount, weightedAmount, winRate }
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

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  accent?: string
}

function StatCard({ icon, label, value, sub, accent = 'text-violet-400' }: StatCardProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-start gap-3">
      <div className={clsx('mt-0.5', accent)}>{icon}</div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-lg font-bold text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function DealsPage({ initialDeals, leads, initialLead }: DealsPageProps) {
  const [deals, setDeals] = useState<Deal[]>(initialDeals)
  const [view, setView] = useState<ViewMode>('list')
  const [stageFilter, setStageFilter] = useState<StageFilter>('active')
  const [search, setSearch] = useState('')
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(!!initialLead)
  const [createInitialStage, setCreateInitialStage] = useState<DealStage>('初回接触')
  const [createInitialLead, setCreateInitialLead] = useState<LeadOption | null>(initialLead ?? null)

  const stats = useMemo(() => buildStats(deals), [deals])

  // Reminder deals: active deals with overdue or today next_action_date
  const reminderDeals = useMemo(
    () =>
      deals.filter(d => {
        if (!ACTIVE_STAGES.includes(d.stage as DealStage)) return false
        if (!d.next_action_date) return false
        const status = getDateStatus(d.next_action_date)
        return status === 'overdue' || status === 'today'
      }),
    [deals]
  )

  // List mode: filtered + searched
  const filteredDeals = useMemo(() => {
    let list = deals
    if (stageFilter === 'active') {
      list = list.filter(d => ACTIVE_STAGES.includes(d.stage as DealStage))
    } else if (stageFilter !== 'all') {
      list = list.filter(d => d.stage === stageFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        d =>
          d.company_name.toLowerCase().includes(q) ||
          (d.contact_name ?? '').toLowerCase().includes(q) ||
          (d.next_action ?? '').toLowerCase().includes(q)
      )
    }
    // Sort: active first, then by created_at desc
    return [...list].sort((a, b) => {
      const aActive = ACTIVE_STAGES.includes(a.stage as DealStage) ? 0 : 1
      const bActive = ACTIVE_STAGES.includes(b.stage as DealStage) ? 0 : 1
      if (aActive !== bActive) return aActive - bActive
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [deals, stageFilter, search])

  const handleSaved = useCallback(
    (saved: Deal) => {
      setDeals(prev => {
        const idx = prev.findIndex(d => d.id === saved.id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = saved
          return next
        }
        return [saved, ...prev]
      })
      setSelectedDeal(null)
      setShowCreateModal(false)
    },
    []
  )

  const handleDeleted = useCallback((id: string) => {
    setDeals(prev => prev.filter(d => d.id !== id))
    setSelectedDeal(null)
  }, [])

  const openCreate = (stage: DealStage = '初回接触') => {
    setCreateInitialStage(stage)
    setCreateInitialLead(null)
    setShowCreateModal(true)
  }

  const FILTER_TABS: { label: string; value: StageFilter }[] = [
    { label: 'アクティブ', value: 'active' },
    { label: '全て', value: 'all' },
    ...DEAL_STAGES.map(s => ({ label: STAGE_CONFIG[s].emoji + ' ' + STAGE_CONFIG[s].label, value: s as StageFilter })),
  ]

  return (
    <div className="flex flex-col h-full min-h-0 p-6 gap-6">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white">商談管理</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {stats.active}件のアクティブ商談 / 合計{stats.total}件
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center bg-gray-900 border border-gray-800 rounded-lg p-1">
            <button
              onClick={() => setView('list')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                view === 'list'
                  ? 'bg-violet-600 text-white'
                  : 'text-gray-400 hover:text-white'
              )}
            >
              <LayoutList className="w-3.5 h-3.5" />
              リスト
            </button>
            <button
              onClick={() => setView('kanban')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                view === 'kanban'
                  ? 'bg-violet-600 text-white'
                  : 'text-gray-400 hover:text-white'
              )}
            >
              <Columns className="w-3.5 h-3.5" />
              カンバン
            </button>
            <button
              onClick={() => setView('calendar')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                view === 'calendar'
                  ? 'bg-violet-600 text-white'
                  : 'text-gray-400 hover:text-white'
              )}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              カレンダー
            </button>
          </div>

          {/* Add button */}
          <button
            onClick={() => openCreate()}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            商談を追加
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="アクティブ商談"
          value={`${stats.active}件`}
          accent="text-violet-400"
        />
        <StatCard
          icon={<DollarSign className="w-5 h-5" />}
          label="パイプライン"
          value={stats.pipelineAmount > 0 ? formatAmount(stats.pipelineAmount) : '—'}
          sub={stats.weightedAmount > 0 ? `加重: ${formatAmount(Math.round(stats.weightedAmount))}` : undefined}
          accent="text-emerald-400"
        />
        <StatCard
          icon={<Trophy className="w-5 h-5" />}
          label="成約"
          value={`${stats.won}件`}
          accent="text-amber-400"
        />
        <StatCard
          icon={<Percent className="w-5 h-5" />}
          label="成約率"
          value={stats.winRate != null ? `${stats.winRate}%` : '—'}
          sub={stats.won + stats.lost > 0 ? `${stats.won}勝 ${stats.lost}敗` : undefined}
          accent="text-blue-400"
        />
      </div>

      {/* Reminder banner */}
      {reminderDeals.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-amber-400">
              アクション期限あり ({reminderDeals.length}件)
            </span>
          </div>
          <div className="space-y-1.5">
            {reminderDeals.map(d => {
              const status = d.next_action_date ? getDateStatus(d.next_action_date) : null
              return (
                <button
                  key={d.id}
                  onClick={() => setSelectedDeal(d)}
                  className="w-full text-left flex items-center justify-between gap-4 px-3 py-2 bg-amber-500/5 hover:bg-amber-500/10 rounded-lg transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={clsx('text-xs font-medium', {
                        'text-red-400': status === 'overdue',
                        'text-amber-400': status === 'today',
                      })}
                    >
                      {status === 'overdue' ? '期限切れ' : '今日'}
                    </span>
                    <span className="text-sm text-white truncate">{d.company_name}</span>
                    {d.next_action && (
                      <span className="text-xs text-gray-500 truncate">— {d.next_action}</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 shrink-0">{d.next_action_date}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* List view */}
      {view === 'list' && (
        <div className="flex flex-col gap-4 min-h-0 flex-1">
          {/* Filters + search */}
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            {/* Stage filter tabs */}
            <div className="flex items-center gap-1 overflow-x-auto">
              {FILTER_TABS.map(tab => (
                <button
                  key={tab.value}
                  onClick={() => setStageFilter(tab.value)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0',
                    stageFilter === tab.value
                      ? 'bg-violet-600 text-white'
                      : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800 hover:border-gray-700'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative ml-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="会社名・担当者で検索"
                className="bg-gray-900 border border-gray-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors w-52"
              />
            </div>
          </div>

          {/* Deal list */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {filteredDeals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-600">
                <p className="text-4xl mb-3">🤝</p>
                <p className="text-sm">
                  {search.trim() ? '検索結果なし' : '商談がありません'}
                </p>
                {!search.trim() && (
                  <button
                    onClick={() => openCreate()}
                    className="mt-4 text-sm text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    最初の商談を追加する →
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredDeals.map(deal => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    onClick={() => setSelectedDeal(deal)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Kanban view */}
      {view === 'kanban' && (
        <div className="flex-1 min-h-0 overflow-hidden">
          <KanbanBoard
            deals={deals}
            onCardClick={deal => setSelectedDeal(deal)}
            onAddClick={stage => openCreate(stage)}
          />
        </div>
      )}

      {/* Calendar view */}
      {view === 'calendar' && (
        <div className="flex-1 min-h-0 overflow-hidden">
          <DealsCalendar
            deals={deals}
            onDealClick={deal => setSelectedDeal(deal)}
          />
        </div>
      )}

      {/* Edit modal */}
      {selectedDeal && (
        <DealFormModal
          deal={selectedDeal}
          leads={leads}
          onClose={() => setSelectedDeal(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}

      {/* Create modal */}
      {showCreateModal && (
        <DealFormModal
          deal={null}
          initialLead={createInitialLead}
          leads={leads}
          onClose={() => {
            setShowCreateModal(false)
            setCreateInitialLead(null)
          }}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
