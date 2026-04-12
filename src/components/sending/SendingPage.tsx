'use client'

import { useState, useMemo } from 'react'
import {
  Send,
  Eye,
  CheckCircle2,
  XCircle,
  InboxIcon,
  Plus,
  RefreshCw,
  Trash2,
  CheckSquare,
  Square,
  Rocket,
  Zap,
  Loader2,
  AlertTriangle,
  ExternalLink,
  Globe,
  Search,
  Ban,
} from 'lucide-react'
import clsx from 'clsx'
import type { SendQueueItem, SendStats } from '@/types/sending'
import type { Lead, LeadOption } from '@/types/leads'
import type { Message } from '@/types/messages'
import StatsPanel from './StatsPanel'
import QueueItem from './QueueItem'
import SendConfirmModal from './SendConfirmModal'
import AddToQueueModal from './AddToQueueModal'
import { deleteQueueItem, retryQueueItem, markAsSent, markAsManual, changeSendMethod, resetToReview, markAsUnsendable } from '@/app/dashboard/sending/actions'

// ──────────────────────────────────────────
// Tab definitions
// ──────────────────────────────────────────
type Tab = '全て' | '確認待ち' | '手動対応' | '送信済み' | '失敗' | 'フォーム未検出' | '送信不可'

const TABS: { label: Tab; icon: React.ReactNode; count?: (s: SendStats) => number; urgent?: boolean }[] = [
  { label: '全て', icon: <Send className="w-3.5 h-3.5" />, count: s => s.total },
  { label: '確認待ち', icon: <Eye className="w-3.5 h-3.5" />, count: s => s.reviewing },
  { label: '手動対応', icon: <AlertTriangle className="w-3.5 h-3.5" />, count: s => s.manual, urgent: true },
  { label: '送信済み', icon: <CheckCircle2 className="w-3.5 h-3.5" />, count: s => s.sent },
  { label: '失敗', icon: <XCircle className="w-3.5 h-3.5" />, count: s => s.failed },
  { label: 'フォーム未検出', icon: <Globe className="w-3.5 h-3.5" />, count: s => s.formNotFound },
  { label: '送信不可', icon: <Ban className="w-3.5 h-3.5" />, count: s => s.unsendable },
]

// ──────────────────────────────────────────
// Helper to rebuild stats from items
// ──────────────────────────────────────────
function buildStats(items: SendQueueItem[]): SendStats {
  return {
    total: items.length,
    reviewing: items.filter(i => i.status === '確認待ち').length,
    sent: items.filter(i => i.status === '送信済み').length,
    failed: items.filter(i => i.status === '失敗').length,
    manual: items.filter(i => i.status === '手動対応').length,
    formNotFound: items.filter(i => i.status === 'form_not_found').length,
    unsendable: items.filter(i => i.status === '送信不可').length,
  }
}

// ──────────────────────────────────────────
// Props
// ──────────────────────────────────────────
interface SendingPageProps {
  initialQueue: SendQueueItem[]
  leads: LeadOption[]
  messages: Message[]
}

