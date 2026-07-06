import Link from 'next/link'
import { ArrowRight, Bot, MessageSquare, Share2 } from 'lucide-react'
import type { MeoData } from '@/app/dashboard/meo/actions'
import { StatCard, Stars, ReplyStatusBadge, CitationStatusBadge, DemoBanner } from './shared'

export default function MeoDashboard({ data }: { data: MeoData }) {
  const { location, reviews, citations, aioChecks, isDemo } = data

  const synced = citations.filter((c) => c.status === '同期済み').length
  const unreplied = reviews.filter((r) => r.reply_status === '未返信').length
  const avgRating =
    reviews.length > 0
      ? (
          reviews.reduce((sum, r) => sum + (r.rating ?? 0), 0) / reviews.length
        ).toFixed(1)
      : '—'
  const mentioned = aioChecks.filter((c) => c.mentioned).length
  const visibilityRate =
    aioChecks.length > 0 ? Math.round((mentioned / aioChecks.length) * 100) : 0

  const aiCitations = citations.filter((c) => c.kind === 'ai')
  const recentReviews = reviews.slice(0, 4)

  return (
    <div className="space-y-6">
      <DemoBanner isDemo={isDemo} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">MEO / AIO ダッシュボード</h1>
          <p className="text-sm text-gray-500 mt-1">
            {location.name}（{location.category}） — {location.address}
          </p>
        </div>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="サイテーション数"
          value={`${synced}`}
          sub={`全${citations.length}件中 同期済み`}
          accent="emerald"
        />
        <StatCard
          label="平均評価"
          value={`★ ${avgRating}`}
          sub={`口コミ ${reviews.length}件`}
          accent="amber"
        />
        <StatCard
          label="未返信の口コミ"
          value={String(unreplied)}
          sub="AI返信生成で対応"
          accent={unreplied > 0 ? 'amber' : 'emerald'}
        />
        <StatCard
          label="AIO可視率"
          value={`${visibilityRate}%`}
          sub={`${mentioned}/${aioChecks.length} クエリでAIが言及`}
          accent="violet"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 最近の口コミ */}
        <section className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <MessageSquare className="w-4 h-4 text-violet-400" />
              <h2 className="text-sm font-bold text-white">最近の口コミ</h2>
            </div>
            <Link
              href="/dashboard/meo/reviews"
              className="text-xs text-violet-400 hover:text-violet-300 inline-flex items-center gap-1"
            >
              すべて見る <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-800/50">
            {recentReviews.map((r) => (
              <div key={r.id} className="px-5 py-4">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-white font-medium">{r.author}</span>
                    <Stars rating={r.rating} />
                  </div>
                  <ReplyStatusBadge status={r.reply_status} />
                </div>
                <p className="text-sm text-gray-500 line-clamp-2">{r.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* AIリスティング状況 */}
        <section className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Bot className="w-4 h-4 text-violet-400" />
              <h2 className="text-sm font-bold text-white">AIリスティング</h2>
            </div>
            <Link
              href="/dashboard/meo/citations"
              className="text-xs text-violet-400 hover:text-violet-300 inline-flex items-center gap-1"
            >
              サイテーション一覧 <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-800/50">
            {aiCitations.map((c) => (
              <div key={c.id} className="px-5 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center text-xs font-bold text-violet-300">
                    {c.name.slice(0, 1)}
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">{c.name}</p>
                    {c.domain && <p className="text-xs text-gray-500">{c.domain}</p>}
                  </div>
                </div>
                <CitationStatusBadge status={c.status} />
              </div>
            ))}
          </div>
          <div className="px-5 py-4 border-t border-gray-800">
            <Link
              href="/dashboard/meo/aio"
              className="inline-flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 font-medium"
            >
              <Share2 className="w-4 h-4" />
              AIO可視性チェックを実行する
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
