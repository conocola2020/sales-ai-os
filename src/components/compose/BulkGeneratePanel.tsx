'use client'

import { useState, useCallback, useMemo, memo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Sparkles, Loader2, Check, X, Globe, Mail, Send,
  ChevronDown, ChevronUp, RefreshCw, Save, CheckSquare, Square, Zap,
} from 'lucide-react'
import ToneSelector from './ToneSelector'
import TemplateSelector from './TemplateSelector'
import { saveMessage } from '@/app/dashboard/compose/actions'
import { addToQueue } from '@/app/dashboard/sending/actions'
import type { Lead, LeadOption } from '@/types/leads'
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

// Memoized lead row — only re-renders when its own isSelected changes
// チェックアイコン（軽量インラインSVG）
const CheckIcon = () => (
  <svg className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" /><path d="m9 12 2 2 4-4" />
  </svg>
)
const UncheckIcon = () => (
  <svg className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" />
  </svg>
)

const LeadRow = memo(function LeadRow({
  lead,
  isSelected,
  onToggle,
}: {
  lead: LeadOption
  isSelected: boolean
  onToggle: (id: string) => void
}) {
  return (
    <div
      role="button"
      onClick={() => onToggle(lead.id)}
      className={isSelected
        ? 'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs bg-violet-500/10 border border-violet-500/30 cursor-pointer'
        : 'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs bg-gray-800/50 border border-transparent cursor-pointer'
      }
    >
      {isSelected ? <CheckIcon /> : <UncheckIcon />}
      <div className="flex-1 min-w-0">
        <span className="text-white truncate block">{lead.company_name}</span>
        {lead.industry && <span className="text-gray-500 text-[10px]">{lead.industry}</span>}
      </div>
    </div>
  )
})

const VISIBLE_BATCH = 50 // 1回に表示する件数

interface BulkGeneratePanelProps {
  leads: LeadOption[]
  templates: MessageTemplate[]
  tone: Tone
  onToneChange: (tone: Tone) => void
  selectedTemplateId: string
  onTemplateChange: (id: string) => void
  initialSelectedIds?: string[]
}

