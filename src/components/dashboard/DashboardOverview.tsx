'use client'

import Link from 'next/link'
import {
  Users, Send, MessageSquare, TrendingUp, Zap, ArrowUpRight,
  Building2, Handshake, Clock, CheckCircle2, AlertCircle,
  Instagram, Target, DollarSign,
} from 'lucide-react'
import clsx from 'clsx'
import type { Lead } from '@/types/leads'
import type { SendStats } from '@/types/sending'
import type { ReplyStats } from '@/types/replies'
import type { DealStats } from '@/types/deals'
import type { InstagramStats } from '@/types/instagram'
import type { UpcomingDeal } from '@/app/dashboard/deals/actions'

interface LeadSummary {
  total: number
  untouched: number
}

interface DashboardOverviewProps {
  leads: Lead[] | LeadSummary
  sendStats: SendStats
  replyStats: ReplyStats
  dealStats: DealStats
  igStats: InstagramStats
  upcomingDeals?: UpcomingDeal[]
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const month = d.getMonth() + 1
  const day = d.getDate()
  const weekdays = ['日', '月', '火', '水', '木', '金', '土']
  const weekday = weekdays[d.getDay()]
  return `${month}/${day}(${weekday})`
}

function isToday(dateStr: string): boolean {
  const today = new Date().toISOString().split('T')[0]
  return dateStr.split('T')[0] === today
}

function isTomorrow(dateStr: string): boolean {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  return dateStr.split('T')[0] === tomorrow
}

