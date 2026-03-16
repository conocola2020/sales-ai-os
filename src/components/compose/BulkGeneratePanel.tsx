'use client'

import { useState, useCallback } from 'react'
import {
  Sparkles, Loader2, Check, X, Globe, Mail, Send,
  ChevronDown, ChevronUp, RefreshCw, Save, CheckSquare, Square,
} from 'lucide-react'
import ToneSelector from './ToneSelector'
import TemplateSelector from './TemplateSelector'
import { saveMessage } from '@/app/dashboard/compose/actions'
import { addToQueue } from '@/app/dashboard/sending/actions'
import type { Lead } from '@/types/leads'
import type { Tone } from '@/types/messages'
import type { MessageTemplate } from '@/types/settings'
import clsx from 'clsx'

interface BulkResult {
  leadId: string
  companyName: string
  subject: string
  body: string
  error?: string
  saved?: boolean
  queued?: boolean
}

interface BulkGeneratePanelProps {
  leads: Lead[]
  templates: MessageTemplate[]
  tone: Tone
  onToneChange: (tone: Tone) => void
  selectedTemplateId: string
  onTemplateChange: (id: string) => void
}

export default function BulkGeneratePanel({
  leads,
  templates,
  tone,
  onToneChange,
  selectedTemplateId,
  onTemplateChange,
}: BulkGeneratePanelProps) {
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set())
  const [customInstructions, setCustomInstructions] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState({ total: 0, completed: 0 })
  const [results, setResults] = useState<BulkResult[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSavingAll, setIsSavingAll] = useState(false)
  const [isQueuingAll, setIsQueuingAll] = useState(false)

  // Filtered leads
  const filteredLeads = leads.filter(l => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      l.company_name?.toLowerCase().includes(q) ||
      l.industry?.toLowerCase().includes(q) ||
      l.contact_name?.toLowerCase().includes(q)
    )
  })

  const toggleLead = (id: string) => {
    setSelectedLeadIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    setSelectedLeadIds(new Set(filteredLeads.map(l => l.id)))
  }

  const selectNone = () => {
    setSelectedLeadIds(new Set())
  }

  const selectWithHp = () => {
    setSelectedLeadIds(new Set(
      filteredLeads.filter(l => l.company_url || l.website_url).map(l => l.id)
    ))
  }

  const handleBulkGenerate = useCallback(async () => {
    if (selectedLeadIds.size === 0) return
    setIsGenerating(true)
    setResults([])
    setProgress({ total: selectedLeadIds.size, completed: 0 })

    try {
      const res = await fetch('/api/generate-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadIds: Array.from(selectedLeadIds),
          tone,
          customInstructions,
          templateId: selectedTemplateId || undefined,
        }),
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('ストリーム取得に失敗')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // Parse NDJSON lines
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const data = JSON.parse(line)
            if (data.type === 'result') {
              setResults(prev => [...prev, {
                leadId: data.leadId,
                companyName: data.companyName,
                subject: data.subject,
                body: data.body,
                error: data.error,
              }])
              setProgress(data.progress)
            } else if (data.type === 'progress') {
              setProgress(data)
            }
          } catch {
            // Skip malformed lines
          }
        }
      }
    } catch (err) {
      console.error('Bulk generate error:', err)
    } finally {
      setIsGenerating(false)
    }
  }, [selectedLeadIds, tone, customInstructions, selectedTemplateId])

  const handleSaveAll = async () => {
    setIsSavingAll(true)
    const unsaved = results.filter(r => !r.saved && !r.error && r.body)
    for (const result of unsaved) {
      const { error } = await saveMessage({
        lead_id: result.leadId,
        subject: result.subject || null,
        content: result.body,
        tone,
      })
      if (!error) {
        setResults(prev => prev.map(r =>
          r.leadId === result.leadId ? { ...r, saved: true } : r
        ))
      }
    }
    setIsSavingAll(false)
  }

  const handleQueueAll = async () => {
    setIsQueuingAll(true)
    const unqueued = results.filter(r => !r.queued && !r.error && r.body)
    for (const result of unqueued) {
      const { error } = await addToQueue({
        lead_id: result.leadId,
        message_content: result.body,
        subject: result.subject || undefined,
      })
      if (!error) {
        setResults(prev => prev.map(r =>
          r.leadId === result.leadId ? { ...r, queued: true } : r
        ))
      }
    }
    setIsQueuingAll(false)
  }

  const successCount = results.filter(r => !r.error && r.body).length
  const errorCount = results.filter(r => r.error).length

  return (
    <div className="flex-1 min-h-0 flex overflow-hidden">
      {/* Left: Selection & Controls */}
      <div className="w-[360px] flex-shrink-0 border-r border-gray-800 flex flex-col overflow-hidden">
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Search */}
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="リードを検索..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />

          {/* Quick select buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={selectAll} className="px-2.5 py-1 text-xs font-medium bg-gray-800 border border-gray-700 rounded-lg text-gray-300 hover:text-white transition-colors">
              全選択
            </button>
            <button onClick={selectNone} className="px-2.5 py-1 text-xs font-medium bg-gray-800 border border-gray-700 rounded-lg text-gray-300 hover:text-white transition-colors">
              全解除
            </button>
            <button onClick={selectWithHp} className="px-2.5 py-1 text-xs font-medium bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-cyan-400 hover:bg-cyan-500/20 transition-colors">
              <Globe className="w-3 h-3 inline mr-1" />
              HP有り
            </button>
            <span className="text-xs text-gray-500 ml-auto">{selectedLeadIds.size}件選択</span>
          </div>

          {/* Lead list */}
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {filteredLeads.map(lead => (
              <button
                key={lead.id}
                onClick={() => toggleLead(lead.id)}
                className={clsx(
                  'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all text-xs',
                  selectedLeadIds.has(lead.id)
                    ? 'bg-violet-500/10 border border-violet-500/30'
                    : 'bg-gray-800/50 border border-transparent hover:border-gray-700'
                )}
              >
                {selectedLeadIds.has(lead.id) ? (
                  <CheckSquare className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                ) : (
                  <Square className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-white truncate block">{lead.company_name}</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {lead.industry && <span className="text-gray-500">{lead.industry}</span>}
                    {(lead.company_url || lead.website_url) && (
                      <Globe className="w-2.5 h-2.5 text-cyan-500" />
                    )}
                    {lead.email && <Mail className="w-2.5 h-2.5 text-blue-500" />}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Controls */}
          <TemplateSelector templates={templates} selectedId={selectedTemplateId} onChange={onTemplateChange} />
          <ToneSelector value={tone} onChange={onToneChange} />

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">追加指示 (任意)</label>
            <textarea
              value={customInstructions}
              onChange={e => setCustomInstructions(e.target.value)}
              rows={2}
              placeholder="全リードに共通の追加指示..."
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          {/* Generate button */}
          <button
            onClick={handleBulkGenerate}
            disabled={isGenerating || selectedLeadIds.size === 0}
            className={clsx(
              'flex items-center justify-center gap-2.5 w-full py-3 rounded-xl text-sm font-semibold transition-all',
              selectedLeadIds.size > 0 && !isGenerating
                ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-900/30'
                : 'bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed'
            )}
          >
            {isGenerating ? (
              <><Loader2 className="w-4 h-4 animate-spin" />生成中... ({progress.completed}/{progress.total})</>
            ) : (
              <><Sparkles className="w-4 h-4" />{selectedLeadIds.size}件の文面を一括生成</>
            )}
          </button>
        </div>
      </div>

      {/* Right: Results */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Progress bar */}
        {(isGenerating || results.length > 0) && (
          <div className="px-5 pt-4 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">
                {isGenerating ? `生成中... ${progress.completed}/${progress.total}` : `生成完了: ${successCount}件成功 / ${errorCount}件エラー`}
              </span>
              {results.length > 0 && !isGenerating && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveAll}
                    disabled={isSavingAll || successCount === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white transition-colors"
                  >
                    {isSavingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    全て保存
                  </button>
                  <button
                    onClick={handleQueueAll}
                    disabled={isQueuingAll || successCount === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white transition-colors"
                  >
                    {isQueuingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    全てキューに追加
                  </button>
                </div>
              )}
            </div>
            <div className="w-full bg-gray-800 rounded-full h-1.5">
              <div
                className="bg-violet-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: progress.total > 0 ? `${(progress.completed / progress.total) * 100}%` : '0%' }}
              />
            </div>
          </div>
        )}

        {/* Results list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {results.length === 0 && !isGenerating && (
            <div className="flex items-center justify-center h-full text-gray-600 text-sm">
              左側でリードを選択し、「一括生成」をクリックしてください
            </div>
          )}
          {results.map(result => (
            <div
              key={result.leadId}
              className={clsx(
                'rounded-xl border p-4 transition-all',
                result.error
                  ? 'bg-red-500/5 border-red-500/20'
                  : result.queued
                  ? 'bg-emerald-500/5 border-emerald-500/20'
                  : result.saved
                  ? 'bg-violet-500/5 border-violet-500/20'
                  : 'bg-gray-900 border-gray-800'
              )}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center text-xs font-semibold text-gray-300 border border-gray-700">
                  {result.companyName?.charAt(0) ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-white">{result.companyName}</span>
                  {result.subject && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">件名: {result.subject}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {result.error ? (
                    <span className="flex items-center gap-1 text-xs text-red-400"><X className="w-3 h-3" />エラー</span>
                  ) : result.queued ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-400"><Check className="w-3 h-3" />キュー済み</span>
                  ) : result.saved ? (
                    <span className="flex items-center gap-1 text-xs text-violet-400"><Check className="w-3 h-3" />保存済み</span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-gray-400"><Check className="w-3 h-3" />生成完了</span>
                  )}
                  <button
                    onClick={() => setExpandedId(expandedId === result.leadId ? null : result.leadId)}
                    className="p-1 text-gray-600 hover:text-gray-400 transition-colors"
                  >
                    {expandedId === result.leadId ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Expanded content */}
              {expandedId === result.leadId && (
                <div className="mt-3 pt-3 border-t border-gray-800 space-y-2">
                  {result.error ? (
                    <p className="text-xs text-red-400">{result.error}</p>
                  ) : (
                    <>
                      {result.subject && (
                        <div className="bg-gray-800/60 rounded-lg px-3 py-2">
                          <p className="text-xs text-gray-500 mb-0.5">件名</p>
                          <p className="text-sm text-white font-medium">{result.subject}</p>
                        </div>
                      )}
                      <div className="bg-gray-800/60 rounded-lg px-3 py-2">
                        <p className="text-xs text-gray-500 mb-0.5">本文 ({result.body.length}字)</p>
                        <pre className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed font-sans max-h-[200px] overflow-y-auto">
                          {result.body}
                        </pre>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Generating placeholder */}
          {isGenerating && progress.completed < progress.total && (
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-800 rounded-lg" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-800 rounded w-1/3 mb-1.5" />
                  <div className="h-3 bg-gray-800 rounded w-1/2" />
                </div>
                <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
