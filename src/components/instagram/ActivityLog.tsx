'use client'

import { useEffect, useState } from 'react'
import type { InstagramActivityLog } from '@/types/instagram-safety'
import { getRecentActivityLog } from '@/app/dashboard/instagram/actions'
import { Activity } from 'lucide-react'

interface ActivityLogProps {
  refreshKey: number
}

const ACTION_LABEL: Record<string, string> = {
  dm_sent: 'DM送信',
  like: 'いいね',
  follow: 'フォロー',
}

export default function ActivityLog({ refreshKey }: ActivityLogProps) {
  const [logs, setLogs] = useState<InstagramActivityLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getRecentActivityLog(20).then(({ data }) => {
      setLogs(data)
      setLoading(false)
    })
  }, [refreshKey])

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200">
        <Activity className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-semibold text-gray-700">アクティビティログ</span>
      </div>

      {loading ? (
        <div className="px-4 py-6 text-center text-sm text-gray-400">読み込み中...</div>
      ) : logs.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-gray-400">
          アクティビティがありません
        </div>
      ) : (
        <ul className="divide-y divide-gray-200">
          {logs.map(log => (
            <li key={log.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-xs px-2 py-0.5 bg-gray-50 rounded-md text-gray-400">
                  {ACTION_LABEL[log.action_type] ?? log.action_type}
                </span>
                {log.target_username && (
                  <span className="text-sm text-gray-700">@{log.target_username}</span>
                )}
              </div>
              <span className="text-xs text-gray-400">
                {new Date(log.created_at).toLocaleString('ja-JP', {
                  month: 'numeric',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
