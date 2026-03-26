'use client'

import { useState, useMemo } from 'react'
import { X, Search, Building2, Loader2, Sparkles } from 'lucide-react'
import type { Lead, LeadOption } from '@/types/leads'
import type { Sentiment } from '@/types/replies'
import { SENTIMENT_CONFIG } from '@/types/replies'
import { createReply } from '@/app/dashboard/replies/actions'
import type { Reply } from '@/types/replies'
import clsx from 'clsx'

interface AddReplyModalProps {
  leads: LeadOption[]
  sentLeadIds?: string[]
  onClose: () => void
  onAdded: (reply: Reply) => void
}

export default function AddReplyModal({ leads, sentLeadIds = [], onClose, onAdded }: AddReplyModalProps) {
  const [leadSearch, setLeadSearch] = useState('')
  const [selectedLead, setSelectedLead] = useState<LeadOption | null>(null)
  const [content, setContent] = useState('')
  const [isClassifying, setIsClassifying] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [classifyResult, setClassifyResult] = useState<{
    sentiment: Sentiment
    ai_response: string
  } | null>(null)
  const [error, setError] = useState('')

  // 送信済みリードを優先表示
  const sentLeads = useMemo(
    () => leads.filter(l => sentLeadIds.includes(l.id)),
    [leads, sentLeadIds]
  )

  const filteredLeads = useMemo(
    () =>
      leads.filter(
        l =>
          l.company_name.toLowerCase().includes(leadSearch.toLowerCase()) ||
          (l.contact_name ?? '').toLowerCase().includes(leadSearch.toLowerCase())
      ),
    [leads, leadSearch]
  )

  const handleClassify = async () => {
    if (!content.trim()) {
      setError('返信内容を入力してください')
      return
    }
    setIsClassifying(true)
    setError('')
    try {
      const res = await fetch('/api/classify-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          company_name: selectedLead?.company_name,
          contact_name: selectedLead?.contact_name,
        }),
      })
      const data = (await res.json()) as {
        sentiment?: Sentiment
        ai_response?: string
        error?: string
      }
      if (data.error) {
        setError(data.error)
        return
      }
      if (data.sentiment && data.ai_response) {
        setClassifyResult({ sentiment: data.sentiment, ai_response: data.ai_response })
      }
    } catch {
      setError('AI分類に失敗しました')
    } finally {
      setIsClassifying(false)
    }
  }

  const handleSubmit = async () => {
    if (!content.trim()) {
      setError('返信内容を入力してください')
      return
    }
    setIsSubmitting(true)
    setError('')

    // If not yet classified, classify first
    let sentiment: Sentiment = 'その他'
    let ai_response: string | null = null

    if (classifyResult) {
      sentiment = classifyResult.sentiment
      ai_response = classifyResult.ai_response
    } else {
      try {
        const res = await fetch('/api/classify-reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: content.trim(),
            company_name: selectedLead?.company_name,
            contact_name: selectedLead?.contact_name,
          }),
        })
        const data = (await res.json()) as {
          sentiment?: Sentiment
          ai_response?: string
          error?: string
        }
        if (data.sentiment) sentiment = data.sentiment
        if (data.ai_response) ai_response = data.ai_response
      } catch {
        // fallback to その他
      }
    }

    const { data, error: err } = await createReply({
      lead_id: selectedLead?.id ?? null,
      content: content.trim(),
      sentiment,
      ai_response,
    })

    setIsSubmitting(false)
    if (err || !data) {
      setError(err ?? '追加に失敗しました')
      return
    }
    onAdded(data)
  }

  const cfg = classifyResult ? SENTIMENT_CONFIG[classifyResult.sentiment] : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 flex-shrink-0">
          <h2 className="text-sm font-semibold text-white">返信を追加</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
              {error}
            </div>
          )}

          {/* Lead selector */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
              返信元の企業
            </label>

            {/* 送信済みリードのクイック選択 */}
            {!selectedLead && sentLeads.length > 0 && !leadSearch && (
              <div className="mb-2">
                <p className="text-[10px] text-gray-600 mb-1.5">📨 送信済み企業（クリックで選択）</p>
                <div className="flex flex-wrap gap-1.5">
                  {sentLeads.slice(0, 10).map(lead => (
                    <button
                      key={lead.id}
                      onClick={() => setSelectedLead(lead)}
                      className="px-2.5 py-1.5 text-xs bg-violet-500/10 border border-violet-500/20 hover:border-violet-500/40 rounded-lg text-violet-300 hover:text-violet-200 transition-all"
                    >
                      {lead.company_name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                type="text"
                value={leadSearch}
                onChange={e => setLeadSearch(e.target.value)}
                placeholder="会社名・担当者名で検索..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>

            {selectedLead ? (
              <div className="flex items-center justify-between px-3 py-2 bg-violet-500/10 border border-violet-500/20 rounded-xl">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-violet-400" />
                  <div>
                    <p className="text-sm font-semibold text-white">{selectedLead.company_name}</p>
                    {selectedLead.contact_name && (
                      <p className="text-xs text-gray-500">{selectedLead.contact_name}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedLead(null)}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  解除
                </button>
              </div>
            ) : (
              leadSearch && (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {filteredLeads.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-3">
                      一致するリードが見つかりません
                    </p>
                  ) : (
                    filteredLeads.slice(0, 5).map(lead => (
                      <button
                        key={lead.id}
                        onClick={() => {
                          setSelectedLead(lead)
                          setLeadSearch('')
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 bg-gray-800/60 border border-gray-700/50 hover:border-violet-500/40 rounded-xl text-left transition-all"
                      >
                        <div className="w-7 h-7 bg-gray-700 rounded-lg flex items-center justify-center text-xs font-bold text-gray-300 border border-gray-600 flex-shrink-0">
                          {lead.company_name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{lead.company_name}</p>
                          {lead.contact_name && (
                            <p className="text-xs text-gray-500 truncate">{lead.contact_name}</p>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )
            )}
          </div>

          {/* Reply content */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
              返信内容 <span className="text-red-400">*</span>
            </label>
            <textarea
              value={content}
              onChange={e => {
                setContent(e.target.value)
                setClassifyResult(null)
              }}
              rows={6}
              placeholder="受信した返信メッセージを貼り付けてください..."
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent leading-relaxed"
            />
          </div>

          {/* Classify button */}
          <button
            onClick={handleClassify}
            disabled={isClassifying || !content.trim()}
            className="w-full flex items-center justify-center gap-2 py-2 bg-gray-800 hover:bg-gray-750 disabled:opacity-40 disabled:cursor-not-allowed border border-gray-700 text-gray-300 text-sm font-medium rounded-xl transition-colors"
          >
            {isClassifying ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 text-violet-400" />
            )}
            {isClassifying ? 'AI分類中...' : 'AIで感情分析・返信文案を生成'}
          </button>

          {/* Classification result */}
          {classifyResult && cfg && (
            <div className="space-y-2">
              <div className={clsx('flex items-center gap-2 px-3 py-2 rounded-xl border text-sm', cfg.bg, cfg.border, cfg.color)}>
                <span className="text-base">{cfg.emoji}</span>
                <div>
                  <span className="font-semibold">{cfg.label}</span>
                  <span className="text-xs ml-2 opacity-70">{cfg.description}</span>
                </div>
                <span className="ml-auto text-xs opacity-60">返信文案も生成済み</span>
              </div>
              {classifyResult.sentiment === '興味あり' && (
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <span className="text-xs text-emerald-400">🎯 前向きな返信です！追加後に商談管理へ移行できます</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-800 flex-shrink-0">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !content.trim()}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : null}
            {isSubmitting ? '追加中...' : '返信を追加'}
          </button>
        </div>
      </div>
    </div>
  )
}