export default function BulkGeneratePanel({
  leads,
  templates,
  tone,
  onToneChange,
  selectedTemplateId,
  onTemplateChange,
  initialSelectedIds,
}: BulkGeneratePanelProps) {
  const router = useRouter()
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(
    new Set(initialSelectedIds ?? [])
  )
  const [customInstructions, setCustomInstructions] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState({ total: 0, completed: 0 })
  const [results, setResults] = useState<BulkResult[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [prefectureFilter, setPrefectureFilter] = useState('all')
  const [visibleCount, setVisibleCount] = useState(VISIBLE_BATCH)
  const [isSavingAll, setIsSavingAll] = useState(false)
  const [isQueuingAll, setIsQueuingAll] = useState(false)
  const [autoQueue, setAutoQueue] = useState(false)
  const [batchInfo, setBatchInfo] = useState<{ current: number; total: number } | null>(null)

  // Filtered leads（検索クエリ + 都道府県フィルター）
  const filteredLeads = useMemo(() => {
    let rows = leads
    if (prefectureFilter !== 'all') {
      rows = rows.filter(l => (l.prefecture ?? l.notes) === prefectureFilter)
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      rows = rows.filter(l =>
        l.company_name?.toLowerCase().includes(q) ||
        l.industry?.toLowerCase().includes(q) ||
        l.contact_name?.toLowerCase().includes(q)
      )
    }
    return rows
  }, [leads, searchQuery, prefectureFilter])

  const toggleLead = useCallback((id: string) => {
    setSelectedLeadIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

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

    const BATCH_SIZE = 80 // 1バッチあたり80件（Vercel 300秒以内に収まる）
    const allLeadIds = Array.from(selectedLeadIds)
    const total = allLeadIds.length
    const batches: string[][] = []
    for (let i = 0; i < total; i += BATCH_SIZE) {
      batches.push(allLeadIds.slice(i, i + BATCH_SIZE))
    }

    setIsGenerating(true)
    setResults([])
    setProgress({ total, completed: 0 })
    setBatchInfo(batches.length > 1 ? { current: 1, total: batches.length } : null)

    const allCollected: BulkResult[] = []
    let totalCompleted = 0

    try {
      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        const batchLeadIds = batches[batchIdx]
        if (batches.length > 1) {
          setBatchInfo({ current: batchIdx + 1, total: batches.length })
        }

        const res = await fetch('/api/generate-bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leadIds: batchLeadIds,
            tone,
            customInstructions,
            templateId: selectedTemplateId || undefined,
          }),
        })

        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const reader = res.body?.getReader()
        if (!reader) throw new Error('ストリーム取得に失敗')

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const data = JSON.parse(line)
              if (data.type === 'result') {
                const realLead = leads.find(l => l.id === data.leadId)
                const newResult: BulkResult = {
                  leadId: data.leadId,
                  companyName: realLead?.company_name ?? data.companyName,
                  subject: data.subject,
                  body: data.body,
                  error: data.error,
                }
                allCollected.push(newResult)
                totalCompleted++
                setResults(prev => [...prev, newResult])
                // 全体の進捗で上書き
                setProgress({ total, completed: totalCompleted })
              }
            } catch {
              // Skip malformed lines
            }
          }
        }
      }

      // 自動キュー追加
      if (autoQueue && allCollected.length > 0) {
        setIsQueuingAll(true)
        const targets = allCollected.filter(r => !r.error && r.body)
        await Promise.all(
          targets.map(r =>
            addToQueue({
              lead_id: r.leadId,
              message_content: r.body,
              subject: r.subject || undefined,
            }).then(({ error }) => {
              if (!error) {
                setResults(prev => prev.map(p => p.leadId === r.leadId ? { ...p, queued: true } : p))
              }
            })
          )
        )
        setIsQueuingAll(false)
      }
    } catch (err) {
      console.error('Bulk generate error:', err)
    } finally {
      setIsGenerating(false)
      setBatchInfo(null)
    }
  }, [selectedLeadIds, tone, customInstructions, selectedTemplateId, leads, autoQueue])

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

  const handleSaveAndQueueAll = async () => {
    setIsSavingAll(true)
    setIsQueuingAll(true)
    const targets = results.filter(r => !r.error && r.body && !r.queued)
    // Promise.all で並列処理（全件同時に送信）
    await Promise.all(
      targets.map(async (result) => {
        // Save（未保存の場合のみ）
        if (!result.saved) {
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
        // Queue
        const { error: qErr } = await addToQueue({
          lead_id: result.leadId,
          message_content: result.body,
          subject: result.subject || undefined,
        })
        if (!qErr) {
          setResults(prev => prev.map(r =>
            r.leadId === result.leadId ? { ...r, queued: true } : r
          ))
        }
      })
    )
    setIsSavingAll(false)
    setIsQueuingAll(false)
    // 完了後に送信管理画面へ自動遷移
    router.push('/dashboard/sending')
  }

  const successCount = results.filter(r => !r.error && r.body).length
  const errorCount = results.filter(r => r.error).length
  const unqueuedCount = results.filter(r => !r.error && r.body && !r.queued).length

  return (
    <div className="flex-1 min-h-0 flex overflow-hidden">
      {/* Left: Selection & Controls */}
      <div className="w-[360px] flex-shrink-0 border-r border-gray-800 flex flex-col overflow-hidden">
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Search */}
          <input
            type="text"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setVisibleCount(VISIBLE_BATCH) }}
            placeholder="リードを検索..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />

          {/* Prefecture filter */}
          <select
            value={prefectureFilter}
            onChange={e => { setPrefectureFilter(e.target.value); setVisibleCount(VISIBLE_BATCH) }}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="all">都道府県: すべて</option>
            {(() => {
              const prefs = [...new Set(leads.map(l => l.prefecture ?? l.notes).filter(Boolean))] as string[]
              return prefs.sort().map(p => <option key={p} value={p}>{p} ({leads.filter(l => (l.prefecture ?? l.notes) === p).length})</option>)
            })()}
          </select>

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

          {/* Lead list (virtualized: show first N, load more on scroll) */}
          <div className="space-y-1 max-h-[300px] overflow-y-auto" onScroll={e => {
            const el = e.currentTarget
            if (el.scrollTop + el.clientHeight >= el.scrollHeight - 50 && visibleCount < filteredLeads.length) {
              setVisibleCount(v => Math.min(v + VISIBLE_BATCH, filteredLeads.length))
            }
          }}>
            {filteredLeads.slice(0, visibleCount).map(lead => (
              <LeadRow
                key={lead.id}
                lead={lead}
                isSelected={selectedLeadIds.has(lead.id)}
                onToggle={toggleLead}
              />
            ))}
            {visibleCount < filteredLeads.length && (
              <div className="text-center py-2">
                <span className="text-[10px] text-gray-600">
                  {visibleCount}/{filteredLeads.length}件表示中 — スクロールで続きを読み込み
                </span>
              </div>
            )}
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
              <><Loader2 className="w-4 h-4 animate-spin" />
                {isQueuingAll
                  ? `キュー追加中...`
                  : batchInfo
                    ? `バッチ ${batchInfo.current}/${batchInfo.total}：${progress.completed}/${progress.total}件処理中`
                    : `生成中... (${progress.completed}/${progress.total})`}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {selectedLeadIds.size}件を一括生成
              </>
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
                {isGenerating
                  ? batchInfo
                    ? `バッチ ${batchInfo.current}/${batchInfo.total} 処理中... ${progress.completed}/${progress.total}件`
                    : `生成中... ${progress.completed}/${progress.total}件`
                  : `生成完了: ${successCount}件成功 / ${errorCount}件エラー`}
              </span>
              {results.length > 0 && !isGenerating && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveAndQueueAll}
                    disabled={(isSavingAll && isQueuingAll) || unqueuedCount === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white transition-colors"
                  >
                    {(isSavingAll || isQueuingAll) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    {(isSavingAll || isQueuingAll) ? '処理中...' : `全て確認待ちに追加 (${unqueuedCount}件)`}
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