export default function DashboardOverview({
  leads,
  sendStats,
  replyStats,
  dealStats,
  igStats,
  upcomingDeals = [],
}: DashboardOverviewProps) {
  const replyRate = sendStats.sent > 0
    ? Math.round((replyStats.total / sendStats.sent) * 100)
    : 0

  const stats = [
    {
      label: 'リード総数',
      value: (Array.isArray(leads) ? leads.length : leads.total).toLocaleString(),
      change: `${Array.isArray(leads) ? leads.filter(l => l.status === '未着手').length : leads.untouched}件未着手`,
      icon: Users,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
      href: '/dashboard/leads',
    },
    {
      label: '送信数',
      value: sendStats.sent.toString(),
      change: `確認待ち: ${sendStats.reviewing}件`,
      icon: Send,
      color: 'text-violet-400',
      bg: 'bg-violet-500/10',
      border: 'border-violet-500/20',
      href: '/dashboard/sending',
    },
    {
      label: '返信受信数',
      value: replyStats.total.toString(),
      change: `未読: ${replyStats.unread}件`,
      icon: MessageSquare,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      href: '/dashboard/replies',
    },
    {
      label: '返信率',
      value: `${replyRate}%`,
      change: `興味あり: ${replyStats.interested}件`,
      icon: TrendingUp,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      href: '/dashboard/reports',
    },
  ]

  const pipeline = [
    { stage: 'コンタクト済み', count: sendStats.sent, color: 'bg-blue-500' },
    { stage: '返信あり', count: replyStats.total, color: 'bg-violet-500' },
    { stage: '商談中', count: dealStats.active, color: 'bg-amber-500' },
    { stage: '成約', count: dealStats.won, color: 'bg-emerald-500' },
  ]

  const pipelineMax = Math.max(...pipeline.map(p => p.count), 1)

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">ダッシュボード</h1>
          <p className="text-gray-400 text-sm mt-1">営業活動の全体像を確認</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-emerald-400 text-xs sm:text-sm font-medium">システム稼働中</span>
          </div>
          <Link
            href="/dashboard/compose"
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <Zap className="w-4 h-4" />
            文面生成
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-4 md:p-5 hover:border-gray-600 hover:bg-gray-800/50 transition-all group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-3 md:mb-4">
                <div className={`w-10 h-10 ${stat.bg} border ${stat.border} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div className="flex items-center gap-1 text-xs font-medium text-gray-500 text-right leading-tight">
                  {stat.change}
                </div>
              </div>
              <p className="text-xl md:text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-gray-400 text-xs md:text-sm mt-1">{stat.label}</p>
            </Link>
          )
        })}
      </div>

      {/* Middle section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Pipeline */}
        <Link href="/dashboard/deals" className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-gray-600 hover:bg-gray-800/30 transition-all cursor-pointer block">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-white">営業パイプライン</h2>
            <Handshake className="w-4 h-4 text-gray-500" />
          </div>
          <div className="space-y-4">
            {pipeline.map((stage) => {
              const pct = Math.round((stage.count / pipelineMax) * 100)
              return (
                <div key={stage.stage}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-gray-300">{stage.stage}</span>
                    <span className="text-sm font-semibold text-white">{stage.count}</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${stage.color} rounded-full transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-5 pt-4 border-t border-gray-800">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">成約率</span>
              <span className="text-emerald-400 font-semibold">
                {dealStats.winRate != null ? `${dealStats.winRate}%` : '---'}
              </span>
            </div>
          </div>
        </Link>

        {/* Key Metrics */}
        <Link href="/dashboard/deals" className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-gray-600 hover:bg-gray-800/30 transition-all cursor-pointer block">
          <h2 className="text-base font-semibold text-white mb-5">重要指標</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-xl">
              <div className="flex items-center gap-3">
                <DollarSign className="w-4 h-4 text-orange-400" />
                <span className="text-sm text-gray-300">パイプライン合計</span>
              </div>
              <span className="text-sm font-bold text-white">{dealStats.pipelineAmount.toLocaleString()}円</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-xl">
              <div className="flex items-center gap-3">
                <Target className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-gray-300">加重見込み額</span>
              </div>
              <span className="text-sm font-bold text-emerald-400">{Math.round(dealStats.weightedAmount).toLocaleString()}円</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-xl">
              <div className="flex items-center gap-3">
                <Instagram className="w-4 h-4 text-pink-400" />
                <span className="text-sm text-gray-300">IG DM返信率</span>
              </div>
              <span className="text-sm font-bold text-pink-400">
                {igStats.replyRate != null ? `${igStats.replyRate}%` : '---'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-xl">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span className="text-sm text-gray-300">送信失敗</span>
              </div>
              <span className="text-sm font-bold text-red-400">{sendStats.failed}件</span>
            </div>
          </div>
        </Link>

        {/* Upcoming Deals */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-white">商談予定</h2>
            <Link href="/dashboard/deals" className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
              すべて見る <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          {upcomingDeals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Clock className="w-8 h-8 text-gray-600 mb-3" />
              <p className="text-sm text-gray-500">直近の予定はありません</p>
              <p className="text-xs text-gray-600 mt-1">商談が作成されるとここに表示されます</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingDeals.map((deal) => {
                const dateStr = deal.meeting_date || deal.next_action_date || ''
                const dateLabel = dateStr
                  ? isToday(dateStr) ? '今日' : isTomorrow(dateStr) ? '明日' : formatDate(dateStr)
                  : ''
                const urgent = dateStr ? isToday(dateStr) : false
                return (
                  <Link
                    key={deal.id}
                    href="/dashboard/deals"
                    className="flex items-center gap-3 p-3 bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 hover:border-gray-600 rounded-xl transition-all group"
                  >
                    <div className={clsx(
                      'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold',
                      urgent
                        ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                        : 'bg-violet-500/10 border border-violet-500/20 text-violet-400'
                    )}>
                      {dateLabel}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors truncate">
                        {deal.company_name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {deal.next_action || deal.stage}
                      </p>
                    </div>
                    {deal.meeting_url && (
                      <div className="flex-shrink-0">
                        <div className="w-6 h-6 bg-emerald-500/10 border border-emerald-500/20 rounded flex items-center justify-center">
                          <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                        </div>
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {[
          { label: 'リードをインポート', icon: Users, href: '/dashboard/leads', desc: 'CSVから一括登録' },
          { label: '文面を生成', icon: Zap, href: '/dashboard/compose', desc: 'AIで営業文章作成' },
          { label: '送信を管理', icon: Send, href: '/dashboard/sending', desc: '送信キュー管理' },
          { label: 'レポートを確認', icon: TrendingUp, href: '/dashboard/reports', desc: '成果分析・可視化' },
        ].map((action) => {
          const Icon = action.icon
          return (
            <Link
              key={action.label}
              href={action.href}
              className="flex items-center gap-3 p-3 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-600 rounded-xl transition-all group"
            >
              <div className="w-9 h-9 bg-violet-500/10 border border-violet-500/20 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-violet-500/20 transition-colors">
                <Icon className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">{action.label}</p>
                <p className="text-xs text-gray-500">{action.desc}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
