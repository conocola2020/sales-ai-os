'use client'

import { useState, useMemo } from 'react'
import { Plus, MailOpen, RefreshCw } from 'lucide-react'
import type { Reply, Sentiment, ReplyStats } from '@/types/replies'
import { SENTIMENTS, SENTIMENT_CONFIG } from '@/types/replies'
import type { Lead, LeadOption } from '@/types/leads'
import { markAllAsRead } from '@/app/dashboard/replies/actions'
import ReplyCard from './ReplyCard'
import ReplyDetailModal from './ReplyDetailModal'
import AddReplyModal from './AddReplyModal'
import clsx from 'clsx'

interface RepliesPageProps {
  initialReplies: Reply[]
  leads: LeadOption[]
  sentLeadIds?: string[]
}

type Tab = '全て' | '未読' | Sentiment

function buildStats(replies: Reply[]): ReplyStats {
  return {
    total: replies.length,
    unread: replies.filter(r => !r.is_read).length,
    interested: replies.filter(r => r.sentiment === '興味あり').length,
    considering: replies.filter(r => r.sentiment === '検討中').length,
    declined: replies.filter(r => r.sentiment === 'お断り').length,
    questions: replies.filter(r => r.sentiment === '質問').length,
    other: replies.filter(r => r.sentiment === 'その他').length,
  }
}

const TABS: { label: Tab; getCount: (s: ReplyStats) => number }[] = [
  { label: '全て', getCount: s => s.total },
  { label: '未読', getCount: s => s.unread },
  { label: '興味あり', getCount: s => s.interested },
  { label: '検討中', getCount: s => s.considering },
  { label: 'お断り', getCount: s => s.declined },
  { label: '質問', getCount: s => s.questions },
  { label: 'その他', getCount: s => s.other },
]

export default function RepliesPage({ initialReplies, leads, sentLeadIds = [] }: RepliesPageProps) {
  const [replies, setReplies] = useState<Reply[]>(initialReplies)
  const [activeTab, setActiveTab] = useState<Tab>('全て')
  const [selectedReply, setSelectedReply] = useState<Reply | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false)

  const stats = useMemo(() => buildStats(replies), [replies])

  const filteredReplies = useMemo(() => {
    let list = replies
    if (activeTab === '未読') {
      list = list.filter(r => !r.is_read)
    } else if (activeTab !== '全て') {
      list = list.filter(r => r.sentiment === activeTab)
    }
    // Sort: unread first, then by created_at desc
    return [...list].sort((a, b) => {
      if (a.is_read !== b.is_read) return a.is_read ? 1 : -1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [replies, activeTab])

  const handleUpdated = (id: string, changes: Partial<Reply>) => {
    setReplies(prev =>
      prev.map(r => (r.id === id ? { ...r, ...changes } : r))
    )
    // If the modal's reply was updated, update it too
    setSelectedReply(prev =>
      prev && prev.id === id ? { ...prev, ...changes } : prev
    )
  }

  const handleDeleted = (id: string) => {
    setReplies(prev => prev.filter(r => r.id !== id))
    setSelectedReply(null)
  }

  const handleAdded = (reply: Reply) => {
    setReplies(prev => [reply, ...prev])
    setShowAddModal(false)
    setSelectedReply(reply)
  }

  const handleMarkAllRead = async () => {
    setIsMarkingAllRead(true)
    await markAllAsRead()
    setReplies(prev => prev.map(r => ({ ...r, is_read: true })))
    setIsMarkingAllRead(false)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">返信管理</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {stats.total}件の返信 · 未読 {stats.unread}件
          </p>
        </div>
        <div className="flex items-center gap-2">
          {stats.unread > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={isMarkingAllRead}
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-400 hover:text-gray-200 bg-gray-800 hover:bg-gray-750 border border-gray-700 rounded-lg transition-colors"
            >
              {isMarkingAllRead ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <MailOpen className="w-3.5 h-3.5" />
              )}
              全て既読にする
            </button>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            返信を追加
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <StatCard label="合計" value={stats.total} color="text-gray-300" bg="bg-gray-800/60" />
        <StatCard label="未読" value={stats.unread} color="text-violet-400" bg="bg-violet-500/10 border border-violet-500/20" />
        <StatCard label="興味あり" value={stats.interested} color="text-emerald-400" bg="bg-emerald-500/10 border border-emerald-500/20" />
        <StatCard label="お断り" value={stats.declined} color="text-red-400" bg="bg-red-500/10 border border-red-500/20" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 mb-4 scrollbar-hide flex-shrink-0">
        {TABS.map(tab => {
          const count = tab.getCount(stats)
          const isActive = activeTab === tab.label
          const cfg = SENTIMENTS.includes(tab.label as Sentiment)
            ? SENTIMENT_CONFIG[tab.label as Sentiment]
            : null
          return (
            <button
              key={tab.label}
              onClick={() => setActiveTab(tab.label)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0',
                isActive
                  ? 'bg-violet-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-750'
              )}
            >
              {cfg && <span>{cfg.emoji}</span>}
              {tab.label}
              {count > 0 && (
                <span
                  className={clsx(
                    'px-1.5 py-0.5 rounded-full text-[10px] font-semibold',
                    isActive ? 'bg-white/20 text-white' : 'bg-gray-700 text-gray-400'
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Reply list */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {filteredReplies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mb-4">
              <MailOpen className="w-8 h-8 text-gray-600" />
            </div>
            <p className="text-sm font-medium text-gray-400">
              {activeTab === '全て' ? '返信がありません' : `${activeTab}の返信はありません`}
            </p>
            {activeTab === '全て' && (
              <p className="mt-3 text-xs text-gray-600">
                Gmailから自動で取り込まれます
              </p>
            )}
          </div>
        ) : (
          filteredReplies.map(reply => (
            <ReplyCard
              key={reply.id}
              reply={reply}
              onClick={r => setSelectedReply(r)}
            />
          ))
        )}
      </div>

      {/* Detail modal */}
      {selectedReply && (
        <ReplyDetailModal
          reply={selectedReply}
          leads={leads}
          onClose={() => setSelectedReply(null)}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      )}

      {/* Add modal */}
      {showAddModal && (
        <AddReplyModal
          leads={leads}
          sentLeadIds={sentLeadIds}
          onClose={() => setShowAddModal(false)}
          onAdded={handleAdded}
        />
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  color,
  bg,
}: {
  label: string
  value: number
  color: string
  bg: string
}) {
  return (
    <div className={clsx('rounded-xl px-4 py-3', bg)}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={clsx('text-2xl font-bold', color)}>{value}</p>
    </div>
  )
}
