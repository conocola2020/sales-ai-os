'use client'

import { useState } from 'react'
import {
  BarChart3, Users, Send, MessageSquare, Handshake, Instagram,
  TrendingUp, TrendingDown, Target, DollarSign, Download,
  ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react'
import clsx from 'clsx'
import type { Lead } from '@/types/leads'
import type { SendStats } from '@/types/sending'
import type { ReplyStats } from '@/types/replies'
import type { DealStats } from '@/types/deals'
import type { InstagramStats } from '@/types/instagram'

interface ReportsPageProps {
  leads: Lead[]
  sendStats: SendStats
  replyStats: ReplyStats
  dealStats: DealStats
  igStats: InstagramStats
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  trend,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  color: string
  trend?: 'up' | 'down' | 'flat'
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-500 font-medium">{label}</span>
        <div className={clsx('p-1.5 rounded-lg', color)}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && (
        <div className="flex items-center gap-1 mt-1">
          {trend === 'up' && <ArrowUpRight className="w-3 h-3 text-emerald-400" />}
          {trend === 'down' && <ArrowDownRight className="w-3 h-3 text-red-400" />}
          {trend === 'flat' && <Minus className="w-3 h-3 text-gray-500" />}
          <span className={clsx('text-xs', {
            'text-emerald-400': trend === 'up',
            'text-red-400': trend === 'down',
            'text-gray-500': !trend || trend === 'flat',
          })}>{sub}</span>
        </div>
      )}
    </div>
  )
}

