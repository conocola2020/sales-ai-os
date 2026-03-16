'use client'

import { useState, useCallback, useRef } from 'react'
import { Sparkles, Loader2, AlertCircle, Info, Users, User } from 'lucide-react'
import LeadSelector from './LeadSelector'
import ToneSelector from './ToneSelector'
import TemplateSelector from './TemplateSelector'
import MessageEditor from './MessageEditor'
import HistoryPanel from './HistoryPanel'
import BulkGeneratePanel from './BulkGeneratePanel'
import { saveMessage } from '@/app/dashboard/compose/actions'
import { addToQueue } from '@/app/dashboard/sending/actions'
import { parseSubjectAndBody } from '@/lib/prompt-builder'
import type { Lead } from '@/types/leads'
import type { Message, Tone } from '@/types/messages'
import type { MessageTemplate } from '@/types/settings'
import clsx from 'clsx'

type Mode = 'single' | 'bulk'

interface ComposePageProps {
  leads: Lead[]
  initialMessages: Message[]
  isDemo: boolean
  initialLeadId?: string
  templates: MessageTemplate[]
}

export default function ComposePage({
  leads,
  initialMessages,
  isDemo,
  initialLeadId = '',
  templates,
}: ComposePageProps) {
  const [mode, setMode] = useState<Mode>('single')
  const [selectedLeadId, setSelectedLeadId] = useState(initialLeadId)
  const [tone, setTone] = useState<Tone>('丁寧')
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    templates.find(t => t.is_default)?.id ?? templates[0]?.id ?? ''
  )
  const [customInstructions, setCustomInstructions] = useState('')
  const [generatedSubject, setGeneratedSubject] = useState('')
  const [generatedMessage, setGeneratedMessage] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const subjectParsedRef = useRef(false)

  const selectedLead = leads.find(l => l.id === selectedLeadId) ?? null

  const parseStreamingText = useCallback((text: string) => {
    const { subject, body } = parseSubjectAndBody(text)
    if (subject) {
      setGeneratedSubject(subject)
      setGeneratedMessage(body)
      subjectParsedRef.current = true
    } else if (!subjectParsedRef.current) {
      setGeneratedMessage(text)
    } else {
      setGeneratedMessage(body)
    }
  }, [])

  const handleGenerate = useCallback(async () => {
    if (!selectedLeadId) {
      setError('リードを選択してください')
      return
    }
    setError('')
    setIsStreaming(true)
    setGeneratedMessage('')
    setGeneratedSubject('')
    subjectParsedRef.current = false

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: selectedLeadId,
          tone,
          customInstructions,
          templateId: selectedTemplateId || undefined,
        }),
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
        parseStreamingText(accumulated)
      }
    } catch (err) {
      console.error('Generate error:', err)
      setError(err instanceof Error ? err.message : '生成に失敗しました')
    } finally {
      setIsStreaming(false)
    }
  }, [selectedLeadId, tone, customInstructions, selectedTemplateId, parseStreamingText])

  const handleSave = async () => {
    if (!generatedMessage) return
    setIsSaving(true)
    const { data, error: saveError } = await saveMessage({
      lead_id: selectedLeadId || null,
      subject: generatedSubject || null,
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
    const fullText = generatedSubject
      ? `件名：${generatedSubject}\n\n${generatedMessage}`
      : generatedMessage
    navigator.clipboard.writeText(fullText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleAddToQueue = async () => {
    if (!generatedMessage || !selectedLeadId) return
    const { error: queueError } = await addToQueue({
      lead_id: selectedLeadId,
      message_content: generatedMessage,
      subject: generatedSubject || undefined,
    })
    if (queueError) {
      setError(queueError)
    } else {
      setError('')
      const origMsg = generatedMessage
      setGeneratedMessage('✅ 送信キューに追加しました！')
      setTimeout(() => setGeneratedMessage(origMsg), 2000)
    }
  }

  const handleSelectHistory = (content: string) => {
    const { subject, body } = parseSubjectAndBody(content)
    setGeneratedSubject(subject)
    setGeneratedMessage(body || content)
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
          <p className="text-xs text-gray-500 mt-0.5">
            HP分析 + 弊社情報をもとに、パーソナライズされた営業メッセージを生成
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Mode toggle */}
          <div className="flex items-center bg-gray-800 rounded-lg border border-gray-700 p-0.5">
            <button
              onClick={() => setMode('single')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                mode === 'single' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'
              )}
            >
              <User className="w-3 h-3" />
              単一生成
            </button>
            <button
              onClick={() => setMode('bulk')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                mode === 'bulk' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'
              )}
            >
              <Users className="w-3 h-3" />
              一括生成
            </button>
          </div>
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-violet-500/10 border border-violet-500/20 rounded-lg text-xs font-medium text-violet-400">
            <Sparkles className="w-3 h-3" />
            claude-sonnet-4-6
          </span>
        </div>
      </div>

      {/* Banners */}
      {isDemo && (
        <div className="mx-6 mt-4 flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
          <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-400">
            <span className="font-semibold">デモモード:</span> ANTHROPIC_API_KEY が未設定です。
          </p>
        </div>
      )}
      {error && (
        <div className="mx-6 mt-4 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-xs text-red-400">{error}</p>
          <button onClick={() => setError('')} className="ml-auto text-red-500 hover:text-red-300 text-xs">✕</button>
        </div>
      )}

      {/* Mode content */}
      {mode === 'bulk' ? (
        <BulkGeneratePanel
          leads={leads}
          templates={templates}
          tone={tone}
          onToneChange={setTone}
          selectedTemplateId={selectedTemplateId}
          onTemplateChange={setSelectedTemplateId}
        />
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-[1fr_320px] gap-0 overflow-hidden">
          <div className="flex flex-col overflow-y-auto p-6 space-y-5 border-r border-gray-800">
            <LeadSelector leads={leads} selectedLeadId={selectedLeadId} onSelect={setSelectedLeadId} />
            <TemplateSelector templates={templates} selectedId={selectedTemplateId} onChange={setSelectedTemplateId} />
            <ToneSelector value={tone} onChange={setTone} />

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
                <><Loader2 className="w-4 h-4 animate-spin" />HP分析＆生成中...</>
              ) : (
                <><Sparkles className="w-4 h-4" />{selectedLead ? `「${selectedLead.company_name}」の文面を生成` : '✨ 生成する'}</>
              )}
            </button>

            <div className="flex flex-col flex-1 min-h-[220px]">
              <MessageEditor
                subject={generatedSubject}
                onSubjectChange={setGeneratedSubject}
                value={generatedMessage}
                onChange={setGeneratedMessage}
                isStreaming={isStreaming}
                isSaving={isSaving}
                onSave={handleSave}
                onCopy={handleCopy}
                onRegenerate={handleGenerate}
                onAddToQueue={selectedLeadId ? handleAddToQueue : undefined}
                copied={copied}
                canRegenerate={!!selectedLeadId}
              />
            </div>
          </div>

          <div className="flex flex-col overflow-hidden p-5">
            <HistoryPanel messages={messages} onSelect={handleSelectHistory} onDeleted={handleDeleteHistory} />
          </div>
        </div>
      )}
    </div>
  )
}
