'use client'

import { useState, useCallback, useMemo, useEffect, useSyncExternalStore, memo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Sparkles, Loader2, Check, X, Globe, Mail, Send,
  ChevronDown, ChevronUp, RefreshCw, Save, CheckSquare, Square, Zap,
} from 'lucide-react'
import ToneSelector from './ToneSelector'
import TemplateSelector from './TemplateSelector'
import { saveMessage } from '@/app/dashboard/compose/actions'
import { addToQueue } from '@/app/dashboard/sending/actions'
import {
  subscribe,
  getSnapshot,
  startBulkGeneration,
  clearResults,
  hasPendingJob,
  getPendingCount,
  resumeGeneration,
  type BulkResult,
} from '@/lib/bulk-generate-store'
import type { Lead, LeadOption } from '@/types/leads'
import type { Tone } from '@/types/messages'
import type { MessageTemplate } from '@/types/settings'
import clsx from 'clsx'

// BulkResult はストアから import

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
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(() => {
    // localStorageから復元 + URLパラメータをマージ
    const restored = new Set<string>()
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('bulk_selected_leads')
        if (saved) {
          const ids = JSON.parse(saved) as string[]
          ids.forEach(id => restored.add(id))
        }
      } catch { /* ignore */ }
    }
    // URLパラメータがあればマージ
    if (initialSelectedIds && initialSelectedIds.length > 0) {
      initialSelectedIds.forEach(id => restored.add(id))
    }
    return restored
  })
  // selectedLeadIdsをsessionStorageに永続化
  useEffect(() => {
    localStorage.setItem('bulk_selected_leads', JSON.stringify(Array.from(selectedLeadIds)))
  }, [selectedLeadIds])

  const [customInstructions, setCustomInstructions] = useState('')

  // グローバルストアから生成状態を取得（ページ遷移しても保持される）
  const globalState = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const isGenerating = globalState.isGenerating
  const progress = globalState.progress
  const results = globalState.results
  const batchInfo = globalState.batchInfo

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [prefectureFilter, setPrefectureFilter] = useState('all')
  const [contactMethodFilter, setContactMethodFilter] = useState('all')
  const [visibleCount, setVisibleCount] = useState(VISIBLE_BATCH)
  const [isSavingAll, setIsSavingAll] = useState(false)
  const [isQueuingAll, setIsQueuingAll] = useState(false)

  // Filtered leads（検索クエリ + 都道府県 + 連絡方法フィルター）
  const filteredLeads = useMemo(() => {
    let rows = leads
    if (prefectureFilter !== 'all') {
      rows = rows.filter(l => (l.prefecture ?? l.notes) === prefectureFilter)
    }
    if (contactMethodFilter !== 'all') {
      if (contactMethodFilter === 'viable') {
        rows = rows.filter(l => l.contact_method === 'form' || l.contact_method === 'email')
      } else if (contactMethodFilter === 'unscanned') {
        rows = rows.filter(l => !l.contact_method)
      } else {
        rows = rows.filter(l => l.contact_method === contactMethodFilter)
      }
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
  }, [leads, searchQuery, prefectureFilter, contactMethodFilter])

  // 連絡方法未検出のリード数
  const noContactCount = useMemo(() =>
    filteredLeads.filter(l => l.contact_method === 'none').length
  , [filteredLeads])

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

  const selectViable = () => {
    setSelectedLeadIds(new Set(
      filteredLeads.filter(l => l.contact_method === 'form' || l.contact_method === 'email').map(l => l.id)
    ))
  }

  const handleBulkGenerate = useCallback(() => {
    if (selectedLeadIds.size === 0) return
    // グローバルストアで生成開始（ページ遷移しても継続する）
    startBulkGeneration({
      leadIds: Array.from(selectedLeadIds),
      tone,
      customInstructions,
      templateId: selectedTemplateId || undefined,
      leads: leads.map(l => ({ id: l.id, company_name: l.company_name })),
    })
  }, [selectedLeadIds, tone, customInstructions, selectedTemplateId, leads])

  // キュー追加は1件ずつストリーム受信時に自動実行済み
  // 以下は手動での再キュー追加用
  const handleSaveAndQueueAll = async () => {
    setIsSavingAll(true)
    setIsQueuingAll(true)
    const targets = results.filter(r => !r.error && r.body && !r.queued)
    await Promise.all(
      targets.map(async (result) => {
        await addToQueue({
          lead_id: result.leadId,
          message_content: result.body,
          subject: result.subject || undefined,
        })
      })
    )
    setIsSavingAll(false)
    setIsQueuingAll(false)
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

          {/* Contact method filter (先に選択) */}
          <select
            value={contactMethodFilter}
            onChange={e => { setContactMethodFilter(e.target.value); setPrefectureFilter('all'); setVisibleCount(VISIBLE_BATCH) }}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="all">連絡方法: すべて</option>
            <option value="viable">📝📧 送信可能のみ（フォーム+メール）</option>
            <option value="form">📝 フォームのみ ({leads.filter(l => l.contact_method === 'form').length})</option>
            <option value="email">📧 メールのみ ({leads.filter(l => l.contact_method === 'email').length})</option>
            <option value="none">❌ なし ({leads.filter(l => l.contact_method === 'none').length})</option>
            <option value="unscanned">🔍 未スキャン ({leads.filter(l => !l.contact_method).length})</option>
          </select>

          {/* Prefecture filter (連絡方法で絞り込んだ後) */}
          <select
            value={prefectureFilter}
            onChange={e => { setPrefectureFilter(e.target.value); setVisibleCount(VISIBLE_BATCH) }}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="all">都道府県: すべて</option>
            {(() => {
              let base = leads
              if (contactMethodFilter !== 'all') {
                if (contactMethodFilter === 'viable') base = base.filter(l => l.contact_method === 'form' || l.contact_method === 'email')
                else if (contactMethodFilter === 'unscanned') base = base.filter(l => !l.contact_method)
                else base = base.filter(l => l.contact_method === contactMethodFilter)
              }
              const prefs = [...new Set(base.map(l => l.prefecture ?? l.notes).filter(Boolean))] as string[]
              return prefs.sort().map(p => <option key={p} value={p}>{p} ({base.filter(l => (l.prefecture ?? l.notes) === p).length})</option>)
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
            <button onClick={selectViable} className="px-2.5 py-1 text-xs font-medium bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 hover:bg-emerald-500/20 transition-colors">
              ✅ 送信可能のみ
            </button>
            <span className="text-xs text-gray-500 ml-auto">{selectedLeadIds.size}件選択</span>
          </div>

          {noContactCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/5 border border-amber-500/20 rounded-lg">
              <span className="text-xs text-amber-400">⚠️ {noContactCount}件は連絡方法未検出です。「npm run detect」で事前検出してください。</span>
            </div>
          )}

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
        {/* 中断されたジョブの再開バナー */}
        {!isGenerating && hasPendingJob() && (
          <div className="px-5 pt-4 flex-shrink-0">
            <div className="flex items-center justify-between p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-amber-400" />
                <span className="text-sm text-amber-300">
                  前回の生成が中断されました。残り{getPendingCount()}件が未処理です。
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => resumeGeneration()}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold rounded-lg transition-colors"
                >
                  再開する
                </button>
                <button
                  onClick={() => clearResults()}
                  className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg transition-colors"
                >
                  破棄
                </button>
              </div>
            </div>
          </div>
        )}
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
