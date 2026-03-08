'use client'

import { useState } from 'react'
import { Clock, Trash2, ExternalLink, Building2, ChevronDown, ChevronUp } from 'lucide-react'
import type { CompanyAnalysis } from '@/types/analyses'
import { deleteAnalysis } from '@/app/dashboard/companies/actions'
import clsx from 'clsx'

interface AnalysisHistoryProps {
  analyses: CompanyAnalysis[]
  onSelect: (analysis: CompanyAnalysis) => void
  onDeleted: (id: string) => void
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'たった今'
  if (m < 60) return `${m}分前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}時間前`
  return `${Math.floor(h / 24)}日前`
}

function HistoryItem({
  analysis,
  onSelect,
  onDeleted,
}: {
  analysis: CompanyAnalysis
  onSelect: (a: CompanyAnalysis) => void
  onDeleted: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    const { error } = await deleteAnalysis(analysis.id)
    if (!error) onDeleted(analysis.id)
    setDeleting(false)
    setConfirmDelete(false)
  }

  return (
    <div
      className={clsx(
        'bg-gray-800/60 border border-gray-700/50 rounded-xl overflow-hidden transition-all',
        'hover:border-gray-600'
      )}
    >
      <div className="flex items-start gap-2.5 p-3">
        <div className="w-7 h-7 bg-violet-500/10 border border-violet-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
          <Building2 className="w-3.5 h-3.5 text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-medium text-white truncate max-w-[140px]">
              {analysis.company_name ?? '名称不明'}
            </span>
            {analysis.industry && (
              <span className="text-xs px-1.5 py-0.5 bg-gray-700 rounded text-gray-400">
                {analysis.industry}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <Clock className="w-2.5 h-2.5 text-gray-600" />
            <span className="text-xs text-gray-600">{timeAgo(analysis.created_at)}</span>
          </div>
        </div>
      </div>

      <div className="px-3 pb-3">
        {expanded && analysis.business_summary && (
          <p className="text-xs text-gray-400 leading-relaxed mb-2">{analysis.business_summary}</p>
        )}

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onSelect(analysis)}
            className="flex-1 text-xs text-violet-400 hover:text-violet-300 font-medium py-1 px-2 rounded-lg bg-violet-500/10 hover:bg-violet-500/15 transition-colors text-center"
          >
            読み込む
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 text-gray-600 hover:text-gray-400 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <a
            href={analysis.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 text-gray-600 hover:text-blue-400 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-gray-500 hover:text-gray-300 px-1.5 py-1 rounded transition-colors"
              >
                戻る
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-xs text-red-400 hover:text-red-300 px-1.5 py-1 rounded bg-red-500/10 transition-colors"
              >
                {deleting ? '...' : '削除'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1 text-gray-600 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AnalysisHistory({ analyses, onSelect, onDeleted }: AnalysisHistoryProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">分析履歴</h3>
        {analyses.length > 0 && (
          <span className="text-xs text-gray-500">{analyses.length} 件</span>
        )}
      </div>

      {analyses.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 py-12 text-center">
          <Clock className="w-8 h-8 text-gray-700 mb-3" />
          <p className="text-sm text-gray-500">まだ分析履歴がありません</p>
          <p className="text-xs text-gray-600 mt-1">分析するとここに表示されます</p>
        </div>
      ) : (
        <div className="space-y-2 overflow-y-auto flex-1 pr-0.5">
          {analyses.map(analysis => (
            <HistoryItem
              key={analysis.id}
              analysis={analysis}
              onSelect={onSelect}
              onDeleted={onDeleted}
            />
          ))}
        </div>
      )}
    </div>
  )
}
