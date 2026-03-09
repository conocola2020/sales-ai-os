'use client'

import { AlertCircle, RefreshCw } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-8">
      <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-red-400" />
      </div>
      <h2 className="text-lg font-semibold text-white mb-2">エラーが発生しました</h2>
      <p className="text-sm text-gray-400 mb-6 text-center max-w-md">
        {error.message || 'ページの読み込みに失敗しました。もう一度お試しください。'}
      </p>
      <button
        onClick={reset}
        className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
        再試行
      </button>
    </div>
  )
}
