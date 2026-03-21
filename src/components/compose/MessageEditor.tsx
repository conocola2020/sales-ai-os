'use client'

import { Copy, Save, RefreshCw, Check, Loader2, Send } from 'lucide-react'
import clsx from 'clsx'

interface MessageEditorProps {
  subject?: string
  onSubjectChange?: (value: string) => void
  value: string
  onChange: (value: string) => void
  isStreaming: boolean
  isSaving: boolean
  onSave: () => void
  onCopy: () => void
  onRegenerate: () => void
  onAddToQueue?: () => void
  onSaveAndQueue?: () => void
  copied: boolean
  canRegenerate: boolean
}

export default function MessageEditor({
  subject = '',
  onSubjectChange,
  value,
  onChange,
  isStreaming,
  isSaving,
  onSave,
  onCopy,
  onRegenerate,
  onAddToQueue,
  onSaveAndQueue,
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
              ✨ HP分析＆生成中...
            </span>
          )}
        </label>
        {!isEmpty && (
          <span className="text-xs text-gray-600">
            {subject ? `件名 ${subject.length}字 / ` : ''}本文 {charCount.toLocaleString()}字
          </span>
        )}
      </div>

      {/* Subject input */}
      {onSubjectChange && (subject || value || isStreaming) && (
        <div className="mb-2">
          <input
            type="text"
            value={subject}
            onChange={e => onSubjectChange(e.target.value)}
            disabled={isStreaming}
            placeholder="件名"
            className={clsx(
              'w-full rounded-lg border px-3 py-2 text-sm font-medium transition-all',
              'bg-gray-800/80 text-white placeholder-gray-600',
              'focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent',
              isStreaming ? 'border-violet-500/50' : 'border-gray-700 hover:border-gray-600'
            )}
          />
        </div>
      )}

      {/* Body textarea */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={isStreaming}
          placeholder="リードを選択して「✨ 生成する」をクリックしてください"
          className={clsx(
            'w-full h-full min-h-[220px] resize-none rounded-xl border px-4 py-3.5 text-sm leading-relaxed transition-all overflow-y-auto',
            'bg-gray-800 text-white placeholder-gray-600',
            'focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent',
            isStreaming
              ? 'border-violet-500/50 bg-gray-800/80'
              : value
              ? 'border-gray-700 hover:border-gray-600'
              : 'border-gray-700/50'
          )}
        />
        {isStreaming && (
          <span className="inline-block w-0.5 h-4 bg-violet-400 animate-pulse absolute bottom-4 right-4" />
        )}
      </div>

      {/* Toolbar */}
      {(value || isStreaming) && (
        <div className="flex-shrink-0 flex items-center gap-2 mt-2.5 pt-2.5 border-t border-gray-800">
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

          {onAddToQueue && (
            <button
              onClick={onAddToQueue}
              disabled={isStreaming || !value}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-3.5 h-3.5" />
              キューに追加
            </button>
          )}

          <div className="flex-1" />

          <button
            onClick={onSave}
            disabled={isStreaming || isSaving || !value}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {isSaving ? '保存中...' : '保存のみ'}
          </button>

          {onSaveAndQueue && (
            <button
              onClick={onSaveAndQueue}
              disabled={isStreaming || isSaving || !value}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              {isSaving ? '処理中...' : '保存 & キュー追加'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