// ──────────────────────────────────────────
// Main component
// ──────────────────────────────────────────
export default function SendingPage({ initialQueue, leads, messages }: SendingPageProps) {
  const [queue, setQueue] = useState<SendQueueItem[]>(initialQueue)
  const [activeTab, setActiveTab] = useState<Tab>('全て')
  const [confirmItem, setConfirmItem] = useState<SendQueueItem | null>(null)
  const [confirmQueue, setConfirmQueue] = useState<SendQueueItem[]>([]) // 一括送信の残りキュー
  const [showAddModal, setShowAddModal] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [isBulkProcessing, setIsBulkProcessing] = useState(false)

  // 自動一括送信の進捗
  const [autoProgress, setAutoProgress] = useState<{
    total: number
    completed: number
    current: string | null
    errors: string[]
    done: boolean
  } | null>(null)

  const stats = useMemo(() => buildStats(queue), [queue])

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selected.size === filteredQueue.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filteredQueue.map(i => i.id)))
    }
  }

  // 送信済み → 確認待ちに戻す
  const handleBulkResetToReview = async () => {
    const ids = Array.from(selected)
    if (!ids.length) return
    if (!confirm(`${ids.length}件を「確認待ち」に戻します。本当に送信済みだったものを戻すと再送信されます。よろしいですか？`)) return
    setIsBulkProcessing(true)
    const { error } = await resetToReview(ids)
    if (!error) {
      setQueue(prev => prev.map(item =>
        ids.includes(item.id)
          ? { ...item, status: '確認待ち', error_message: null, sent_at: null, retry_count: 0 }
          : item
      ))
      setSelected(new Set())
    }
    setIsBulkProcessing(false)
  }

  // 選択アイテムの送信方法を一括変更
  const handleBulkChangeSendMethod = async (method: 'form' | 'manual' | 'email') => {
    const ids = Array.from(selected)
    if (!ids.length) return
    setIsBulkProcessing(true)
    const { error } = await changeSendMethod(ids, method)
    if (!error) {
      setQueue(prev => prev.map(item =>
        ids.includes(item.id)
          ? { ...item, send_method: method, status: '確認待ち', error_message: null }
          : item
      ))
      setSelected(new Set())
    }
    setIsBulkProcessing(false)
  }

  const handleBulkDelete = async () => {
    if (!selected.size || !confirm(`${selected.size}件を削除しますか？`)) return
    setIsBulkProcessing(true)
    for (const id of selected) {
      await deleteQueueItem(id)
      setQueue(prev => prev.filter(i => i.id !== id))
    }
    setSelected(new Set())
    setIsBulkProcessing(false)
  }

  const handleBulkSendAll = () => {
    // 確認待ち・失敗どちらも一括送信対象にする
    const sendableItems = filteredQueue.filter(
      i => (i.status === '確認待ち' || i.status === '失敗') && selected.has(i.id)
    )
    if (!sendableItems.length) return
    // 1件目を表示、残りをキューに積む（1件確認後に自動で次を表示）
    setConfirmItem(sendableItems[0])
    setConfirmQueue(sendableItems.slice(1))
    setSelected(new Set())
  }

  const handleAutoSendAll = async () => {
    const sendableItems = filteredQueue.filter(
      i => (i.status === '確認待ち' || i.status === '失敗') && selected.has(i.id)
    )
    if (!sendableItems.length) return
    setSelected(new Set())
    const errors: string[] = []
    setAutoProgress({ total: sendableItems.length, completed: 0, current: null, errors: [], done: false })

    for (const item of sendableItems) {
      const companyName = item.lead?.company_name ?? '不明'
      setAutoProgress(prev => prev ? { ...prev, current: companyName } : null)
      try {
        if (item.send_method === 'form') {
          const res = await fetch('/api/submit-form', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ queueItemId: item.id }),
          })
          let data: { error?: string } = {}
          try { data = await res.json() } catch { /* ignore */ }
          if (!res.ok || data.error) {
            errors.push(`${companyName}: ${data.error ?? `HTTP ${res.status}`}`)
          } else {
            setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: '確認待ち' as const } : q))
          }
        } else if (item.send_method === 'email' && item.lead?.email) {
          const res = await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: item.lead.email,
              subject: item.subject || `${companyName}へのご提案`,
              body: item.message_content,
              leadId: item.lead_id,
              queueItemId: item.id,
            }),
          })
          let data: { error?: string } = {}
          try { data = await res.json() } catch { /* ignore */ }
          if (!res.ok || data.error) {
            errors.push(`${companyName}: ${data.error ?? `HTTP ${res.status}`}`)
          } else {
            setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: '送信済み' as const, sent_at: new Date().toISOString() } : q))
          }
        } else {
          // 手動: 送信済みとしてマーク
          const { error } = await markAsSent(item.id)
          if (error) {
            errors.push(`${companyName}: ${error}`)
          } else {
            setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: '送信済み' as const, sent_at: new Date().toISOString() } : q))
          }
        }
      } catch (err) {
        errors.push(`${companyName}: ${err instanceof Error ? err.message : 'ネットワークエラー'}`)
      }
      setAutoProgress(prev => prev ? { ...prev, completed: prev.completed + 1, errors: [...errors] } : null)
    }
    setAutoProgress(prev => prev ? { ...prev, done: true, current: null } : null)
  }

  const filteredQueue = useMemo(
    () => {
      let items: SendQueueItem[]
      if (activeTab === '全て') items = queue.filter(i => i.status !== '手動対応' && i.status !== '送信不可')
      else if (activeTab === 'フォーム未検出') items = queue.filter(i => i.status === 'form_not_found')
      else if (activeTab === '送信不可') items = queue.filter(i => i.status === '送信不可')
      else items = queue.filter(i => i.status === activeTab)

      // 検索フィルター
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        items = items.filter(i =>
          (i.lead?.company_name ?? '').toLowerCase().includes(q) ||
          (i.message_content ?? '').toLowerCase().includes(q) ||
          (i.subject ?? '').toLowerCase().includes(q)
        )
      }
      return items
    },
    [queue, activeTab, searchQuery]
  )

  const manualItems = useMemo(
    () => queue.filter(i => i.status === '手動対応'),
    [queue]
  )

  // Called when QueueItem status changes (e.g. 待機中→確認待ち)
  const handleUpdated = (id: string, status: SendQueueItem['status']) => {
    setQueue(prev =>
      prev.map(item => (item.id === id ? { ...item, status } : item))
    )
  }

  // Called after QueueItem is deleted
  const handleDeleted = (id: string) => {
    setQueue(prev => prev.filter(item => item.id !== id))
  }

  // Called after SendConfirmModal confirms sent
  const handleSent = (id: string) => {
    setQueue(prev =>
      prev.map(item => {
        if (item.id !== id) return item
        // 全ての送信方法で「送信済み」に楽観的更新。
        // フォーム送信はページ更新後にワーカーの実際の結果が反映される。
        return { ...item, status: '送信済み' as const, sent_at: new Date().toISOString() }
      })
    )
    // 一括送信キューが残っていれば次を表示、なければ閉じる
    if (confirmQueue.length > 0) {
      setConfirmItem(confirmQueue[0])
      setConfirmQueue(prev => prev.slice(1))
    } else {
      setConfirmItem(null)
    }
  }

  // Called after AddToQueueModal adds a new item
  const handleAdded = (newItem: SendQueueItem) => {
    setQueue(prev => [newItem, ...prev])
    setShowAddModal(false)
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-white">送信管理</h1>
          <p className="text-xs text-gray-500 mt-0.5">問い合わせフォームへの半自動送信を管理します</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          キューに追加
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Stats panel (clickable tabs) */}
        <StatsPanel stats={stats} activeTab={activeTab} onTabChange={setActiveTab} />

        {/* 検索窓 */}
        <div className="px-4 md:px-8 py-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="施設名・文面で検索..."
              className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* 手動対応ボックス（件数がある場合のみ表示） */}
        {manualItems.length > 0 && activeTab !== '手動対応' && (
          <div className="bg-yellow-500/5 border border-yellow-500/30 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-yellow-500/15 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-yellow-300">手動対応が必要 ({manualItems.length}件)</p>
                  <p className="text-xs text-yellow-400/70">CAPTCHAや複雑なフォームのため自動送信できませんでした</p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('手動対応')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/15 hover:bg-yellow-500/25 border border-yellow-500/30 text-yellow-300 text-xs font-semibold rounded-lg transition-colors"
              >
                詳細を見る
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-1.5">
              {manualItems.slice(0, 3).map(item => (
                <div key={item.id} className="flex items-center justify-between px-3 py-2 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-medium text-white truncate">{item.lead?.company_name ?? '不明'}</span>
                    {item.error_message && (
                      <span className="text-xs text-yellow-400/70 truncate hidden sm:block">— {item.error_message}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                    {(item.lead?.company_url || item.lead?.website_url) && (
                      <a
                        href={item.lead.contact_url || item.lead.company_url || item.lead.website_url || undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        フォームを開く
                      </a>
                    )}
                    <button
                      onClick={async () => {
                        const { error } = await markAsSent(item.id)
                        if (!error) {
                          setQueue(prev => prev.map(q =>
                            q.id === item.id ? { ...q, status: '送信済み' as const, sent_at: new Date().toISOString() } : q
                          ))
                        }
                      }}
                      className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-xs rounded-lg transition-colors"
                    >
                      送信済みにする
                    </button>
                    <button
                      onClick={async () => {
                        await retryQueueItem(item.id)
                        setQueue(prev => prev.map(q =>
                          q.id === item.id ? { ...q, status: '確認待ち' as const, error_message: null } : q
                        ))
                      }}
                      className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg transition-colors"
                    >
                      再試行
                    </button>
                  </div>
                </div>
              ))}
              {manualItems.length > 3 && (
                <button
                  onClick={() => setActiveTab('手動対応')}
                  className="w-full text-xs text-yellow-400/70 hover:text-yellow-300 py-1 transition-colors"
                >
                  他 {manualItems.length - 3} 件を表示...
                </button>
              )}
            </div>
          </div>
        )}

        {/* 手動対応タブ専用ビュー */}
        {activeTab === '手動対応' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              <p className="text-sm font-semibold text-yellow-300">手動対応が必要なアイテム</p>
              <span className="text-xs text-yellow-400/60 ml-auto">フォームを直接開いて送信してください</span>
            </div>
            {manualItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-500/50" />
                <p className="text-sm text-gray-500">手動対応が必要なアイテムはありません</p>
              </div>
            ) : (
              manualItems.map(item => (
                <div key={item.id} className="bg-gray-900 border border-yellow-500/20 rounded-2xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{item.lead?.company_name ?? '不明'}</p>
                      {item.error_message && (
                        <p className="text-xs text-yellow-400/80 mt-0.5">⚠️ {item.error_message}</p>
                      )}
                    </div>
                    <span className="flex-shrink-0 px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs rounded-full">手動対応</span>
                  </div>

                  {/* コピー可能なフィールド一覧 */}
                  <div className="bg-gray-950 border border-gray-800 rounded-xl p-3 space-y-2">
                    {item.subject && (
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-[10px] text-gray-500">件名</span>
                          <p className="text-xs text-gray-300 truncate">{item.subject}</p>
                        </div>
                        <button
                          onClick={() => { navigator.clipboard.writeText(item.subject || ''); }}
                          className="flex-shrink-0 px-2 py-1 text-[10px] bg-gray-800 hover:bg-gray-700 text-gray-400 rounded transition-colors"
                        >コピー</button>
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] text-gray-500">本文</span>
                        <p className="text-xs text-gray-400 whitespace-pre-wrap max-h-32 overflow-y-auto">{item.message_content}</p>
                      </div>
                      <button
                        onClick={() => { navigator.clipboard.writeText(item.message_content || ''); }}
                        className="flex-shrink-0 px-2 py-1 text-[10px] bg-gray-800 hover:bg-gray-700 text-gray-400 rounded transition-colors"
                      >コピー</button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {(item.lead?.company_url || item.lead?.website_url) && (
                      <a
                        href={item.lead.contact_url || item.lead.company_url || item.lead.website_url || undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-xl transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        フォームを開く
                      </a>
                    )}
                    <button
                      onClick={async () => {
                        const { error } = await markAsSent(item.id)
                        if (!error) {
                          setQueue(prev => prev.map(q =>
                            q.id === item.id ? { ...q, status: '送信済み' as const, sent_at: new Date().toISOString() } : q
                          ))
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-xl transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      送信済みにする
                    </button>
                    <button
                      onClick={async () => {
                        await retryQueueItem(item.id)
                        setQueue(prev => prev.map(q =>
                          q.id === item.id ? { ...q, status: '確認待ち' as const, error_message: null } : q
                        ))
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-xl transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      再試行
                    </button>
                    <button
                      onClick={async () => {
                        const { error } = await markAsUnsendable(item.id)
                        if (!error) {
                          setQueue(prev => prev.map(q =>
                            q.id === item.id ? { ...q, status: '送信不可' as const, error_message: '手動確認の結果、送信不可' } : q
                          ))
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 text-xs rounded-xl transition-colors"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      送信不可
                    </button>
                    <button
                      onClick={async () => {
                        await deleteQueueItem(item.id)
                        setQueue(prev => prev.filter(q => q.id !== item.id))
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs rounded-xl transition-colors ml-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      削除
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Queue list (手動対応タブでは非表示) */}
        {activeTab !== '手動対応' && (filteredQueue.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-16 h-16 bg-gray-900 border border-gray-800 rounded-2xl flex items-center justify-center">
              <InboxIcon className="w-8 h-8 text-gray-700" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-500">
                {activeTab === '全て'
                  ? '送信キューが空です'
                  : `「${activeTab}」のアイテムはありません`}
              </p>
              {activeTab === '全て' && (
                <p className="text-xs text-gray-600 mt-1">
                  「キューに追加」ボタンからリードと文面を選択して追加してください
                </p>
              )}
            </div>
            {activeTab === '全て' && (
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4" />
                キューに追加
              </button>
            )}
            {activeTab === '失敗' && stats.failed === 0 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-emerald-400">失敗はありません</span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {/* Bulk action bar */}
            <div className="flex items-center gap-2 px-2 py-2 bg-gray-900/50 border border-gray-800 rounded-xl">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                {selected.size === filteredQueue.length && filteredQueue.length > 0
                  ? <CheckSquare className="w-3.5 h-3.5 text-violet-400" />
                  : <Square className="w-3.5 h-3.5" />}
                全選択
              </button>

              {selected.size > 0 && (
                <>
                  <span className="text-xs text-gray-500">{selected.size}件選択</span>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <button
                      onClick={handleAutoSendAll}
                      disabled={isBulkProcessing}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      自動送信
                    </button>
                    <button
                      onClick={handleBulkSendAll}
                      disabled={isBulkProcessing}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Rocket className="w-3.5 h-3.5" />
                      手動確認
                    </button>
                    {/* 送信済みタブで選択中の場合：確認待ちに戻すボタン */}
                    {activeTab === '送信済み' && (
                      <button
                        onClick={handleBulkResetToReview}
                        disabled={isBulkProcessing}
                        title="誤って送信済みになったアイテムを確認待ちに戻して再送信できます"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-medium rounded-lg hover:bg-violet-500/20 transition-colors disabled:opacity-50"
                      >
                        確認待ちに戻す
                      </button>
                    )}
                    <button
                      onClick={() => handleBulkChangeSendMethod('manual')}
                      disabled={isBulkProcessing}
                      title="フォーム自動送信が失敗する場合、手動モードに切り替えて自分でフォームを送信できます"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium rounded-lg hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                    >
                      手動に切り替え
                    </button>
                    <button
                      onClick={handleBulkDelete}
                      disabled={isBulkProcessing}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      一括削除
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Bulk actions for 失敗 tab */}
            {activeTab === '失敗' && filteredQueue.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 bg-red-500/5 border border-red-500/20 rounded-xl">
                <p className="text-xs text-red-400">{filteredQueue.length}件の失敗があります</p>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      setIsBulkProcessing(true)
                      const failedItems = filteredQueue.filter(i => i.status === '失敗')
                      for (const item of failedItems) {
                        await retryQueueItem(item.id)
                        handleUpdated(item.id, '確認待ち')
                      }
                      setIsBulkProcessing(false)
                    }}
                    disabled={isBulkProcessing}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className="w-3 h-3" />
                    確認待ちに戻す
                  </button>
                  <button
                    onClick={() => {
                      const items = filteredQueue.filter(i => i.status === '失敗')
                      if (!items.length) return
                      setConfirmItem(items[0])
                      setConfirmQueue(items.slice(1))
                    }}
                    disabled={isBulkProcessing}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Rocket className="w-3 h-3" />
                    全て再送信
                  </button>
                </div>
              </div>
            )}

            {filteredQueue.map(item => (
              <div key={item.id} className="flex items-start gap-2">
                <button
                  onClick={() => toggleSelect(item.id)}
                  className="mt-4 flex-shrink-0 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {selected.has(item.id)
                    ? <CheckSquare className="w-4 h-4 text-violet-400" />
                    : <Square className="w-4 h-4" />}
                </button>
                <div className="flex-1 min-w-0">
                  <QueueItem
                    item={item}
                    onSendClick={setConfirmItem}
                    onDeleted={handleDeleted}
                    onUpdated={handleUpdated}
                  />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Send confirmation modal */}
      {confirmItem && (
        <SendConfirmModal
          key={confirmItem.id}
          item={confirmItem}
          onClose={() => { setConfirmItem(null); setConfirmQueue([]) }}
          onSkip={(id) => {
            // エラー時スキップ: 次のアイテムへ（一括送信を継続）
            if (confirmQueue.length > 0) {
              setConfirmItem(confirmQueue[0])
              setConfirmQueue(prev => prev.slice(1))
            } else {
              setConfirmItem(null)
            }
          }}
          remainingCount={confirmQueue.length}
          onSent={handleSent}
        />
      )}

      {/* Add to queue modal */}
      {showAddModal && (
        <AddToQueueModal
          leads={leads}
          messages={messages}
          onClose={() => setShowAddModal(false)}
          onAdded={handleAdded}
        />
      )}

      {/* 自動一括送信プログレスオーバーレイ */}
      {autoProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center gap-2">
              {autoProgress.done
                ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                : <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />}
              <h2 className="text-sm font-bold text-white">
                {autoProgress.done ? '自動送信完了' : '自動送信中...'}
              </h2>
            </div>

            {/* Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>
                  {autoProgress.done
                    ? `${autoProgress.completed}件処理完了`
                    : autoProgress.current
                      ? `処理中: ${autoProgress.current}`
                      : '準備中...'}
                </span>
                <span className="font-semibold text-white">{autoProgress.completed}/{autoProgress.total}</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(autoProgress.completed / autoProgress.total) * 100}%` }}
                />
              </div>
            </div>

            {/* Errors */}
            {autoProgress.errors.length > 0 && (
              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 space-y-1 max-h-32 overflow-y-auto">
                <p className="text-xs font-medium text-red-400">{autoProgress.errors.length}件でエラー:</p>
                {autoProgress.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-300/80">{e}</p>
                ))}
              </div>
            )}

            {/* Close button (only when done) */}
            {autoProgress.done && (
              <button
                onClick={() => setAutoProgress(null)}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                閉じる
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
