'use client'

import { Copy, Save, RefreshCw, Check, Loader2 } from 'lucide-react'
import clsx from 'clsx'

interface MessageEditorProps {
  value: string
  onChange: (value: string) => void
  isStreaming: boolean
  isSaving: boolean
  onSave: () => void
  onCopy: () => void
  onRegenerate: () => void
  copied: boolean
  canRegenerate: boolean
}

export default function MessageEditor({
  value,
  onChange,
  isStreaming,
  isSaving,
  onSave,
  onCopy,
  onRegenerate,
  copied,
  canRegenerate,
}: MessageEditorProps) {
  const charCount = value.length
  const isEmpty = !value && !isStreaming

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-gray-400">
          生成メッセージ
          {isStreaming && (
            <span className="ml-2 text-violet-400 text-xs font-normal animate-pulse">
              ✨ 生成中...
            </span>
          )}
        </label>
        {!isEmpty && (
          <span className="text-xs text-gray-600">{charCount.toLocaleString()} 文字</span>
        )}
      </div>

      <div className="relative flex-1 min-h-0">
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={isStreaming}
          placeholder="リードを選択して「✨ 生成する」をクリックしてください"
          className={clsx(
            'w-full h-full min-h-[220px] resize-none rounded-xl border px-4 py-3.5 text-sm leading-relaxed transition-all',
            'bg-gray-800 text-white placeholder-gray-600',
            'focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent',
            isStreaming
              ? 'border-violet-500/50 bg-gray-800/80'
              : value
              ? 'border-gray-700 hover:border-gray-600'
              : 'border-gray-700/50'
          )}
        />
        {/* Streaming cursor */}
        {isStreaming && (
          <span className="inline-block w-0.5 h-4 bg-violet-400 animate-pulse absolute bottom-4 right-4" />
        )}
      </div>

      {/* Toolbar */}
      {(value || isStreaming) && (
        <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-gray-800">
          <button
            onClick={onCopy}
            disabled={isStreaming || !value}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
              copied
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed'
            )}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'コピー済み' : 'コピー'}
          </button>

          <button
            onClick={onRegenerate}
            disabled={isStreaming || !canRegenerate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RefreshCw className={clsx('w-3.5 h-3.5', isStreaming && 'animate-spin')} />
            再生成
          </button>

          <div className="flex-1" />

          <button
            onClick={onSave}
            disabled={isStreaming || isSaving || !value}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {isSaving ? '保存中...' : '保存'}
          </button>
        </div>
      )}
    </div>
  )
}
