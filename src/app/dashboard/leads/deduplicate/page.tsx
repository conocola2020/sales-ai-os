'use client'

import { useState } from 'react'
import { Loader2, Trash2, CheckCircle2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function DeduplicatePage() {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const handleDeduplicate = async () => {
    if (!confirm('重複リードを削除します。会社名が同じリードは1件のみ残し、他を削除します。よろしいですか？')) return
    setStatus('running')
    setError('')
    try {
      const res = await fetch('/api/leads/deduplicate', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'エラーが発生しました')
        setStatus('error')
        return
      }
      setResult(data)
      setStatus('done')
    } catch (e: any) {
      setError(e.message)
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-md w-full text-center space-y-6">
        <h1 className="text-xl font-bold text-white">重複リード削除</h1>
        <p className="text-sm text-gray-400">
          会社名が同じリードの重複を削除し、各会社1件のみ残します。
        </p>

        {status === 'idle' && (
          <button
            onClick={handleDeduplicate}
            className="flex items-center gap-2 mx-auto px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl transition-colors"
          >
            <Trash2 className="w-5 h-5" />
            重複を削除する
          </button>
        )}

        {status === 'running' && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
            <p className="text-sm text-gray-300">重複を検出・削除中...</p>
            <p className="text-xs text-gray-500">30,000件以上あるため数分かかる場合があります</p>
          </div>
        )}

        {status === 'done' && result && (
          <div className="space-y-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">処理前</span>
                <span className="text-white font-medium">{result.total?.toLocaleString()}件</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">ユニーク（残存）</span>
                <span className="text-emerald-400 font-medium">{result.unique?.toLocaleString()}件</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">削除済み</span>
                <span className="text-red-400 font-medium">{result.deleted?.toLocaleString()}件</span>
              </div>
            </div>
            <Link
              href="/dashboard/leads"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              リード一覧に戻る
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <p className="text-red-400 text-sm">{error}</p>
            <button
              onClick={() => setStatus('idle')}
              className="px-5 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors"
            >
              やり直す
            </button>
          </div>
        )}

        {status === 'idle' && (
          <Link href="/dashboard/leads" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
            ← リード一覧に戻る
          </Link>
        )}
      </div>
    </div>
  )
}
