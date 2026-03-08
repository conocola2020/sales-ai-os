'use client'

import { useState, useMemo } from 'react'
import { X, Search, Plus, Loader2, FileText, Building2 } from 'lucide-react'
import type { Lead } from '@/types/leads'
import type { Message } from '@/types/messages'
import type { SendQueueItem } from '@/types/sending'
import { addToQueue } from '@/app/dashboard/sending/actions'
import clsx from 'clsx'

interface AddToQueueModalProps {
  leads: Lead[]
  messages: Message[]
  onClose: () => void
  onAdded: (item: SendQueueItem) => void
}

export default function AddToQueueModal({
  leads,
  messages,
  onClose,
  onAdded,
}: AddToQueueModalProps) {
  const [step, setStep] = useState<'lead' | 'message'>('lead')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  const [customMessage, setCustomMessage] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [leadSearch, setLeadSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Filter leads by search query
  const filteredLeads = useMemo(
    () =>
      leads.filter(
        l =>
          l.company_name.toLowerCase().includes(leadSearch.toLowerCase()) ||
          (l.contact_name ?? '').toLowerCase().includes(leadSearch.toLowerCase())
      ),
    [leads, leadSearch]
  )

  // Messages for the selected lead (or all if none selected)
  const relevantMessages = useMemo(
    () =>
      selectedLead
        ? messages.filter(m => m.lead_id === selectedLead.id)
        : messages,
    [messages, selectedLead]
  )

  const handleSelectLead = (lead: Lead) => {
    setSelectedLead(lead)
    setSelectedMessage(null)
    setStep('message')
  }

  const handleBack = () => {
    setStep('lead')
    setSelectedMessage(null)
    setUseCustom(false)
    setCustomMessage('')
  }

  const handleSubmit = async () => {
    if (!selectedLead) return
    const content = useCustom ? customMessage.trim() : selectedMessage?.content ?? ''
    if (!content) {
      setError('送信文面を選択または入力してください')
      return
    }
    setLoading(true)
    setError('')

    const { data, error: err } = await addToQueue({
      lead_id: selectedLead.id,
      message_content: content,
    })

    setLoading(false)
    if (err || !data) {
      setError(err ?? '追加に失敗しました')
      return
    }
    onAdded(data)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            {step === 'message' && (
              <button
                onClick={handleBack}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                ← 戻る
              </button>
            )}
            <h2 className="text-sm font-semibold text-white">
              {step === 'lead' ? 'リードを選択' : '文面を選択'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex border-b border-gray-800">
          <div
            className={clsx(
              'flex-1 py-2 text-center text-xs font-medium border-b-2 transition-colors',
              step === 'lead'
                ? 'text-violet-400 border-violet-500'
                : 'text-gray-500 border-transparent'
            )}
          >
            1. リード選択
          </div>
          <div
            className={clsx(
              'flex-1 py-2 text-center text-xs font-medium border-b-2 transition-colors',
              step === 'message'
                ? 'text-violet-400 border-violet-500'
                : 'text-gray-500 border-transparent'
            )}
          >
            2. 文面選択
          </div>
        </div>

        {/* Content */}
        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-3">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
              {error}
            </div>
          )}

          {/* Step 1: Select lead */}
          {step === 'lead' && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                <input
                  type="text"
                  value={leadSearch}
                  onChange={e => setLeadSearch(e.target.value)}
                  placeholder="会社名・担当者名で検索..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {filteredLeads.length === 0 ? (
                  <p className="text-center text-sm text-gray-500 py-6">
                    {leadSearch ? '一致するリードが見つかりません' : 'リードが登録されていません'}
                  </p>
                ) : (
                  filteredLeads.map(lead => (
                    <button
                      key={lead.id}
                      onClick={() => handleSelectLead(lead)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 bg-gray-800/60 border border-gray-700/50 hover:border-violet-500/40 hover:bg-gray-800 rounded-xl text-left transition-all"
                    >
                      <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-semibold text-gray-300 border border-gray-600">
                        {lead.company_name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {lead.company_name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {lead.contact_name ?? lead.industry ?? '担当者未登録'}
                        </p>
                      </div>
                      <span className="text-xs text-gray-600">選択</span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}

          {/* Step 2: Select message */}
          {step === 'message' && selectedLead && (
            <>
              {/* Selected lead summary */}
              <div className="flex items-center gap-3 px-3 py-2 bg-violet-500/10 border border-violet-500/20 rounded-xl">
                <Building2 className="w-4 h-4 text-violet-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-white">{selectedLead.company_name}</p>
                  {selectedLead.contact_name && (
                    <p className="text-xs text-gray-500">{selectedLead.contact_name}</p>
                  )}
                </div>
              </div>

              {/* Toggle: saved vs custom */}
              <div className="flex gap-2">
                <button
                  onClick={() => setUseCustom(false)}
                  className={clsx(
                    'flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    !useCustom
                      ? 'bg-violet-600 text-white'
                      : 'bg-gray-800 text-gray-500 hover:text-gray-300'
                  )}
                >
                  保存済み文面
                </button>
                <button
                  onClick={() => setUseCustom(true)}
                  className={clsx(
                    'flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    useCustom
                      ? 'bg-violet-600 text-white'
                      : 'bg-gray-800 text-gray-500 hover:text-gray-300'
                  )}
                >
                  直接入力
                </button>
              </div>

              {!useCustom ? (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {relevantMessages.length === 0 ? (
                    <div className="text-center py-6">
                      <FileText className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">保存済み文面がありません</p>
                      <button
                        onClick={() => setUseCustom(true)}
                        className="text-xs text-violet-400 hover:text-violet-300 mt-1 transition-colors"
                      >
                        直接入力に切り替え
                      </button>
                    </div>
                  ) : (
                    relevantMessages.map(msg => (
                      <button
                        key={msg.id}
                        onClick={() => setSelectedMessage(msg)}
                        className={clsx(
                          'w-full text-left px-3 py-2.5 rounded-xl border transition-all',
                          selectedMessage?.id === msg.id
                            ? 'bg-violet-600/20 border-violet-500/40 text-white'
                            : 'bg-gray-800/60 border-gray-700/50 hover:border-violet-500/30 hover:bg-gray-800'
                        )}
                      >
                        <p className="text-xs text-gray-300 line-clamp-2">
                          {msg.content.slice(0, 120)}...
                        </p>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[10px] text-gray-600">
                            {msg.lead?.company_name ?? 'リードなし'}
                          </span>
                          <span className="text-[10px] text-gray-600">
                            {msg.tone}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              ) : (
                <textarea
                  value={customMessage}
                  onChange={e => setCustomMessage(e.target.value)}
                  rows={6}
                  placeholder="送信したい文面を直接入力してください..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {step === 'message' && (
          <div className="px-5 py-4 border-t border-gray-800">
            <button
              onClick={handleSubmit}
              disabled={
                loading ||
                (!useCustom && !selectedMessage) ||
                (useCustom && !customMessage.trim())
              }
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {loading ? '追加中...' : 'キューに追加'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
