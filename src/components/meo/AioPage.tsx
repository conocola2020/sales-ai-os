'use client'

import { useState } from 'react'
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import clsx from 'clsx'
import type { MeoAioCheck, MeoLocation } from '@/types/meo'
import { StatCard, DemoBanner } from './shared'

interface Props {
  location: MeoLocation
  checks: MeoAioCheck[]
  isDemo: boolean
}

const ENGINES = [
  { key: 'claude', label: 'Claude', available: true },
  { key: 'chatgpt', label: 'ChatGPT', available: false },
  { key: 'gemini', label: 'Gemini', available: false },
  { key: 'perplexity', label: 'Perplexity', available: false },
] as const

const SUGGESTED_QUERIES = [
  '名古屋 スパイスカレー おすすめ',
  '名古屋 クラフトコーラ 飲める店',
  '愛知 カレー ランチ 人気',
  '名古屋 サウナ飯 おすすめ',
]

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function AioPage({ location, checks: initialChecks, isDemo }: Props) {
  const [checks, setChecks] = useState(initialChecks)
  const [query, setQuery] = useState('')
  const [engine, setEngine] = useState<string>('claude')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [lastAnswer, setLastAnswer] = useState<string | null>(null)
  const [showAnswer, setShowAnswer] = useState(false)

  const mentionedCount = checks.filter((c) => c.mentioned).length
  const visibilityRate =
    checks.length > 0 ? Math.round((mentionedCount / checks.length) * 100) : 0

  const handleRun = async (q?: string) => {
    const target = (q ?? query).trim()
    if (!target) {
      setError('チェックするクエリを入力してください')
      return
    }
    setError('')
    setRunning(true)
    setLastAnswer(null)
    try {
      const res = await fetch('/api/meo/aio-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: target,
          locationId: location.id,
          locationName: location.name,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`)

      const newCheck: MeoAioCheck = json.check ?? {
        id: `local-${Date.now()}`,
        user_id: 'local',
        location_id: location.id,
        engine: 'claude',
        query: target,
        mentioned: json.mentioned,
        rank: json.rank,
        snippet: json.snippet,
        answer: json.answer,
        checked_at: new Date().toISOString(),
      }
      setChecks((prev) => [newCheck, ...prev])
      setLastAnswer(json.answer)
      setQuery('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'チェックに失敗しました')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-6">
      <DemoBanner isDemo={isDemo} />

      <div>
        <h1 className="text-xl font-bold text-gray-900">AIO可視性チェック</h1>
        <p className="text-sm text-gray-500 mt-1">
          AI検索で「{location.name}」がおすすめとして言及されるかを計測します
        </p>
      </div>

      {/* 統計 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="AIO可視率（言及率）"
          value={`${visibilityRate}%`}
          sub={`${mentionedCount} / ${checks.length} クエリで言及`}
          accent="violet"
        />
        <StatCard label="実行済みチェック" value={String(checks.length)} accent="sky" />
        <StatCard
          label="ベスト掲載順位"
          value={
            checks.filter((c) => c.rank !== null).length > 0
              ? `${Math.min(...checks.filter((c) => c.rank !== null).map((c) => c.rank as number))}位`
              : '—'
          }
          accent="emerald"
        />
      </div>

      {/* 実行フォーム */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {ENGINES.map((e) => (
            <button
              key={e.key}
              onClick={() => e.available && setEngine(e.key)}
              disabled={!e.available}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                engine === e.key && e.available
                  ? 'bg-violet-500/20 border-violet-500/50 text-violet-600'
                  : e.available
                    ? 'bg-white border-gray-200 text-gray-400 hover:text-gray-800'
                    : 'bg-white border-gray-200/50 text-gray-700 cursor-not-allowed'
              )}
            >
              {e.label}
              {!e.available && <span className="ml-1.5 text-[10px]">近日対応</span>}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !running && handleRun()}
            placeholder="例: 名古屋 スパイスカレー おすすめ"
            className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-violet-500/50"
          />
          <button
            onClick={() => handleRun()}
            disabled={running}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            {running ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {running ? 'AIに問い合わせ中...' : 'チェック実行'}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {SUGGESTED_QUERIES.map((q) => (
            <button
              key={q}
              onClick={() => !running && handleRun(q)}
              className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs text-gray-400 hover:text-gray-900 hover:border-gray-200 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {lastAnswer && (
          <div className="bg-white border border-gray-200 rounded-xl">
            <button
              onClick={() => setShowAnswer((v) => !v)}
              className="w-full px-4 py-3 flex items-center justify-between text-sm text-gray-700"
            >
              <span>AIの回答全文を表示</span>
              {showAnswer ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showAnswer && (
              <p className="px-4 pb-4 text-sm text-gray-400 whitespace-pre-wrap">{lastAnswer}</p>
            )}
          </div>
        )}
      </div>

      {/* 履歴 */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-sm font-bold text-gray-900">チェック履歴</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-200/70 bg-white/50">
                <th className="px-5 py-3 font-medium whitespace-nowrap">日時</th>
                <th className="px-5 py-3 font-medium whitespace-nowrap">エンジン</th>
                <th className="px-5 py-3 font-medium min-w-[200px]">クエリ</th>
                <th className="px-5 py-3 font-medium whitespace-nowrap">言及</th>
                <th className="px-5 py-3 font-medium whitespace-nowrap">順位</th>
                <th className="px-5 py-3 font-medium min-w-[240px]">スニペット</th>
              </tr>
            </thead>
            <tbody>
              {checks.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-gray-400">
                    まだチェックがありません
                  </td>
                </tr>
              )}
              {checks.map((c) => (
                <tr key={c.id} className="border-b border-gray-200/50 last:border-0">
                  <td className="px-5 py-3.5 text-gray-400 whitespace-nowrap">
                    {formatDateTime(c.checked_at)}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="px-2 py-0.5 rounded bg-gray-50 text-xs text-gray-700 capitalize">
                      {c.engine}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-700">{c.query}</td>
                  <td className="px-5 py-3.5">
                    {c.mentioned ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-600 text-xs font-medium">
                        <CheckCircle2 className="w-4 h-4" /> あり
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-gray-400 text-xs">
                        <XCircle className="w-4 h-4" /> なし
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-gray-700">
                    {c.rank !== null ? `${c.rank}位` : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 text-xs">
                    <p className="line-clamp-2 max-w-sm">{c.snippet ?? '—'}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
