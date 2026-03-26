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
} from 'lucide-react'
import clsx from 'clsx'
import type { SendQueueItem, SendStats } from '@/types/sending'
import type { Lead, LeadOption } from '@/types/leads'
import type { Message } from '@/types/messages'
import StatsPanel from './StatsPanel'
import QueueItem from './QueueItem'
import SendConfirmModal from './SendConfirmModal'
import AddToQueueModal from './AddToQueueModal'
import { deleteQueueItem, retryQueueItem, markAsSent, changeSendMethod, resetToReview } from '@/app/dashboard/sending/actions'

// ──────────────────────────────────────────
// Tab definitions
// ──────────────────────────────────────────
type Tab = '全て' | '確認待ち' | '送信済み' | '失敗'

const TABS: { label: Tab; icon: React.ReactNode; count?: (s: SendStats) => number }[] = [
  { label: '全て', icon: <Send className="w-3.5 h-3.5" />, count: s => s.total },
  { label: '確認待ち', icon: <Eye className="w-3.5 h-3.5" />, count: s => s.reviewing },
  { label: '送信済み', icon: <CheckCircle2 className="w-3.5 h-3.5" />, count: s => s.sent },
  { label: '失敗', icon: <XCircle className="w-3.5 h-3.5" />, count: s => s.failed },
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
    () =>
      activeTab === '全て' ? queue : queue.filter(i => i.status === activeTab),
    [queue, activeTab]
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

        {/* Queue list */}
        {filteredQueue.length === 0 ? (
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
        )}
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
