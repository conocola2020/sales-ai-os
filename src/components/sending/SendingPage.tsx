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
} from 'lucide-react'
import clsx from 'clsx'
import type { SendQueueItem, SendStats } from '@/types/sending'
import type { Lead } from '@/types/leads'
import type { Message } from '@/types/messages'
import StatsPanel from './StatsPanel'
import QueueItem from './QueueItem'
import SendConfirmModal from './SendConfirmModal'
import AddToQueueModal from './AddToQueueModal'
import { deleteQueueItem } from '@/app/dashboard/sending/actions'

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
  leads: Lead[]
  messages: Message[]
}

// ──────────────────────────────────────────
// Main component
// ──────────────────────────────────────────
export default function SendingPage({ initialQueue, leads, messages }: SendingPageProps) {
  const [queue, setQueue] = useState<SendQueueItem[]>(initialQueue)
  const [activeTab, setActiveTab] = useState<Tab>('全て')
  const [confirmItem, setConfirmItem] = useState<SendQueueItem | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isBulkProcessing, setIsBulkProcessing] = useState(false)

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
    // 選択した確認待ちアイテムを一括送信
    const reviewItems = filteredQueue.filter(i => i.status === '確認待ち' && selected.has(i.id))
    if (!reviewItems.length) return
    if (!confirm(`${reviewItems.length}件を送信しますか？`)) return
    reviewItems.forEach(item => setConfirmItem(item))
    setSelected(new Set())
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
      prev.map(item =>
        item.id === id
          ? { ...item, status: '送信済み', sent_at: new Date().toISOString() }
          : item
      )
    )
    setConfirmItem(null)
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
                      onClick={handleBulkSendAll}
                      disabled={isBulkProcessing}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Rocket className="w-3.5 h-3.5" />
                      一括送信
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
                <button
                  onClick={() => {
                    filteredQueue.forEach(item => {
                      if (item.status === '失敗') handleUpdated(item.id, '確認待ち')
                    })
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  全てリトライ
                </button>
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
          item={confirmItem}
          onClose={() => setConfirmItem(null)}
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
    </div>
  )
}
