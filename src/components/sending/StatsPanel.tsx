'use client'

import { Clock, Eye, CheckCircle2, XCircle, Send } from 'lucide-react'
import type { SendStats } from '@/types/sending'
import clsx from 'clsx'

interface StatCardProps {
  label: string
  value: number
  icon: React.ReactNode
  color: string
  bg: string
  border: string
}

function StatCard({ label, value, icon, color, bg, border }: StatCardProps) {
  return (
    <div className={clsx('rounded-xl border p-4 flex items-center gap-4', bg, border)}>
      <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center', bg, 'border', border)}>
        <span className={color}>{icon}</span>
      </div>
      <div>
        <p className={clsx('text-2xl font-bold', color)}>{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  )
}

interface StatsPanelProps {
  stats: SendStats
}

export default function StatsPanel({ stats }: StatsPanelProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <StatCard
        label="合計"
        value={stats.total}
        icon={<Send className="w-4 h-4" />}
        color="text-violet-400"
        bg="bg-violet-500/10"
        border="border-violet-500/20"
      />
      <StatCard
        label="待機中"
        value={stats.pending}
        icon={<Clock className="w-4 h-4" />}
        color="text-gray-400"
        bg="bg-gray-500/10"
        border="border-gray-500/20"
      />
      <StatCard
        label="確認待ち"
        value={stats.reviewing}
        icon={<Eye className="w-4 h-4" />}
        color="text-amber-400"
        bg="bg-amber-500/10"
        border="border-amber-500/20"
      />
      <StatCard
        label="送信済み"
        value={stats.sent}
        icon={<CheckCircle2 className="w-4 h-4" />}
        color="text-emerald-400"
        bg="bg-emerald-500/10"
        border="border-emerald-500/20"
      />
      <StatCard
        label="失敗"
        value={stats.failed}
        icon={<XCircle className="w-4 h-4" />}
        color="text-red-400"
        bg="bg-red-500/10"
        border="border-red-500/20"
      />
    </div>
  )
}
