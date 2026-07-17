'use client'

import Link from 'next/link'
import {
  Users, Send, MessageSquare, TrendingUp, Zap, ArrowUpRight,
  Handshake, Clock, AlertCircle, Instagram, Target, DollarSign,
  ListChecks, ShieldCheck, CalendarDays, BarChart3,
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

function formatCurrency(value: number): string {
  return `${Math.round(value).toLocaleString()}円`
}

export default function DashboardOverview({
  leads,
  sendStats,
  replyStats,
  dealStats,
  igStats,
  upcomingDeals = [],
}: DashboardOverviewProps) {
  const totalLeads = Array.isArray(leads) ? leads.length : leads.total
  const untouchedLeads = Array.isArray(leads)
    ? leads.filter((lead) => lead.status === '未着手').length
    : leads.untouched
  const replyRate = sendStats.sent > 0
    ? Math.round((replyStats.total / sendStats.sent) * 100)
    : 0

  const operations = [
    {
      label: 'リード総数',
      value: totalLeads.toLocaleString(),
      detail: `${untouchedLeads.toLocaleString()}件未着手`,
      icon: Users,
      tone: 'text-sky-300',
      surface: 'bg-sky-400/10 border-sky-400/20',
      href: '/dashboard/leads',
    },
    {
      label: '送信数',
      value: sendStats.sent.toLocaleString(),
      detail: `確認待ち ${sendStats.reviewing.toLocaleString()}件`,
      icon: Send,
      tone: 'text-teal-300',
      surface: 'bg-teal-400/10 border-teal-400/20',
      href: '/dashboard/sending',
    },
    {
      label: '返信受信数',
      value: replyStats.total.toLocaleString(),
      detail: `未読 ${replyStats.unread.toLocaleString()}件`,
      icon: MessageSquare,
      tone: 'text-emerald-300',
      surface: 'bg-emerald-400/10 border-emerald-400/20',
      href: '/dashboard/replies',
    },
    {
      label: '返信率',
      value: `${replyRate}%`,
      detail: `興味あり ${replyStats.interested.toLocaleString()}件`,
      icon: TrendingUp,
      tone: 'text-amber-300',
      surface: 'bg-amber-400/10 border-amber-400/20',
      href: '/dashboard/reports',
    },
  ]

  const focusItems = [
    {
      label: '確認待ちキュー',
      value: sendStats.reviewing,
      unit: '件',
      icon: ListChecks,
      href: '/dashboard/sending',
      tone: 'text-amber-300 bg-amber-400/10 border-amber-400/20',
    },
    {
      label: '未読返信',
      value: replyStats.unread,
      unit: '件',
      icon: MessageSquare,
      href: '/dashboard/replies',
      tone: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20',
    },
    {
      label: '進行中の商談',
      value: dealStats.active,
      unit: '件',
      icon: Handshake,
      href: '/dashboard/deals',
      tone: 'text-sky-300 bg-sky-400/10 border-sky-400/20',
    },
    {
      label: '送信失敗',
      value: sendStats.failed,
      unit: '件',
      icon: AlertCircle,
      href: '/dashboard/sending',
      tone: 'text-red-300 bg-red-400/10 border-red-400/20',
    },
  ]

  const pipeline = [
    { stage: 'コンタクト済み', count: sendStats.sent, color: 'bg-sky-400' },
    { stage: '返信あり', count: replyStats.total, color: 'bg-teal-400' },
    { stage: '商談中', count: dealStats.active, color: 'bg-amber-400' },
    { stage: '成約', count: dealStats.won, color: 'bg-emerald-400' },
  ]

  const pipelineMax = Math.max(...pipeline.map(p => p.count), 1)
  const quickActions = [
    { label: 'リード追加', icon: Users, href: '/dashboard/leads', desc: '候補を登録' },
    { label: '文面生成', icon: Zap, href: '/dashboard/compose', desc: 'AIで作成' },
    { label: '送信管理', icon: Send, href: '/dashboard/sending', desc: 'キュー確認' },
    { label: 'レポート', icon: BarChart3, href: '/dashboard/reports', desc: '成果を見る' },
  ]

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 p-4 md:p-6 xl:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-300/80">Command Center</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white md:text-3xl">営業ダッシュボード</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-400">
            リード、送信、返信、商談の状態をひとつの流れで把握できます。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2">
            <div className="h-2 w-2 rounded-full bg-emerald-300" />
            <span className="text-xs font-medium text-emerald-200 sm:text-sm">稼働中</span>
          </div>
          <Link
            href="/dashboard/compose"
            className="flex items-center gap-2 rounded-lg bg-teal-300 px-4 py-2.5 text-sm font-bold text-neutral-950 transition-colors hover:bg-teal-200"
          >
            <Zap className="w-4 h-4" />
            文面生成
          </Link>
        </div>
      </div>

      {/* Operations summary */}
      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-2xl border border-white/[0.08] bg-[#111315] p-4 shadow-[0_22px_70px_rgba(0,0,0,0.24)] md:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">営業オペレーション</h2>
              <p className="mt-1 text-xs text-stone-500">状態確認から次の作業へ移りやすい指標</p>
            </div>
            <Link href="/dashboard/reports" className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-200 hover:text-white">
              詳細レポート <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {operations.map((stat) => {
              const Icon = stat.icon
              return (
                <Link
                  key={stat.label}
                  href={stat.href}
                  className="group rounded-xl border border-white/[0.08] bg-white/[0.035] p-4 transition-all hover:border-white/[0.16] hover:bg-white/[0.06]"
                >
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <div className={clsx('flex h-10 w-10 items-center justify-center rounded-lg border', stat.surface)}>
                      <Icon className={clsx('h-5 w-5', stat.tone)} />
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-stone-600 transition-colors group-hover:text-stone-300" />
                  </div>
                  <p className="text-2xl font-bold tracking-tight text-white">{stat.value}</p>
                  <div className="mt-1 flex flex-col gap-0.5">
                    <p className="text-xs font-medium text-stone-300">{stat.label}</p>
                    <p className="text-xs text-stone-500">{stat.detail}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#111315] p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">優先確認</h2>
              <p className="mt-1 text-xs text-stone-500">滞留しやすい項目</p>
            </div>
            <ShieldCheck className="h-4 w-4 text-teal-300" />
          </div>
          <div className="space-y-2">
            {focusItems.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className="group flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 transition-all hover:border-white/[0.14] hover:bg-white/[0.06]"
                >
                  <div className={clsx('flex h-9 w-9 items-center justify-center rounded-lg border', item.tone)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-stone-200 group-hover:text-white">{item.label}</p>
                    <p className="text-xs text-stone-500">現在 {item.value.toLocaleString()}{item.unit}</p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-stone-600 group-hover:text-stone-300" />
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* Middle section */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Pipeline */}
        <Link href="/dashboard/deals" className="block rounded-2xl border border-white/[0.08] bg-[#111315] p-5 transition-all hover:border-white/[0.16] hover:bg-[#15181b]">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">営業パイプライン</h2>
              <p className="mt-1 text-xs text-stone-500">接点から成約まで</p>
            </div>
            <Handshake className="h-4 w-4 text-stone-500" />
          </div>
          <div className="space-y-4">
            {pipeline.map((stage) => {
              const pct = Math.round((stage.count / pipelineMax) * 100)
              return (
                <div key={stage.stage}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-sm text-stone-300">{stage.stage}</span>
                    <span className="text-sm font-semibold text-white">{stage.count.toLocaleString()}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
                    <div
                      className={`h-full ${stage.color} rounded-full transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-5 border-t border-white/[0.08] pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-stone-400">成約率</span>
              <span className="font-semibold text-emerald-300">
                {dealStats.winRate != null ? `${dealStats.winRate}%` : '---'}
              </span>
            </div>
          </div>
        </Link>

        {/* Key Metrics */}
        <Link href="/dashboard/deals" className="block rounded-2xl border border-white/[0.08] bg-[#111315] p-5 transition-all hover:border-white/[0.16] hover:bg-[#15181b]">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">重要指標</h2>
              <p className="mt-1 text-xs text-stone-500">売上見込みとリスク</p>
            </div>
            <Target className="h-4 w-4 text-stone-500" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
              <div className="flex items-center gap-3">
                <DollarSign className="h-4 w-4 text-amber-300" />
                <span className="text-sm text-stone-300">パイプライン合計</span>
              </div>
              <span className="text-sm font-bold text-white">{formatCurrency(dealStats.pipelineAmount)}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
              <div className="flex items-center gap-3">
                <Target className="h-4 w-4 text-emerald-300" />
                <span className="text-sm text-stone-300">加重見込み額</span>
              </div>
              <span className="text-sm font-bold text-emerald-300">{formatCurrency(dealStats.weightedAmount)}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
              <div className="flex items-center gap-3">
                <Instagram className="h-4 w-4 text-pink-300" />
                <span className="text-sm text-stone-300">IG DM返信率</span>
              </div>
              <span className="text-sm font-bold text-pink-300">
                {igStats.replyRate != null ? `${igStats.replyRate}%` : '---'}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-4 w-4 text-red-300" />
                <span className="text-sm text-stone-300">送信失敗</span>
              </div>
              <span className="text-sm font-bold text-red-300">{sendStats.failed.toLocaleString()}件</span>
            </div>
          </div>
        </Link>

        {/* Upcoming Deals */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#111315] p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">商談予定</h2>
              <p className="mt-1 text-xs text-stone-500">直近のアクション</p>
            </div>
            <Link href="/dashboard/deals" className="flex items-center gap-1 text-xs font-medium text-teal-200 hover:text-white">
              一覧 <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          {upcomingDeals.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.10] py-10 text-center">
              <Clock className="mb-3 h-8 w-8 text-stone-600" />
              <p className="text-sm text-stone-500">直近の予定はありません</p>
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
                    className="group flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 transition-all hover:border-white/[0.14] hover:bg-white/[0.06]"
                  >
                    <div className={clsx(
                      'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border text-xs font-bold',
                      urgent
                        ? 'border-red-400/20 bg-red-400/10 text-red-300'
                        : 'border-teal-400/20 bg-teal-400/10 text-teal-300'
                    )}>
                      {dateLabel || <CalendarDays className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-stone-200 transition-colors group-hover:text-white">
                        {deal.company_name}
                      </p>
                      <p className="truncate text-xs text-stone-500">
                        {deal.next_action || deal.stage}
                      </p>
                    </div>
                    {deal.meeting_url && (
                      <div className="flex-shrink-0">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-400/10">
                          <ArrowUpRight className="h-3.5 w-3.5 text-emerald-300" />
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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {quickActions.map((action) => {
          const Icon = action.icon
          return (
            <Link
              key={action.label}
              href={action.href}
              className="group flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.035] p-3 transition-all hover:border-white/[0.15] hover:bg-white/[0.06]"
            >
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-teal-400/20 bg-teal-400/10 transition-colors group-hover:bg-teal-400/15">
                <Icon className="h-4 w-4 text-teal-300" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-stone-200 transition-colors group-hover:text-white">{action.label}</p>
                <p className="truncate text-xs text-stone-500">{action.desc}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
