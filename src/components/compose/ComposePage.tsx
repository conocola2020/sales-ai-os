'use client'

import { useState, useCallback } from 'react'
import { Sparkles, Loader2, AlertCircle, Info } from 'lucide-react'
import LeadSelector from './LeadSelector'
import ToneSelector from './ToneSelector'
import MessageEditor from './MessageEditor'
import HistoryPanel from './HistoryPanel'
import { saveMessage } from '@/app/dashboard/compose/actions'
import type { Lead } from '@/types/leads'
import type { Message, Tone } from '@/types/messages'
import clsx from 'clsx'

interface ComposePageProps {
  leads: Lead[]
  initialMessages: Message[]
  isDemo: boolean
  initialLeadId?: string
}

export default function ComposePage({ leads, initialMessages, isDemo, initialLeadId = '' }: ComposePageProps) {
  const [selectedLeadId, setSelectedLeadId] = useState(initialLeadId)
  const [tone, setTone] = useState<Tone>('丁寧')
  const [customInstructions, setCustomInstructions] = useState('')
  const [generatedMessage, setGeneratedMessage] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [messages, setMessages] = useState<Message[]>(initialMessages)

  const selectedLead = leads.find(l => l.id === selectedLeadId) ?? null

  const handleGenerate = useCallback(async () => {
    if (!selectedLeadId) {
      setError('リードを選択してください')
      return
    }
    setError('')
    setIsStreaming(true)
    setGeneratedMessage('')

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: selectedLeadId, tone, customInstructions }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error ?? `HTTP ${res.status}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('ストリームの取得に失敗しました')

      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setGeneratedMessage(accumulated)
      }
    } catch (err) {
      console.error('Generate error:', err)
      setError(err instanceof Error ? err.message : '生成に失敗しました')
    } finally {
      setIsStreaming(false)
    }
  }, [selectedLeadId, tone, customInstructions])

  const handleSave = async () => {
    if (!generatedMessage) return
    setIsSaving(true)
    const { data, error: saveError } = await saveMessage({
      lead_id: selectedLeadId || null,
      content: generatedMessage,
      tone,
    })
    if (saveError) {
      setError(saveError)
    } else if (data) {
      setMessages(prev => [data, ...prev])
    }
    setIsSaving(false)
  }

  const handleCopy = () => {
    if (!generatedMessage) return
    navigator.clipboard.writeText(generatedMessage).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleSelectHistory = (content: string) => {
    setGeneratedMessage(content)
  }

  const handleDeleteHistory = (id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id))
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-white">文面生成AI</h1>
          <p className="text-xs text-gray-500 mt-0.5">Claude AIがリード情報を分析し、最適な営業メッセージを生成します</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-violet-500/10 border border-violet-500/20 rounded-lg text-xs font-medium text-violet-400">
            <Sparkles className="w-3 h-3" />
            claude-sonnet-4-6
          </span>
        </div>
      </div>

      {/* Demo / API key banner */}
      {isDemo && (
        <div className="mx-6 mt-4 flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
          <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-400">
            <span className="font-semibold">デモモード:</span> ANTHROPIC_API_KEY が未設定です。.env.local に設定するとリアルな生成が可能になります。現在はサンプル文面を表示します。
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-6 mt-4 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-xs text-red-400">{error}</p>
          <button onClick={() => setError('')} className="ml-auto text-red-500 hover:text-red-300 text-xs">✕</button>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 min-h-0 grid grid-cols-[1fr_320px] gap-0 overflow-hidden">

        {/* Left: Compose area */}
        <div className="flex flex-col overflow-y-auto p-6 space-y-5 border-r border-gray-800">

          {/* Lead Selector */}
          <LeadSelector
            leads={leads}
            selectedLeadId={selectedLeadId}
            onSelect={setSelectedLeadId}
          />

          {/* Tone Selector */}
          <ToneSelector value={tone} onChange={setTone} />

          {/* Custom instructions */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              追加指示 <span className="text-gray-600 font-normal">(任意)</span>
            </label>
            <textarea
              value={customInstructions}
              onChange={e => setCustomInstructions(e.target.value)}
              rows={2}
              placeholder="例: 製品の無料トライアルを強調して、決裁者向けの内容にしてください"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={isStreaming || !selectedLeadId}
            className={clsx(
              'flex items-center justify-center gap-2.5 w-full py-3 rounded-xl text-sm font-semibold transition-all',
              selectedLeadId && !isStreaming
                ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-900/30'
                : 'bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed'
            )}
          >
            {isStreaming ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {selectedLead
                  ? `「${selectedLead.company_name}」の文面を生成`
                  : '✨ 生成する'}
              </>
            )}
          </button>

          {/* Message editor */}
          <div className="flex flex-col flex-1 min-h-[220px]">
            <MessageEditor
              value={generatedMessage}
              onChange={setGeneratedMessage}
              isStreaming={isStreaming}
              isSaving={isSaving}
              onSave={handleSave}
              onCopy={handleCopy}
              onRegenerate={handleGenerate}
              copied={copied}
              canRegenerate={!!selectedLeadId}
            />
          </div>
        </div>

        {/* Right: History panel */}
        <div className="flex flex-col overflow-hidden p-5">
          <HistoryPanel
            messages={messages}
            onSelect={handleSelectHistory}
            onDeleted={handleDeleteHistory}
          />
        </div>
      </div>
    </div>
  )
}