function BarChartSimple({
  data,
  label,
}: {
  data: { name: string; value: number; color: string }[]
  label: string
}) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div>
      <p className="text-xs text-gray-500 mb-3 font-medium">{label}</p>
      <div className="space-y-2">
        {data.map(d => (
          <div key={d.name} className="flex items-center gap-3">
            <span className="text-xs text-gray-400 w-20 truncate">{d.name}</span>
            <div className="flex-1 bg-gray-800 rounded-full h-5 overflow-hidden">
              <div
                className={clsx('h-full rounded-full transition-all duration-500', d.color)}
                style={{ width: `${(d.value / max) * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-300 w-8 text-right font-medium">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PipelineFunnel({
  stages,
}: {
  stages: { name: string; value: number; color: string }[]
}) {
  const max = Math.max(...stages.map(s => s.value), 1)
  return (
    <div className="space-y-1">
      {stages.map((stage, i) => (
        <div key={stage.name} className="relative">
          <div
            className={clsx('h-10 rounded-lg flex items-center px-4 justify-between transition-all', stage.color)}
            style={{ width: `${Math.max((stage.value / max) * 100, 30)}%` }}
          >
            <span className="text-xs font-medium text-white truncate">{stage.name}</span>
            <span className="text-xs font-bold text-white">{stage.value}</span>
          </div>
          {i < stages.length - 1 && (
            <div className="absolute -bottom-0.5 left-4 text-gray-600 text-[10px]">|</div>
          )}
        </div>
      ))}
    </div>
  )
}

export default function ReportsPage({
  leads,
  sendStats,
  replyStats,
  dealStats,
  igStats,
}: ReportsPageProps) {
  const [exporting, setExporting] = useState<string | null>(null)

  const replyRate = sendStats.sent > 0
    ? Math.round((replyStats.total / sendStats.sent) * 100)
    : 0

  const conversionRate = replyStats.total > 0
    ? Math.round((dealStats.won / Math.max(replyStats.total, 1)) * 100)
    : 0

  // Industry breakdown
  const industryMap = new Map<string, number>()
  leads.forEach(l => {
    const ind = l.industry || 'その他'
    industryMap.set(ind, (industryMap.get(ind) || 0) + 1)
  })
  const industryData = [...industryMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name, value, color: 'bg-violet-500' }))

  // Status breakdown
  const statusMap = new Map<string, number>()
  leads.forEach(l => {
    statusMap.set(l.status, (statusMap.get(l.status) || 0) + 1)
  })
  const statusData = [
    { name: '未着手', value: statusMap.get('未着手') || 0, color: 'bg-gray-500' },
    { name: '送信済み', value: statusMap.get('送信済み') || 0, color: 'bg-blue-500' },
    { name: '返信あり', value: statusMap.get('返信あり') || 0, color: 'bg-violet-500' },
    { name: '商談中', value: statusMap.get('商談中') || 0, color: 'bg-amber-500' },
    { name: '成約', value: statusMap.get('成約') || 0, color: 'bg-emerald-500' },
    { name: 'NG', value: statusMap.get('NG') || 0, color: 'bg-red-500' },
  ]

  // Pipeline funnel
  const funnelStages = [
    { name: 'リード', value: leads.length, color: 'bg-blue-600' },
    { name: '送信済み', value: sendStats.sent, color: 'bg-violet-600' },
    { name: '返信あり', value: replyStats.total, color: 'bg-amber-600' },
    { name: '商談中', value: dealStats.active, color: 'bg-orange-600' },
    { name: '成約', value: dealStats.won, color: 'bg-emerald-600' },
  ]

  const handleExport = async (type: string) => {
    setExporting(type)
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, format: 'csv' }),
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${type}_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('エクスポートに失敗しました')
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-800 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-violet-400" />
              レポート・分析
            </h1>
            <p className="text-sm text-gray-500 mt-1">営業活動全体のパフォーマンスを可視化</p>
          </div>
          <div className="flex gap-2">
            {(['leads', 'deals', 'instagram'] as const).map(type => (
              <button
                key={type}
                onClick={() => handleExport(type)}
                disabled={exporting === type}
                className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                <Download className="w-3 h-3" />
                {type === 'leads' ? 'リード' : type === 'deals' ? '商談' : 'IG'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            label="総リード"
            value={leads.length}
            icon={Users}
            color="bg-blue-500/10 text-blue-400"
          />
          <StatCard
            label="送信数"
            value={sendStats.sent}
            sub={`失敗: ${sendStats.failed}`}
            icon={Send}
            color="bg-violet-500/10 text-violet-400"
            trend={sendStats.sent > 0 ? 'up' : 'flat'}
          />
          <StatCard
            label="返信率"
            value={`${replyRate}%`}
            sub={`${replyStats.total}件`}
            icon={MessageSquare}
            color="bg-amber-500/10 text-amber-400"
            trend={replyRate > 10 ? 'up' : replyRate > 0 ? 'flat' : undefined}
          />
          <StatCard
            label="成約率"
            value={dealStats.winRate != null ? `${dealStats.winRate}%` : '---'}
            sub={`成約: ${dealStats.won}件`}
            icon={Target}
            color="bg-emerald-500/10 text-emerald-400"
            trend={dealStats.winRate != null && dealStats.winRate > 20 ? 'up' : 'flat'}
          />
          <StatCard
            label="パイプライン"
            value={`${Math.round(dealStats.pipelineAmount / 10000)}万`}
            sub={`加重: ${Math.round(dealStats.weightedAmount / 10000)}万`}
            icon={DollarSign}
            color="bg-orange-500/10 text-orange-400"
          />
          <StatCard
            label="IG返信率"
            value={igStats.replyRate != null ? `${igStats.replyRate}%` : '---'}
            sub={`DM: ${igStats.dmSent}件`}
            icon={Instagram}
            color="bg-pink-500/10 text-pink-400"
          />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Pipeline Funnel */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-violet-400" />
              営業パイプライン
            </h3>
            <PipelineFunnel stages={funnelStages} />
            <div className="mt-4 pt-4 border-t border-gray-800 flex items-center justify-between">
              <span className="text-xs text-gray-500">リード → 成約 転換率</span>
              <span className="text-sm font-bold text-emerald-400">{conversionRate}%</span>
            </div>
          </div>

          {/* Reply Sentiment */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-amber-400" />
              返信分析
            </h3>
            <BarChartSimple
              label="センチメント内訳"
              data={[
                { name: '興味あり', value: replyStats.interested, color: 'bg-emerald-500' },
                { name: '検討中', value: replyStats.considering, color: 'bg-amber-500' },
                { name: '質問', value: replyStats.questions, color: 'bg-violet-500' },
                { name: 'お断り', value: replyStats.declined, color: 'bg-red-500' },
                { name: 'その他', value: replyStats.other, color: 'bg-gray-500' },
              ]}
            />
            <div className="mt-4 pt-4 border-t border-gray-800 grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-lg font-bold text-white">{replyStats.total}</p>
                <p className="text-xs text-gray-500">総返信</p>
              </div>
              <div>
                <p className="text-lg font-bold text-emerald-400">{replyStats.interested}</p>
                <p className="text-xs text-gray-500">興味あり</p>
              </div>
              <div>
                <p className="text-lg font-bold text-amber-400">{replyStats.unread}</p>
                <p className="text-xs text-gray-500">未読</p>
              </div>
            </div>
          </div>

          {/* Industry breakdown */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              業界別リード分布
            </h3>
            {industryData.length > 0 ? (
              <BarChartSimple label="" data={industryData} />
            ) : (
              <p className="text-sm text-gray-500 py-8 text-center">データがありません</p>
            )}
          </div>

          {/* Status breakdown */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-400" />
              リードステータス分布
            </h3>
            <BarChartSimple label="" data={statusData} />
          </div>

          {/* Deal summary */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Handshake className="w-4 h-4 text-orange-400" />
              商談サマリー
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-white">{dealStats.total}</p>
                <p className="text-xs text-gray-500 mt-1">総商談数</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-emerald-400">{dealStats.won}</p>
                <p className="text-xs text-gray-500 mt-1">成約</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-amber-400">{dealStats.active}</p>
                <p className="text-xs text-gray-500 mt-1">進行中</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-red-400">{dealStats.lost}</p>
                <p className="text-xs text-gray-500 mt-1">失注</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-800">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">パイプライン合計</span>
                <span className="text-white font-bold">{dealStats.pipelineAmount.toLocaleString()}円</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-500">加重見込み額</span>
                <span className="text-emerald-400 font-bold">{Math.round(dealStats.weightedAmount).toLocaleString()}円</span>
              </div>
            </div>
          </div>

          {/* Instagram summary */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Instagram className="w-4 h-4 text-pink-400" />
              Instagram活動レポート
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-white">{igStats.total}</p>
                <p className="text-xs text-gray-500 mt-1">ターゲット</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-pink-400">{igStats.approached}</p>
                <p className="text-xs text-gray-500 mt-1">アプローチ済</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-violet-400">{igStats.dmSent}</p>
                <p className="text-xs text-gray-500 mt-1">DM送信</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-emerald-400">{igStats.converted}</p>
                <p className="text-xs text-gray-500 mt-1">成約</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-800 flex justify-between items-center">
              <span className="text-xs text-gray-500">DM返信率</span>
              <span className="text-lg font-bold text-pink-400">
                {igStats.replyRate != null ? `${igStats.replyRate}%` : '---'}
              </span>
            </div>
          </div>
        </div>

        {/* Send performance */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Send className="w-4 h-4 text-violet-400" />
            送信パフォーマンス
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-4 text-center">
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-xl font-bold text-white">{sendStats.total}</p>
              <p className="text-xs text-gray-500">総キュー</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-xl font-bold text-gray-400">{sendStats.pending}</p>
              <p className="text-xs text-gray-500">待機中</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-xl font-bold text-amber-400">{sendStats.reviewing}</p>
              <p className="text-xs text-gray-500">確認待ち</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-xl font-bold text-emerald-400">{sendStats.sent}</p>
              <p className="text-xs text-gray-500">送信済み</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-xl font-bold text-red-400">{sendStats.failed}</p>
              <p className="text-xs text-gray-500">失敗</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
