'use client'

import { useState } from 'react'
import { X, Sparkles, Copy, Check, Send, RefreshCw, AlertCircle } from 'lucide-react'
import { clsx } from 'clsx'
import type { InstagramTarget } from '@/types/instagram'
import { STATUS_CONFIG } from '@/types/instagram'
import { saveDmAndMarkSent, updateTarget } from '@/app/dashboard/instagram/actions'

interface DmModalProps {
  target: InstagramTarget
  onClose: () => void
  onUpdated: (target: InstagramTarget) => void
}

export default function DmModal({ target, onClose, onUpdated }: DmModalProps) {
  const [dmContent, setDmContent] = useState(target.dm_content ?? '')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [replyNote, setReplyNote] = useState('')
  const [savingReply, setSavingReply] = useState(false)

  const cfg = STATUS_CONFIG[target.status]

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/generate-dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: target.username,
          display_name: target.display_name,
          bio: target.bio,
          industry: target.industry,
          follower_count: target.follower_count,
          engagement_rate: target.engagement_rate,
        }),
      })
      const json = await res.json() as { dm?: string; error?: string }
      if (!res.ok || json.error) {
        setError(json.error ?? 'DM生成に失敗しました')
      } else {
        setDmContent(json.dm ?? '')
      }
    } catch {
      setError('ネットワークエラーが発生しました')
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = async () => {
    if (!dmContent.trim()) return
    await navigator.clipboard.writeText(dmContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleMarkSent = async () => {
    if (!dmContent.trim()) {
      setError('DM内容を入力してください')
      return
    }
    setError(null)
    setSaving(true)
    const { data, error: err } = await saveDmAndMarkSent(target.id, dmContent.trim())
    setSaving(false)
    if (err || !data) {
      setError(err ?? '保存に失敗しました')
      return
    }
    onUpdated(data)
  }

  const handleMarkReplied = async () => {
    setSavingReply(true)
    const { data, error: err } = await updateTarget(target.id, {
      dm_replied: true,
      status: '返信あり',
      notes: replyNote.trim()
        ? `${target.notes ? target.notes + '\n' : ''}【返信】${replyNote.trim()}`
        : target.notes,
    })
    setSavingReply(false)
    if (err || !data) {
      setError(err ?? '更新に失敗しました')
      return
    }
    onUpdated(data)
  }

  const charCount = dmContent.length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            {/* Mini avatar */}
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {target.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">@{target.username}</p>
              {target.display_name && (
                <p className="text-xs text-gray-400">{target.display_name}</p>
              )}
            </div>
            <span className={clsx('ml-2 px-2 py-0.5 rounded-full text-xs border', cfg.bg, cfg.color, cfg.border)}>
              {cfg.emoji} {cfg.label}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
              <button onClick={() => setError(null)} className="ml-auto text-red-400/60 hover:text-red-400">✕</button>
            </div>
          )}

          {/* Target info summary */}
          {(target.bio || target.industry || target.follower_count != null) && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-3 space-y-1.5">
              {target.bio && <p className="text-xs text-gray-400 line-clamp-2">{target.bio}</p>}
              <div className="flex flex-wrap gap-3">
                {target.industry && (
                  <span className="text-xs text-gray-500">📂 {target.industry}</span>
                )}
                {target.follower_count != null && (
                  <span className="text-xs text-gray-500">
                    👥 {target.follower_count.toLocaleString()}人
                  </span>
                )}
                {target.engagement_rate != null && (
                  <span className="text-xs text-gray-500">
                    📈 {target.engagement_rate}%
                  </span>
                )}
              </div>
            </div>
          )}

          {/* DM content */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-400">DM文面</label>
              <span className="text-xs text-gray-600">{charCount}文字</span>
            </div>
            <textarea
              rows={6}
              value={dmContent}
              onChange={e => setDmContent(e.target.value)}
              placeholder="DM内容を入力、またはAIで生成してください..."
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors resize-none"
            />
          </div>

          {/* Generate buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white rounded-xl text-sm font-medium disabled:opacity-60 transition-all"
            >
              {generating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {generating ? 'AI生成中...' : 'AIでDMを生成'}
            </button>

            {dmContent.trim() && (
              <button
                onClick={handleGenerate}
                disabled={generating}
                title="再生成"
                className="p-2.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-xl border border-gray-700 transition-all disabled:opacity-50"
              >
                <RefreshCw className={clsx('w-4 h-4', generating && 'animate-spin')} />
              </button>
            )}
          </div>

          {/* Copy button */}
          {dmContent.trim() && (
            <button
              onClick={handleCopy}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 text-gray-300 hover:text-white rounded-xl text-sm font-medium transition-all"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">コピーしました！</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  DMをコピー
                </>
              )}
            </button>
          )}

          {/* Reply management (show if dm_sent) */}
          {target.dm_sent && !target.dm_replied && (
            <div className="border border-amber-500/20 bg-amber-500/5 rounded-xl p-4">
              <p className="text-xs font-medium text-amber-400 mb-3">💌 返信を受け取りましたか？</p>
              <textarea
                rows={2}
                value={replyNote}
                onChange={e => setReplyNote(e.target.value)}
                placeholder="返信内容のメモ（任意）"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors resize-none mb-2"
              />
              <button
                onClick={handleMarkReplied}
                disabled={savingReply}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-400 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
              >
                {savingReply ? '更新中...' : '💌 返信ありに更新する'}
              </button>
            </div>
          )}

          {target.dm_replied && (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3 text-sm text-emerald-400">
              <Check className="w-4 h-4" />
              返信済み — このターゲットはフォローアップ中です
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 shrink-0 flex items-center gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
            閉じる
          </button>

          {!target.dm_sent && (
            <button
              onClick={handleMarkSent}
              disabled={saving || !dmContent.trim()}
              className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50 transition-colors"
            >
              <Send className="w-4 h-4" />
              {saving ? '保存中...' : 'DM送信済みにする'}
            </button>
          )}

          {target.dm_sent && dmContent !== target.dm_content && (
            <button
              onClick={async () => {
                setSaving(true)
                const { data } = await updateTarget(target.id, { dm_content: dmContent })
                setSaving(false)
                if (data) onUpdated(data)
              }}
              disabled={saving}
              className="ml-auto px-4 py-2 rounded-xl text-sm font-medium bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-50 transition-colors"
            >
              {saving ? '保存中...' : '内容を更新する'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
