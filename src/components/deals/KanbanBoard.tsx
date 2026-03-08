'use client'

import { Plus } from 'lucide-react'
import { clsx } from 'clsx'
import type { Deal, DealStage } from '@/types/deals'
import { DEAL_STAGES, STAGE_CONFIG } from '@/types/deals'

interface KanbanBoardProps {
  deals: Deal[]
  onCardClick: (deal: Deal) => void
  onAddClick: (stage: DealStage) => void
}

function formatAmount(amount: number): string {
  if (amount >= 100_000_000) {
    const v = amount / 100_000_000
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}億`
  }
  if (amount >= 10_000) {
    const v = amount / 10_000
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}万`
  }
  return `${amount.toLocaleString()}`
}

function getDateStatus(dateStr: string): 'overdue' | 'today' | 'upcoming' {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr + 'T00:00:00')
  if (d < today) return 'overdue'
  if (d.getTime() === today.getTime()) return 'today'
  return 'upcoming'
}

interface KanbanCardProps {
  deal: Deal
  onClick: () => void
}

function KanbanCard({ deal, onClick }: KanbanCardProps) {
  const cfg = STAGE_CONFIG[deal.stage]
  const dateStatus =
    deal.next_action_date && deal.stage !== '成約' && deal.stage !== '失注'
      ? getDateStatus(deal.next_action_date)
      : null

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl p-3 transition-all duration-150 hover:bg-gray-800/50 group"
    >
      <p className="text-sm font-semibold text-white truncate">{deal.company_name}</p>
      {deal.contact_name && (
        <p className="text-xs text-gray-500 mt-0.5 truncate">{deal.contact_name}</p>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        {deal.amount != null ? (
          <span className="text-xs font-semibold text-white">{formatAmount(deal.amount)}円</span>
        ) : (
          <span />
        )}
        {deal.probability != null && (
          <span className="text-xs text-gray-500">{deal.probability}%</span>
        )}
      </div>

      {deal.next_action_date && (
        <div
          className={clsx('mt-1.5 text-xs', {
            'text-red-400': dateStatus === 'overdue',
            'text-amber-400': dateStatus === 'today',
            'text-gray-600': dateStatus === 'upcoming',
          })}
        >
          {dateStatus === 'overdue' && '⚠ '}
          {dateStatus === 'today' && '📅 '}
          {deal.next_action_date}
          {deal.next_action && (
            <span className="text-gray-600"> — {deal.next_action}</span>
          )}
        </div>
      )}
    </button>
  )
}

export default function KanbanBoard({ deals, onCardClick, onAddClick }: KanbanBoardProps) {
  const dealsByStage = DEAL_STAGES.reduce<Record<DealStage, Deal[]>>(
    (acc, stage) => {
      acc[stage] = deals.filter(d => d.stage === stage)
      return acc
    },
    {} as Record<DealStage, Deal[]>
  )

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-0">
      {DEAL_STAGES.map(stage => {
        const cfg = STAGE_CONFIG[stage]
        const stageDeals = dealsByStage[stage]
        const totalAmount = stageDeals.reduce((sum, d) => sum + (d.amount ?? 0), 0)

        return (
          <div
            key={stage}
            className="flex flex-col shrink-0 w-72 bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden"
          >
            {/* Column header */}
            <div className="px-4 py-3 border-b border-gray-800 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={clsx('w-2 h-2 rounded-full', cfg.dot)} />
                  <span className="text-sm font-medium text-white">{cfg.label}</span>
                  <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded-full">
                    {stageDeals.length}
                  </span>
                </div>
                <button
                  onClick={() => onAddClick(stage)}
                  className="p-1 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-gray-800 transition-colors"
                  title="商談を追加"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {/* Column total */}
              {totalAmount > 0 && (
                <p className="text-xs text-gray-500 mt-1 ml-4">
                  合計: {formatAmount(totalAmount)}円
                </p>
              )}
            </div>

            {/* Cards */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
              {stageDeals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-700">
                  <span className="text-2xl mb-1">{cfg.emoji}</span>
                  <p className="text-xs">商談なし</p>
                </div>
              ) : (
                stageDeals.map(deal => (
                  <KanbanCard
                    key={deal.id}
                    deal={deal}
                    onClick={() => onCardClick(deal)}
                  />
                ))
              )}

              {/* Add button at bottom of column */}
              <button
                onClick={() => onAddClick(stage)}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs text-gray-600 hover:text-gray-400 hover:bg-gray-800/50 transition-colors border border-dashed border-gray-800 hover:border-gray-700"
              >
                <Plus className="w-3 h-3" />
                追加
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
