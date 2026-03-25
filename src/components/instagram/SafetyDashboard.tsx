'use client'

import type { DmSafetyStatus } from '@/types/instagram-safety'
import { RefreshCw, ShieldCheck, ShieldAlert, ShieldOff } from 'lucide-react'
import clsx from 'clsx'

interface SafetyDashboardProps {
  status: DmSafetyStatus
  onRefresh: () => void
}

export default function SafetyDashboard({ status, onRefresh }: SafetyDashboardProps) {
  const levelConfig = {
    safe: {
      icon: ShieldCheck,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      label: '安全',
    },
    caution: {
      icon: ShieldAlert,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      label: '注意',
    },
    danger: {
      icon: ShieldOff,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
      label: '上限到達',
    },
  }

  const cfg = levelConfig[status.safetyLevel]
  const Icon = cfg.icon

  return (
    <div className={clsx('rounded-xl border p-4', cfg.bg, cfg.border)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className={clsx('w-4 h-4', cfg.color)} />
          <span className={clsx('text-sm font-semibold', cfg.color)}>
            DM安全状況 — {cfg.label}
          </span>
        </div>
        <button
          onClick={onRefresh}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-lg font-bold text-white">{status.todayDmCount}</p>
          <p className="text-xs text-gray-500">本日送信</p>
        </div>
        <div>
          <p className="text-lg font-bold text-white">{status.effectiveLimit}</p>
          <p className="text-xs text-gray-500">上限</p>
        </div>
        <div>
          <p className="text-lg font-bold text-white">
            {status.waitSeconds > 0 ? `${Math.ceil(status.waitSeconds / 60)}分` : 'OK'}
          </p>
          <p className="text-xs text-gray-500">次まで</p>
        </div>
      </div>

      <p className="mt-2 text-xs text-gray-600 text-center">{status.warmupPhase}</p>
    </div>
  )
}
