'use client'

import { useState } from 'react'
import { Clock, Trash2, ChevronDown, ChevronUp, Building2 } from 'lucide-react'
import type { Message } from '@/types/messages'
import { TONE_CONFIG } from '@/types/messages'
import { deleteMessage } from '@/app/dashboard/compose/actions'
import clsx from 'clsx'

interface HistoryPanelProps {
  messages: Message[]
  onSelect: (content: string) => void
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

function HistoryItem({ msg, onSelect, onDeleted }: {
  msg: Message
  onSelect: (content: string) => void
  onDeleted: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const toneCfg = TONE_CONFIG[msg.tone as keyof typeof TONE_CONFIG]

  const handleDelete = async () => {
    setDeleting(true)
    const { error } = await deleteMessage(msg.id)
    if (!error) onDeleted(msg.id)
    setDeleting(false)
    setConfirmDelete(false)
  }

  return (
    <div className={clsx(
      'bg-gray-800/60 border border-gray-700/50 rounded-xl overflow-hidden transition-all',
      'hover:border-gray-600'
    )}>
      {/* Header */}
      <div className="flex items-start gap-2.5 p-3">
        <div className="w-7 h-7 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
          <Building2 className="w-3.5 h-3.5 text-gray-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-medium text-white truncate">
              {msg.lead?.company_name ?? 'リード未選択'}
            </span>
            {toneCfg && (
              <span className={clsx('text-xs px-1.5 py-0.5 rounded font-medium', toneCfg.bg, toneCfg.color)}>
                {msg.tone}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <Clock className="w-2.5 h-2.5 text-gray-600" />
            <span className="text-xs text-gray-600">{timeAgo(msg.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="px-3 pb-3">
        <p className={clsx('text-xs text-gray-400 leading-relaxed', !expanded && 'line-clamp-2')}>
          {msg.content}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-1.5 mt-2">
          <button
            onClick={() => onSelect(msg.content)}
            className="flex-1 text-xs text-violet-400 hover:text-violet-300 font-medium py-1 px-2 rounded-lg bg-violet-500/10 hover:bg-violet-500/15 transition-colors text-center"
          >
            編集に読み込む
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 text-gray-600 hover:text-gray-400 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
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

export default function HistoryPanel({ messages, onSelect, onDeleted }: HistoryPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">生成履歴</h3>
        {messages.length > 0 && (
          <span className="text-xs text-gray-500">{messages.length} 件</span>
        )}
      </div>

      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 py-12 text-center">
          <Clock className="w-8 h-8 text-gray-700 mb-3" />
          <p className="text-sm text-gray-500">まだ生成履歴がありません</p>
          <p className="text-xs text-gray-600 mt-1">保存したメッセージがここに表示されます</p>
        </div>
      ) : (
        <div className="space-y-2 overflow-y-auto flex-1 pr-0.5">
          {messages.map(msg => (
            <HistoryItem
              key={msg.id}
              msg={msg}
              onSelect={onSelect}
              onDeleted={onDeleted}
            />
          ))}
        </div>
      )}
    </div>
  )
}
