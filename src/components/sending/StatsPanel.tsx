'use client'

import { Eye, CheckCircle2, XCircle, Send, AlertTriangle, Globe, Ban } from 'lucide-react'
import type { SendStats } from '@/types/sending'
import clsx from 'clsx'

type Tab = '全て' | '確認待ち' | '手動対応' | '送信済み' | '失敗' | 'フォーム未検出' | '送信不可'

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
  urgent?: boolean
}

function StatCard({ label, value, icon, color, bg, border, isActive, onClick, urgent }: StatCardProps) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'rounded-xl border p-4 flex items-center gap-4 transition-all cursor-pointer text-left w-full relative',
        isActive
          ? clsx(bg, border, 'ring-2 ring-offset-1 ring-offset-gray-950', border.replace('/20', '/50'))
          : clsx(bg, border, 'hover:brightness-125 opacity-70 hover:opacity-100')
      )}
    >
      {urgent && value > 0 && (
        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center">
          <span className="text-[9px] font-bold text-gray-900">{value}</span>
        </span>
      )}
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
    <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
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
        label="手動対応"
        tab="手動対応"
        value={stats.manual}
        icon={<AlertTriangle className="w-4 h-4" />}
        color="text-yellow-400"
        bg="bg-yellow-500/10"
        border="border-yellow-500/20"
        isActive={activeTab === '手動対応'}
        onClick={() => onTabChange('手動対応')}
        urgent
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
      <StatCard
        label="フォーム未検出"
        tab="フォーム未検出"
        value={stats.formNotFound}
        icon={<Globe className="w-4 h-4" />}
        color="text-orange-400"
        bg="bg-orange-500/10"
        border="border-orange-500/20"
        isActive={activeTab === 'フォーム未検出'}
        onClick={() => onTabChange('フォーム未検出')}
      />
      <StatCard
        label="送信不可"
        tab="送信不可"
        value={stats.unsendable}
        icon={<Ban className="w-4 h-4" />}
        color="text-gray-400"
        bg="bg-gray-500/10"
        border="border-gray-500/20"
        isActive={activeTab === '送信不可'}
        onClick={() => onTabChange('送信不可')}
      />
    </div>
  )
}
