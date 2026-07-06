'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  X,
  Sparkles,
  Loader2,
  Save,
  CheckCircle2,
  Search,
} from 'lucide-react'
import clsx from 'clsx'
import type { MeoLocation, MeoReview } from '@/types/meo'
import type { ReplyTone } from '@/lib/meo/prompts'
import { ReplyStatusBadge, Stars, DemoBanner } from './shared'
import { saveReviewReply } from '@/app/dashboard/meo/actions'

interface Props {
  location: MeoLocation
  reviews: MeoReview[]
  isDemo: boolean
}

type Tab = 'all' | 'unreplied'
const TONES: ReplyTone[] = ['丁寧', 'フレンドリー', '簡潔']

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

export default function ReviewsPage({ location, reviews: initialReviews, isDemo }: Props) {
  const [reviews, setReviews] = useState(initialReviews)
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<MeoReview | null>(null)
  const [tone, setTone] = useState<ReplyTone>('丁寧')
  const [draft, setDraft] = useState('')
  const [generating, setGenerating] = useState(false)
  const [saving, startSaving] = useTransition()
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const unrepliedCount = reviews.filter((r) => r.reply_status === '未返信').length

  const visible = useMemo(() => {
    let list = reviews
    if (tab === 'unreplied') list = list.filter((r) => r.reply_status === '未返信')
    const q = search.trim()
    if (q) {
      list = list.filter(
        (r) => (r.body ?? '').includes(q) || (r.author ?? '').includes(q)
      )
    }
    return list
  }, [reviews, tab, search])

  const openReview = (r: MeoReview) => {
    setSelected(r)
    setDraft(r.reply_body ?? '')
    setError('')
    setNotice('')
  }

  const handleGenerate = async () => {
    if (!selected) return
    setError('')
    setGenerating(true)
    try {
      const res = await fetch('/api/meo/generate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: {
            name: location.name,
            category: location.category,
            address: location.address,
          },
          review: {
            author: selected.author,
            rating: selected.rating,
            body: selected.body,
          },
          tone,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`)
      setDraft(json.reply)
      if (json.isDemo) setNotice('APIキー未設定のためサンプル返信を表示しています')
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成に失敗しました')
    } finally {
      setGenerating(false)
    }
  }

  const handleSave = (status: '下書き' | '返信済み') => {
    if (!selected || !draft.trim()) return
    setError('')
    setNotice('')
    startSaving(async () => {
      const { error } = await saveReviewReply(selected.id, draft.trim(), status)
      if (error) {
        setError(error)
        return
      }
      setReviews((prev) =>
        prev.map((r) =>
          r.id === selected.id
            ? { ...r, reply_body: draft.trim(), reply_status: status }
            : r
        )
      )
      setNotice(status === '返信済み' ? '返信済みとして保存しました' : '下書きを保存しました')
      setSelected(null)
    })
  }

  return (
    <div className="space-y-6">
      <DemoBanner isDemo={isDemo} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">口コミ管理</h1>
          <p className="text-sm text-gray-500 mt-1">
            {location.name} の口コミ一覧とAI返信生成
          </p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="検索"
            className="bg-gray-900 border border-gray-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 w-full sm:w-64"
          />
        </div>
      </div>

      {/* タブ */}
      <div className="flex items-center gap-2 border-b border-gray-800">
        {(
          [
            { key: 'all', label: `一覧 (${reviews.length})` },
            { key: 'unreplied', label: `未返信 (${unrepliedCount})`, alert: unrepliedCount > 0 },
          ] as { key: Tab; label: string; alert?: boolean }[]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors inline-flex items-center gap-2',
              tab === t.key
                ? 'border-violet-500 text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            )}
          >
            {t.label}
            {t.alert && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
          </button>
        ))}
      </div>

      {notice && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 text-sm text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {notice}
        </div>
      )}
      {error && !selected && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* テーブル */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-800/70 bg-gray-950/50">
                <th className="px-5 py-3 font-medium whitespace-nowrap">投稿日時</th>
                <th className="px-5 py-3 font-medium whitespace-nowrap">評価</th>
                <th className="px-5 py-3 font-medium min-w-[260px]">口コミ</th>
                <th className="px-5 py-3 font-medium min-w-[200px]">返信</th>
                <th className="px-5 py-3 font-medium whitespace-nowrap">ステータス</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-gray-600">
                    該当する口コミがありません
                  </td>
                </tr>
              )}
              {visible.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => openReview(r)}
                  className="border-b border-gray-800/50 last:border-0 hover:bg-gray-800/30 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-4 text-gray-400 whitespace-nowrap">
                    {formatDate(r.review_date)}
                  </td>
                  <td className="px-5 py-4">
                    <Stars rating={r.rating} />
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-gray-300 line-clamp-2 max-w-md">
                      <span className="text-gray-500">{r.author}</span>
                      {r.author && ' — '}
                      {r.body}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-gray-500 line-clamp-2 max-w-xs">
                      {r.reply_body ?? '—'}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <ReplyStatusBadge status={r.reply_status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 返信モーダル */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between sticky top-0 bg-gray-900">
              <h3 className="text-sm font-bold text-white">口コミへの返信</h3>
              <button
                onClick={() => setSelected(null)}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* 口コミ本体 */}
              <div className="bg-gray-950 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-white">{selected.author}</p>
                  <span className="text-xs text-gray-500">{formatDate(selected.review_date)}</span>
                </div>
                <Stars rating={selected.rating} />
                <p className="text-sm text-gray-300 mt-3 whitespace-pre-wrap">{selected.body}</p>
              </div>

              {/* トーン選択 + AI生成 */}
              <div className="flex flex-wrap items-center gap-2">
                {TONES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTone(t)}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                      tone === t
                        ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
                        : 'bg-gray-950 border-gray-800 text-gray-500 hover:text-gray-300'
                    )}
                  >
                    {t}
                  </button>
                ))}
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                >
                  {generating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  AI返信を生成
                </button>
              </div>

              {/* 返信ドラフト */}
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={7}
                placeholder="返信文（AI生成または手入力）"
                className="w-full bg-gray-950 border border-gray-800 rounded-xl p-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 resize-y"
              />

              {notice && <p className="text-xs text-amber-300">{notice}</p>}
              {error && <p className="text-xs text-red-400">{error}</p>}

              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => handleSave('下書き')}
                  disabled={saving || !draft.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-200 text-sm font-medium transition-colors"
                >
                  <Save className="w-4 h-4" />
                  下書き保存
                </button>
                <button
                  onClick={() => handleSave('返信済み')}
                  disabled={saving || !draft.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  返信済みにする
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
