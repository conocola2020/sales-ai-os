'use client'

import { useState, useMemo } from 'react'
import {
  Send,
  Clock,
  Eye,
  CheckCircle2,
  XCircle,
  InboxIcon,
  Plus,
  RefreshCw,
} from 'lucide-react'
import clsx from 'clsx'
import type { SendQueueItem, SendStats } from '@/types/sending'
import type { Lead } from '@/types/leads'
import type { Message } from '@/types/messages'
import StatsPanel from './StatsPanel'
import QueueItem from './QueueItem'
import SendConfirmModal from './SendConfirmModal'
import AddToQueueModal from './AddToQueueModal'

// ──────────────────────────────────────────
// Tab definitions
// ──────────────────────────────────────────
type Tab = '全て' | '待機中' | '確認待ち' | '送信済み' | '失敗'

const TABS: { label: Tab; icon: React.ReactNode; count?: (s: SendStats) => number }[] = [
  { label: '全て', icon: <Send className="w-3.5 h-3.5" />, count: s => s.total },
  { label: '待機中', icon: <Clock className="w-3.5 h-3.5" />, count: s => s.pending },
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
    pending: items.filter(i => i.status === '待機中').length,
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

  const stats = useMemo(() => buildStats(queue), [queue])

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

        {/* Stats panel */}
        <StatsPanel stats={stats} />

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.label}
              onClick={() => setActiveTab(tab.label)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
                activeTab === tab.label
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
              )}
            >
              {tab.icon}
              {tab.label}
              {tab.count && (
                <span
                  className={clsx(
                    'ml-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold',
                    activeTab === tab.label
                      ? 'bg-violet-500 text-white'
                      : 'bg-gray-800 text-gray-500'
                  )}
                >
                  {tab.count(stats)}
                </span>
              )}
            </button>
          ))}
        </div>

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
            {/* Bulk actions for 失敗 tab */}
            {activeTab === '失敗' && filteredQueue.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 bg-red-500/5 border border-red-500/20 rounded-xl">
                <p className="text-xs text-red-400">{filteredQueue.length}件の失敗があります</p>
                <button
                  onClick={() => {
                    filteredQueue.forEach(item => {
                      if (item.status === '失敗') handleUpdated(item.id, '待機中')
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
              <QueueItem
                key={item.id}
                item={item}
                onSendClick={setConfirmItem}
                onDeleted={handleDeleted}
                onUpdated={handleUpdated}
              />
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
