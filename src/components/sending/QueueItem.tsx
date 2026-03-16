'use client'

import { useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  Send,
  RefreshCw,
  Trash2,
  AlertCircle,
  Building2,
  RotateCcw,
  Globe,
} from 'lucide-react'
import clsx from 'clsx'
import type { SendQueueItem } from '@/types/sending'
import { SEND_STATUS_CONFIG, SEND_METHOD_CONFIG } from '@/types/sending'
import { markAsReady, deleteQueueItem, retryQueueItem } from '@/app/dashboard/sending/actions'

interface QueueItemProps {
  item: SendQueueItem
  onSendClick: (item: SendQueueItem) => void
  onDeleted: (id: string) => void
  onUpdated: (id: string, status: SendQueueItem['status']) => void
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'たった今'
  if (minutes < 60) return `${minutes}分前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}時間前`
  const days = Math.floor(hours / 24)
  return `${days}日前`
}

export default function QueueItem({
  item,
  onSendClick,
  onDeleted,
  onUpdated,
}: QueueItemProps) {
  const [expanded, setExpanded] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [loading, setLoading] = useState(false)

  const cfg = SEND_STATUS_CONFIG[item.status]

  const handleMarkReady = async () => {
    setLoading(true)
    const { error } = await markAsReady(item.id)
    setLoading(false)
    if (!error) onUpdated(item.id, '確認待ち')
  }

  const handleRetry = async () => {
    setLoading(true)
    const { error } = await retryQueueItem(item.id)
    setLoading(false)
    if (!error) onUpdated(item.id, '待機中')
  }

  const handleDelete = async () => {
    setLoading(true)
    const { error } = await deleteQueueItem(item.id)
    setLoading(false)
    if (!error) {
      onDeleted(item.id)
    } else {
      setConfirmDelete(false)
    }
  }

  const lead = item.lead

  return (
    <div
      className={clsx(
        'rounded-xl border transition-all',
        item.status === '失敗'
          ? 'bg-red-500/5 border-red-500/20'
          : 'bg-gray-900 border-gray-800 hover:border-gray-700'
      )}
    >
      {/* Main row */}
      <div className="flex items-center gap-3 p-4">
        {/* Company avatar */}
        <div className="w-9 h-9 bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-semibold text-gray-300 border border-gray-700">
          {lead?.company_name?.charAt(0) ?? '?'}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white truncate">
              {lead?.company_name ?? '不明な会社'}
            </span>
            {lead?.contact_name && (
              <span className="text-xs text-gray-500">{lead.contact_name}</span>
            )}
            {lead?.website_url && (
              <a
                href={lead.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-gray-400 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {lead?.industry && (
              <span className="text-xs text-gray-600">{lead.industry}</span>
            )}
            <span className="text-xs text-gray-600">{timeAgo(item.created_at)}</span>
            {item.send_method && (
              <span className={clsx(
                'text-[10px] px-1.5 py-0.5 rounded-md font-medium border',
                SEND_METHOD_CONFIG[item.send_method]?.bg,
                SEND_METHOD_CONFIG[item.send_method]?.border,
                SEND_METHOD_CONFIG[item.send_method]?.color,
              )}>
                {SEND_METHOD_CONFIG[item.send_method]?.label ?? item.send_method}
              </span>
            )}
            {item.retry_count > 0 && (
              <span className="text-xs text-amber-500/70 flex items-center gap-1">
                <RotateCcw className="w-2.5 h-2.5" />
                {item.retry_count}回リトライ
              </span>
            )}
          </div>
          {/* Message preview */}
          <p className="text-xs text-gray-500 mt-1 line-clamp-1">
            {item.message_content.slice(0, 80)}…
          </p>
        </div>

        {/* Status badge */}
        <div
          className={clsx(
            'flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
            cfg.bg,
            cfg.border,
            cfg.color
          )}
        >
          <span className={clsx('w-1.5 h-1.5 rounded-full', cfg.dot)} />
          {cfg.label}
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex-shrink-0 p-1.5 text-gray-600 hover:text-gray-400 transition-colors rounded-lg hover:bg-gray-800"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-800 p-4 space-y-4">
          {/* Error message */}
          {item.status === '失敗' && item.error_message && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-red-400 mb-0.5">エラー詳細</p>
                <p className="text-xs text-red-300/80">{item.error_message}</p>
              </div>
            </div>
          )}

          {/* Lead info */}
          {lead && (
            <div className="flex items-start gap-2 p-3 bg-gray-800/50 rounded-lg">
              <Building2 className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-gray-300">{lead.company_name}</p>
                {lead.contact_name && (
                  <p className="text-xs text-gray-500">担当: {lead.contact_name}</p>
                )}
                {lead.email && (
                  <p className="text-xs text-gray-500">Email: {lead.email}</p>
                )}
                {lead.website_url && (
                  <a
                    href={lead.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1"
                  >
                    {lead.website_url}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Form URL & Screenshot */}
          {item.form_url && (
            <div className="flex items-center gap-2 p-2 bg-cyan-500/5 border border-cyan-500/20 rounded-lg">
              <Globe className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
              <a href={item.form_url} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-400 hover:text-cyan-300 truncate">
                {item.form_url}
              </a>
            </div>
          )}
          {item.screenshot_url && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">送信後スクリーンショット</p>
              <a href={item.screenshot_url} target="_blank" rel="noopener noreferrer">
                <img src={item.screenshot_url} alt="送信結果" className="rounded-lg border border-gray-700 max-h-32 object-cover" />
              </a>
            </div>
          )}

          {/* Message content */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">送信文面</p>
            <div className="bg-gray-800/60 border border-gray-700/50 rounded-lg p-3">
              <pre className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed font-sans">
                {item.message_content}
              </pre>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* 待機中 → 確認待ち */}
            {item.status === '待機中' && (
              <button
                onClick={handleMarkReady}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                確認待ちにする
              </button>
            )}

            {/* 確認待ち → 送信 (opens modal) */}
            {item.status === '確認待ち' && (
              <button
                onClick={() => onSendClick(item)}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                送信する
              </button>
            )}

            {/* 失敗 → リトライ */}
            {item.status === '失敗' && (
              <button
                onClick={handleRetry}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                リトライ
              </button>
            )}

            {/* Delete */}
            <div className="ml-auto">
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-400">本当に削除しますか？</span>
                  <button
                    onClick={handleDelete}
                    disabled={loading}
                    className="px-2.5 py-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    削除
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="px-2.5 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-semibold rounded-lg transition-colors"
                  >
                    キャンセル
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/10 text-xs rounded-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  削除
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
