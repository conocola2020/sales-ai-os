'use client'

import { Eye, CheckCircle2, XCircle, Send } from 'lucide-react'
import type { SendStats } from '@/types/sending'
import clsx from 'clsx'

type Tab = '全て' | '確認待ち' | '送信済み' | '失敗'

interface StatCardProps {
  label: string
  tab: Tab
  value: number
  icon: React.ReactNode
  color: string
  bg: string
  border: string
  isActive: boolean
  onClick: () => void
}

function StatCard({ label, value, icon, color, bg, border, isActive, onClick }: StatCardProps) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'rounded-xl border p-4 flex items-center gap-4 transition-all cursor-pointer text-left w-full',
        isActive
          ? clsx(bg, border, 'ring-2 ring-offset-1 ring-offset-gray-950', border.replace('/20', '/50'))
          : clsx(bg, border, 'hover:brightness-125 opacity-70 hover:opacity-100')
      )}
    >
      <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center', bg, 'border', border)}>
        <span className={color}>{icon}</span>
      </div>
      <div>
        <p className={clsx('text-2xl font-bold', color)}>{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </button>
  )
}

interface StatsPanelProps {
  stats: SendStats
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

export default function StatsPanel({ stats, activeTab, onTabChange }: StatsPanelProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard
        label="合計"
        tab="全て"
        value={stats.total}
        icon={<Send className="w-4 h-4" />}
        color="text-violet-400"
        bg="bg-violet-500/10"
        border="border-violet-500/20"
        isActive={activeTab === '全て'}
        onClick={() => onTabChange('全て')}
      />
      <StatCard
        label="確認待ち"
        tab="確認待ち"
        value={stats.reviewing}
        icon={<Eye className="w-4 h-4" />}
        color="text-amber-400"
        bg="bg-amber-500/10"
        border="border-amber-500/20"
        isActive={activeTab === '確認待ち'}
        onClick={() => onTabChange('確認待ち')}
      />
      <StatCard
        label="送信済み"
        tab="送信済み"
        value={stats.sent}
        icon={<CheckCircle2 className="w-4 h-4" />}
        color="text-emerald-400"
        bg="bg-emerald-500/10"
        border="border-emerald-500/20"
        isActive={activeTab === '送信済み'}
        onClick={() => onTabChange('送信済み')}
      />
      <StatCard
        label="失敗"
        tab="失敗"
        value={stats.failed}
        icon={<XCircle className="w-4 h-4" />}
        color="text-red-400"
        bg="bg-red-500/10"
        border="border-red-500/20"
        isActive={activeTab === '失敗'}
        onClick={() => onTabChange('失敗')}
      />
    </div>
  )
}
