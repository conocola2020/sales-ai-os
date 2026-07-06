'use client'

import { useState, useTransition } from 'react'
import { Bot, Mic, Globe, ExternalLink, Send, Loader2, CheckCircle2 } from 'lucide-react'
import type { MeoCitation, MeoLocation, CitationKind } from '@/types/meo'
import { CitationStatusBadge, DemoBanner } from './shared'
import { updateCitationStatus } from '@/app/dashboard/meo/actions'

interface Props {
  location: MeoLocation
  citations: MeoCitation[]
  isDemo: boolean
}

const SECTIONS: { kind: CitationKind; title: string; icon: typeof Bot; note: string }[] = [
  { kind: 'ai', title: 'AIリスティング', icon: Bot, note: 'AI検索エンジンへの店舗情報の配信状況' },
  { kind: 'voice', title: 'ボイスアシスタントリスティング', icon: Mic, note: '音声アシスタントの店舗検索への同期状況' },
  { kind: 'platform', title: 'プラットフォームリスティング', icon: Globe, note: 'ローカルディレクトリへの掲載状況' },
]

export default function CitationsPage({ location, citations, isDemo }: Props) {
  const [items, setItems] = useState(citations)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [, startTransition] = useTransition()

  const syncedCount = items.filter((c) => c.status === '同期済み').length

  const handleRegister = (citation: MeoCitation) => {
    setError('')
    setPendingId(citation.id)
    startTransition(async () => {
      const { error } = await updateCitationStatus(citation.id, '送信済み')
      if (error) {
        setError(error)
      } else {
        setItems((prev) =>
          prev.map((c) => (c.id === citation.id ? { ...c, status: '送信済み' as const } : c))
        )
      }
      setPendingId(null)
    })
  }

  return (
    <div className="space-y-6">
      <DemoBanner isDemo={isDemo} />

      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">サイテーション一覧</h1>
          <p className="text-sm text-gray-500 mt-1">
            AI・音声アシスタント・ローカルプラットフォームへの店舗情報配信状況
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-gray-300">
          ロケーション: <span className="text-white font-medium">{location.name}</span>
        </div>
      </div>

      {/* サイテーション数 */}
      <div className="inline-flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-6 py-4">
        <CheckCircle2 className="w-6 h-6 text-emerald-400" />
        <div>
          <p className="text-xs text-emerald-300/80">サイテーション数（同期済み / 全体）</p>
          <p className="text-2xl font-bold text-emerald-400">
            {syncedCount}
            <span className="text-sm font-normal text-emerald-300/60"> / {items.length}</span>
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* セクション */}
      {SECTIONS.map(({ kind, title, icon: Icon, note }) => {
        const rows = items.filter((c) => c.kind === kind)
        if (rows.length === 0) return null
        return (
          <section key={kind} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-3">
              <Icon className="w-4 h-4 text-violet-400" />
              <h2 className="text-sm font-bold text-white">{title}</h2>
              <span className="text-xs text-gray-500 hidden sm:inline">{note}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-800/70 bg-gray-950/50">
                    <th className="px-5 py-3 font-medium">{kind === 'voice' ? 'アシスタント' : kind === 'ai' ? 'AI' : 'プラットフォーム'}</th>
                    <th className="px-5 py-3 font-medium">連携ステータス</th>
                    {kind !== 'voice' && <th className="px-5 py-3 font-medium">インデックス</th>}
                    <th className="px-5 py-3 font-medium">リンク / 操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id} className="border-b border-gray-800/50 last:border-0 hover:bg-gray-800/20 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center text-xs font-bold text-violet-300">
                            {c.name.slice(0, 1)}
                          </div>
                          <div>
                            <p className="text-white font-medium">{c.name}</p>
                            {c.domain && <p className="text-xs text-gray-500">{c.domain}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <CitationStatusBadge status={c.status} />
                      </td>
                      {kind !== 'voice' && (
                        <td className="px-5 py-3.5">
                          <span className={c.indexed ? 'text-sky-400 font-medium' : 'text-gray-600'}>
                            {c.indexed ? 'Yes' : 'No'}
                          </span>
                        </td>
                      )}
                      <td className="px-5 py-3.5">
                        {c.status === '未連携' ? (
                          <button
                            onClick={() => handleRegister(c)}
                            disabled={pendingId === c.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-medium transition-colors"
                          >
                            {pendingId === c.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Send className="w-3.5 h-3.5" />
                            )}
                            連携申請
                          </button>
                        ) : c.listing_url ? (
                          <a
                            href={c.listing_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sky-400 hover:text-sky-300 text-xs font-medium"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            アクティブ
                          </a>
                        ) : (
                          <span className="text-xs text-gray-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}
    </div>
  )
}
