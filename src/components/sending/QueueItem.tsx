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
  TriangleAlert,
  CheckCircle2,
  Undo2,
  XCircle,
  Copy,
  Mail,
} from 'lucide-react'
import clsx from 'clsx'
import type { SendQueueItem } from '@/types/sending'
import { SEND_STATUS_CONFIG, SEND_METHOD_CONFIG } from '@/types/sending'
import { deleteQueueItem, retryQueueItem, markAsSent, resetToReview, confirmFormNotFound, changeSendMethod } from '@/app/dashboard/sending/actions'

interface QueueItemProps {
  item: SendQueueItem
  onSendClick: (item: SendQueueItem) => void
  onDeleted: (id: string) => void
  onUpdated: (id: string, status: SendQueueItem['status']) => void
}

// フロント側でもレビューサイトを検出（ワーカーと同じリスト）
const REVIEW_SITE_DOMAINS = [
  'sauna-ikitai.com', 'tabelog.com', 'hotpepper.jp', 'jalan.net',
  'ikyu.com', 'booking.com', 'tripadvisor', 'retty.me', 'gurunavi.com',
  'gnavi.co.jp', 'mapion.co.jp', 'eonet.ne.jp',
]

function isReviewSiteUrl(url: string | null | undefined): boolean {
  if (!url) return false
  const lower = url.toLowerCase()
  return REVIEW_SITE_DOMAINS.some(domain => lower.includes(domain))
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
  const [showEvidence, setShowEvidence] = useState(false)

  const cfg = SEND_STATUS_CONFIG[item.status] ?? {
    label: item.status,
    color: 'text-gray-400',
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/20',
    dot: 'bg-gray-400',
  }

  // フォーム送信なのにレビューサイトURLが設定されている場合に警告
  const hasReviewSiteUrl = item.send_method === 'form' && isReviewSiteUrl(item.lead?.company_url)

  const handleRetry = async () => {
    setLoading(true)
    const { error } = await retryQueueItem(item.id)
    setLoading(false)
    if (!error) onUpdated(item.id, '確認待ち')
  }

  const handleMarkAsSent = async () => {
    setLoading(true)
    const { error } = await markAsSent(item.id)
    setLoading(false)
    if (!error) onUpdated(item.id, '送信済み')
  }

  const handleResetToReview = async () => {
    setLoading(true)
    const { error } = await resetToReview([item.id])
    setLoading(false)
    if (!error) onUpdated(item.id, '確認待ち')
  }

  const handleConfirmFormNotFound = async () => {
    setLoading(true)
    const { error } = await confirmFormNotFound(item.id)
    setLoading(false)
    if (!error) onUpdated(item.id, '手動対応')
  }

  const handleSwitchToEmail = async () => {
    setLoading(true)
    const { error } = await changeSendMethod([item.id], 'email')
    setLoading(false)
    if (!error) onUpdated(item.id, '確認待ち')
  }

  const [copied, setCopied] = useState(false)
  const handleCopyEmailText = () => {
    const companyName = lead?.company_name ?? ''
    const emailBody = `${companyName} 御中\n\n${item.message_content}`
    navigator.clipboard.writeText(emailBody)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
    <>
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
          {/* レビューサイトURL警告 */}
          {hasReviewSiteUrl && item.status === '確認待ち' && (
            <div className="flex items-center gap-1 mt-1">
              <TriangleAlert className="w-3 h-3 text-amber-400 flex-shrink-0" />
              <span className="text-[10px] text-amber-400">
                レビューサイトURL設定中。リード編集で企業公式URLに変更してください
              </span>
            </div>
          )}
        </div>

        {/* Status badge + evidence badge */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {item.status === '送信済み' && (
            <button
              onClick={(e) => { e.stopPropagation(); if (item.screenshot_url) setShowEvidence(true) }}
              className={clsx(
                'text-[10px] px-2 py-0.5 rounded-full font-medium border transition-colors',
                item.screenshot_url
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20 cursor-pointer'
                  : 'text-gray-500 bg-gray-500/10 border-gray-500/20 cursor-default'
              )}
            >
              {item.screenshot_url
                ? item.screenshot_url.startsWith('api_response:') ? '📋 証拠を見る' : '📸 証拠を見る'
                : '証拠なし'}
            </button>
          )}
          <div
            className={clsx(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
              cfg.bg,
              cfg.border,
              cfg.color
            )}
          >
            <span className={clsx('w-1.5 h-1.5 rounded-full', cfg.dot)} />
            {cfg.label}
          </div>
        </div>

        {/* Quick delete (inline) */}
        {confirmDelete ? (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={handleDelete}
              disabled={loading}
              className="px-2 py-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-[10px] font-semibold rounded-lg transition-colors"
            >
              削除
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-[10px] font-semibold rounded-lg transition-colors"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmDelete(true) }}
            title="削除"
            className="flex-shrink-0 p-1.5 text-gray-700 hover:text-red-400 hover:bg-red-500/10 transition-colors rounded-lg"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}

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
          {(item.status === '失敗' || item.status === 'form_not_found') && item.error_message && (
            <div className={clsx(
              'flex items-start gap-2 p-3 rounded-lg',
              item.status === 'form_not_found'
                ? 'bg-amber-500/10 border border-amber-500/20'
                : 'bg-red-500/10 border border-red-500/20'
            )}>
              <AlertCircle className={clsx(
                'w-4 h-4 flex-shrink-0 mt-0.5',
                item.status === 'form_not_found' ? 'text-amber-400' : 'text-red-400'
              )} />
              <div className="flex-1">
                <p className={clsx(
                  'text-xs font-medium mb-0.5',
                  item.status === 'form_not_found' ? 'text-amber-400' : 'text-red-400'
                )}>
                  {item.status === 'form_not_found' ? 'フォーム未検出' : 'エラー詳細'}
                </p>
                <p className={clsx(
                  'text-xs',
                  item.status === 'form_not_found' ? 'text-amber-300/80' : 'text-red-300/80'
                )}>
                  {item.error_message}
                </p>
                {item.retry_count !== undefined && item.retry_count > 0 && (
                  <p className="text-[10px] text-gray-500 mt-1">
                    リトライ回数: {item.retry_count}/3
                  </p>
                )}
              </div>
            </div>
          )}

          {/* フォーム未検出: メール文面コピーセクション */}
          {item.status === 'form_not_found' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-orange-400" />
                  <span className="text-xs font-medium text-orange-400">メール送信用テキスト</span>
                </div>
                <button
                  onClick={handleCopyEmailText}
                  className={clsx(
                    'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition-all',
                    copied
                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                      : 'bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white'
                  )}
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" />
                      コピー済み
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      文面をコピー
                    </>
                  )}
                </button>
              </div>
              <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-3">
                <pre className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed font-sans select-all">
                  {`${lead?.company_name ?? ''} 御中\n\n${item.message_content}`}
                </pre>
              </div>
              {lead?.email && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-500">送信先:</span>
                  <button
                    onClick={() => { navigator.clipboard.writeText(lead.email!); }}
                    className="text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                  >
                    {lead.email}
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              )}
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
                {lead.company_url && (
                  <div className="flex items-center gap-1">
                    {isReviewSiteUrl(lead.company_url) && item.send_method === 'form' ? (
                      <>
                        <TriangleAlert className="w-3 h-3 text-amber-400 flex-shrink-0" />
                        <span className="text-[10px] text-amber-400">フォーム送信URL (レビューサイト):</span>
                      </>
                    ) : (
                      <span className="text-xs text-gray-500">企業HP:</span>
                    )}
                    <a
                      href={lead.company_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={clsx(
                        'text-xs flex items-center gap-1 truncate max-w-[200px]',
                        isReviewSiteUrl(lead.company_url) && item.send_method === 'form'
                          ? 'text-amber-400 hover:text-amber-300'
                          : 'text-violet-400 hover:text-violet-300'
                      )}
                    >
                      {lead.company_url}
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>
                  </div>
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
              <p className="text-xs font-medium text-gray-500 mb-1">送信証拠</p>
              {item.screenshot_url.startsWith('api_response:') ? (
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
                  <p className="text-[10px] text-emerald-400 font-medium mb-1">📋 CF7 REST APIレスポンス</p>
                  <pre className="text-xs text-emerald-300/80 whitespace-pre-wrap font-mono">
                    {item.screenshot_url.replace('api_response:', '')}
                  </pre>
                </div>
              ) : item.screenshot_url.startsWith('chrome_screenshot:') ? (
                <div className="bg-violet-500/5 border border-violet-500/20 rounded-lg p-3">
                  <p className="text-xs text-violet-400">📸 スクリーンショット確認済み（ID: {item.screenshot_url.replace('chrome_screenshot:', '')}）</p>
                </div>
              ) : item.screenshot_url.startsWith('http') ? (
                <a href={item.screenshot_url} target="_blank" rel="noopener noreferrer">
                  <img src={item.screenshot_url} alt="送信結果" className="rounded-lg border border-gray-700 max-h-48 object-contain" />
                </a>
              ) : (
                <p className="text-xs text-gray-400">{item.screenshot_url}</p>
              )}
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

            {/* 確認待ち → 送信済みにする */}
            {item.status === '確認待ち' && (
              <button
                onClick={handleMarkAsSent}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-lg transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                送信済みにする
              </button>
            )}

            {/* 送信済み → 確認待ちに戻す */}
            {item.status === '送信済み' && (
              <button
                onClick={handleResetToReview}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 text-xs font-semibold rounded-lg transition-colors"
              >
                <Undo2 className="w-3.5 h-3.5" />
                確認待ちに戻す
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

            {/* form_not_found → 3つのアクション */}
            {item.status === 'form_not_found' && (
              <>
                <button
                  onClick={handleConfirmFormNotFound}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 text-orange-400 text-xs font-semibold rounded-lg transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  フォーム未検出確定
                </button>
                <button
                  onClick={handleMarkAsSent}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-lg transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  手動送信済み
                </button>
                <button
                  onClick={handleSwitchToEmail}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 text-xs font-semibold rounded-lg transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" />
                  メール送信に切替
                </button>
                <button
                  onClick={handleRetry}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 text-violet-400 text-xs font-semibold rounded-lg transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  リトライ
                </button>
              </>
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

    {/* 証拠モーダル */}
    {showEvidence && item.screenshot_url && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowEvidence(false)}>
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div className="relative w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-white">送信証拠</h3>
              <span className="text-xs text-gray-500">{item.lead?.company_name}</span>
            </div>
            <button onClick={() => setShowEvidence(false)} className="p-1 text-gray-500 hover:text-gray-300 transition-colors">
              <span className="text-lg leading-none">&times;</span>
            </button>
          </div>
          <div className="p-5 max-h-[70vh] overflow-y-auto">
            {item.screenshot_url.startsWith('api_response:') ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">CF7 REST API</span>
                  <span className="text-xs text-gray-500">フォーム送信APIレスポンス</span>
                </div>
                <pre className="text-xs text-emerald-300/80 bg-gray-800/60 border border-gray-700/50 rounded-lg p-4 whitespace-pre-wrap font-mono overflow-x-auto">
                  {(() => { try { return JSON.stringify(JSON.parse(item.screenshot_url.replace('api_response:', '')), null, 2) } catch { return item.screenshot_url.replace('api_response:', '') } })()}
                </pre>
              </div>
            ) : item.screenshot_url.startsWith('agent_result:') ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">AI Agent</span>
                  <span className="text-xs text-gray-500">Managed Agent 実行結果</span>
                </div>
                <pre className="text-xs text-violet-300/80 bg-gray-800/60 border border-gray-700/50 rounded-lg p-4 whitespace-pre-wrap font-mono overflow-x-auto">
                  {(() => { try { return JSON.stringify(JSON.parse(item.screenshot_url.replace('agent_result:', '')), null, 2) } catch { return item.screenshot_url.replace('agent_result:', '') } })()}
                </pre>
              </div>
            ) : item.screenshot_url.startsWith('chrome_screenshot:') ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full">Chrome MCP</span>
                  <span className="text-xs text-gray-500">ブラウザスクリーンショット</span>
                </div>
                <div className="bg-gray-800/60 border border-gray-700/50 rounded-lg p-4 text-center">
                  <p className="text-sm text-cyan-400">Screenshot ID: {item.screenshot_url.replace('chrome_screenshot:', '')}</p>
                  <p className="text-xs text-gray-500 mt-1">Chrome MCPで撮影された送信完了画面のスクリーンショット</p>
                </div>
              </div>
            ) : item.screenshot_url.startsWith('complete_page:') || item.screenshot_url.startsWith('thanks_page:') ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">完了ページ</span>
                  <span className="text-xs text-gray-500">送信完了後のリダイレクト先</span>
                </div>
                <a
                  href={item.screenshot_url.replace(/^(complete_page|thanks_page):/, '')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-gray-800/60 border border-gray-700/50 rounded-lg p-4 text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  <ExternalLink className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm truncate">{item.screenshot_url.replace(/^(complete_page|thanks_page):/, '')}</span>
                </a>
              </div>
            ) : item.screenshot_url.startsWith('http') ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">スクリーンショット</span>
                </div>
                <a href={item.screenshot_url} target="_blank" rel="noopener noreferrer">
                  <img src={item.screenshot_url} alt="送信結果" className="rounded-lg border border-gray-700 w-full object-contain" />
                </a>
              </div>
            ) : (
              <div className="bg-gray-800/60 border border-gray-700/50 rounded-lg p-4">
                <p className="text-sm text-gray-300">{item.screenshot_url}</p>
              </div>
            )}
            {item.sent_at && (
              <p className="text-xs text-gray-600 mt-4">送信日時: {new Date(item.sent_at).toLocaleString('ja-JP')}</p>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  )
}
