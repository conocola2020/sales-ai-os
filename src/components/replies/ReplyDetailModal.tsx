'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  X,
  ExternalLink,
  Sparkles,
  Loader2,
  Copy,
  Check,
  Handshake,
  Pencil,
  ChevronDown,
  Trash2,
  RefreshCw,
  Mail,
} from 'lucide-react'
import clsx from 'clsx'
import type { Reply, Sentiment } from '@/types/replies'
import { SENTIMENT_CONFIG, SENTIMENTS } from '@/types/replies'
import {
  markAsRead,
  updateSentiment,
  saveAiResponse,
  deleteReply,
  linkReplyToLead,
} from '@/app/dashboard/replies/actions'
import { createDealFromReply } from '@/app/dashboard/deals/actions'
import type { Lead, LeadOption } from '@/types/leads'

interface ReplyDetailModalProps {
  reply: Reply
  leads?: LeadOption[]
  onClose: () => void
  onUpdated: (id: string, changes: Partial<Reply>) => void
  onDeleted: (id: string) => void
}

export default function ReplyDetailModal({
  reply,
  leads = [],
  onClose,
  onUpdated,
  onDeleted,
}: ReplyDetailModalProps) {
  const router = useRouter()
  const [aiResponse, setAiResponse] = useState(reply.ai_response ?? '')
  const [sentiment, setSentiment] = useState<Sentiment>(reply.sentiment)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSavingResponse, setIsSavingResponse] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [showSentimentMenu, setShowSentimentMenu] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isCreatingDeal, setIsCreatingDeal] = useState(false)
  const [dealCreated, setDealCreated] = useState(false)
  const [error, setError] = useState('')
  const [showLeadSelector, setShowLeadSelector] = useState(false)
  const [isLinking, setIsLinking] = useState(false)
  const [linkedLead, setLinkedLead] = useState(reply.lead ?? null)
  const [linkedLeadId, setLinkedLeadId] = useState(reply.lead_id ?? null)

  const cfg = SENTIMENT_CONFIG[sentiment]
  const lead = linkedLead

  // Mark as read on open (fire-and-forget)
  useEffect(() => {
    if (!reply.is_read) {
      markAsRead(reply.id).then(() => {
        onUpdated(reply.id, { is_read: true })
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reply.id])

  // ── AI response generation ──────────────────
  const handleGenerateResponse = async () => {
    setIsGenerating(true)
    setError('')
    try {
      const res = await fetch('/api/classify-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: reply.content,
          company_name: lead?.company_name,
          contact_name: lead?.contact_name,
        }),
      })
      const data = (await res.json()) as {
        sentiment?: Sentiment
        ai_response?: string
        error?: string
      }
      if (data.error) {
        setError(data.error)
        return
      }
      if (data.ai_response) setAiResponse(data.ai_response)
      if (data.sentiment) {
        setSentiment(data.sentiment)
        await updateSentiment(reply.id, data.sentiment)
        onUpdated(reply.id, { sentiment: data.sentiment })
      }
      // Save generated response
      if (data.ai_response) {
        setIsSavingResponse(true)
        await saveAiResponse(reply.id, data.ai_response)
        onUpdated(reply.id, { ai_response: data.ai_response })
        setIsSavingResponse(false)
      }
    } catch {
      setError('返信文案の生成に失敗しました')
    } finally {
      setIsGenerating(false)
    }
  }

  // ── Save edited AI response ──────────────────
  const handleSaveResponse = async () => {
    setIsSavingResponse(true)
    await saveAiResponse(reply.id, aiResponse)
    onUpdated(reply.id, { ai_response: aiResponse })
    setIsSavingResponse(false)
  }

  // ── Copy to clipboard ──────────────────────
  const handleCopy = async () => {
    await navigator.clipboard.writeText(aiResponse)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  // ── Update sentiment ───────────────────────
  const handleSentimentChange = async (s: Sentiment) => {
    setSentiment(s)
    setShowSentimentMenu(false)
    await updateSentiment(reply.id, s)
    onUpdated(reply.id, { sentiment: s })
  }

  // ── Delete ─────────────────────────────────
  const handleDelete = async () => {
    setIsDeleting(true)
    const { error: err } = await deleteReply(reply.id)
    setIsDeleting(false)
    if (!err) {
      onDeleted(reply.id)
      onClose()
    }
  }

  // ── Auto-match lead from reply content ─────
  const findMatchingLead = (): LeadOption | null => {
    if (leads.length === 0) return null

    // Extract sender email domain from content
    const emailMatch = reply.content.match(/【送信者】.*?<([^>]+)>/)
    const senderEmail = emailMatch?.[1] || ''
    const senderDomain = senderEmail.split('@')[1]?.toLowerCase() || ''

    // 1. Domain match (highest confidence)
    if (senderDomain) {
      const domainMatch = leads.find(l => {
        const leadEmailDomain = l.email?.split('@')[1]?.toLowerCase() || ''
        const leadWebDomain = l.website_url
          ?.replace(/^https?:\/\//, '')
          .replace(/^www\./, '')
          .split('/')[0]
          ?.toLowerCase() || ''
        return (
          (leadEmailDomain && senderDomain === leadEmailDomain) ||
          (leadWebDomain && senderDomain.includes(leadWebDomain)) ||
          (leadWebDomain && leadWebDomain.includes(senderDomain))
        )
      })
      if (domainMatch) return domainMatch
    }

    // 2. Company name match in content
    const content = reply.content
    const nameMatch = leads.find(l => {
      if (!l.company_name || l.company_name.length < 2) return false
      return content.includes(l.company_name)
    })
    if (nameMatch) return nameMatch

    return null
  }

  // ── Auto-link on button click ────────────────
  const handleAutoLink = async () => {
    const matched = findMatchingLead()
    if (matched) {
      await handleLinkLead(matched)
    } else {
      // No auto-match found, show manual selector
      setShowLeadSelector(true)
    }
  }

  // ── Link reply to a lead ───────────────────
  const handleLinkLead = async (selectedLead: LeadOption) => {
    setIsLinking(true)
    setError('')
    const { data, error: err } = await linkReplyToLead(reply.id, selectedLead.id)
    setIsLinking(false)
    if (err) {
      setError(err)
      return
    }
    setLinkedLead({
      company_name: selectedLead.company_name,
      contact_name: selectedLead.contact_name,
      email: selectedLead.email,
      website_url: selectedLead.website_url,
      industry: selectedLead.industry,
      status: selectedLead.status,
    })
    setLinkedLeadId(selectedLead.id)
    setShowLeadSelector(false)
    onUpdated(reply.id, { lead_id: selectedLead.id, lead: data?.lead })
  }

  // ── Open Gmail compose with AI response ────
  const handleOpenGmailCompose = () => {
    // Extract sender email from content header: 【送信者】名前 <email@example.com>
    const emailMatch = reply.content.match(/【送信者】.*?<([^>]+)>/)
    const toEmail = emailMatch?.[1] || lead?.email || ''

    // Extract subject from content header: 【件名】...
    const subjectMatch = reply.content.match(/【件名】(.+)/)
    const originalSubject = subjectMatch?.[1]?.trim() || 'お問い合わせについて'
    const subject = originalSubject.startsWith('Re:') ? originalSubject : `Re: ${originalSubject}`

    const params = new URLSearchParams({
      view: 'cm',
      to: toEmail,
      su: subject,
      body: aiResponse,
    })
    // Open Gmail compose for daichi@conocola.com (Google Workspace)
    window.open(`https://mail.google.com/a/conocola.com/?${params.toString()}`, '_blank')
  }

  // ── Create deal and go to deals ────────────
  const handleCreateDealAndGo = async () => {
    if (!linkedLeadId || !lead) return
    setIsCreatingDeal(true)
    setError('')
    const { data, error: err } = await createDealFromReply(
      linkedLeadId,
      lead.company_name ?? '不明',
      lead.contact_name,
      reply.content,
    )
    setIsCreatingDeal(false)
    if (err) {
      // 既に商談がある場合はそのまま遷移
      if (err.includes('既に存在')) {
        router.push(`/dashboard/deals?leadId=${linkedLeadId}`)
        onClose()
        return
      }
      setError(err)
      return
    }
    setDealCreated(true)
    // 少し待ってから遷移（ユーザーに成功を見せる）
    setTimeout(() => {
      router.push('/dashboard/deals')
      onClose()
    }, 800)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center text-sm font-bold text-gray-300 border border-gray-700 flex-shrink-0">
              {lead?.company_name?.charAt(0) ?? '?'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white truncate">
                  {lead?.company_name ?? '不明な会社'}
                </h2>
                {lead?.website_url && (
                  <a
                    href={lead.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-600 hover:text-gray-400 transition-colors flex-shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
              {lead?.contact_name && (
                <p className="text-xs text-gray-500">{lead.contact_name}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Delete */}
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  {isDeleting ? '削除中...' : '削除'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs rounded-lg transition-colors"
                >
                  キャンセル
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">

          {/* Sentiment + date row */}
          <div className="flex items-center justify-between gap-3">
            {/* Sentiment selector */}
            <div className="relative">
              <button
                onClick={() => setShowSentimentMenu(v => !v)}
                className={clsx(
                  'flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all',
                  cfg.bg,
                  cfg.border,
                  cfg.color
                )}
              >
                <span className={clsx('w-1.5 h-1.5 rounded-full', cfg.dot)} />
                {cfg.emoji} {cfg.label}
                <ChevronDown className="w-3 h-3" />
              </button>

              {showSentimentMenu && (
                <div className="absolute top-full left-0 mt-1 w-44 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-10 overflow-hidden">
                  {SENTIMENTS.map(s => {
                    const c = SENTIMENT_CONFIG[s]
                    return (
                      <button
                        key={s}
                        onClick={() => handleSentimentChange(s)}
                        className={clsx(
                          'w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors',
                          s === sentiment
                            ? clsx(c.bg, c.color, 'font-semibold')
                            : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                        )}
                      >
                        <span>{c.emoji}</span>
                        <span>{c.label}</span>
                        <span className="ml-auto text-[10px] text-gray-600">{c.description.slice(0, 10)}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">
                {new Date(reply.created_at).toLocaleString('ja-JP', {
                  year: 'numeric', month: 'short', day: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </span>
              {/* リード紐づけ or 商談作成ボタン */}
              {['興味あり', '検討中', '質問'].includes(sentiment) && (
                linkedLeadId ? (
                  <button
                    onClick={handleCreateDealAndGo}
                    disabled={isCreatingDeal || dealCreated}
                    className={clsx(
                      'flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-semibold rounded-lg transition-colors',
                      dealCreated
                        ? 'bg-emerald-600'
                        : 'bg-violet-600 hover:bg-violet-500'
                    )}
                  >
                    {isCreatingDeal ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : dealCreated ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Handshake className="w-3.5 h-3.5" />
                    )}
                    {isCreatingDeal ? '作成中...' : dealCreated ? '商談作成済み！' : '商談を作成'}
                  </button>
                ) : (
                  <div className="relative">
                    <button
                      onClick={handleAutoLink}
                      disabled={isLinking}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      {isLinking ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ExternalLink className="w-3.5 h-3.5" />
                      )}
                      リードに紐づけ
                    </button>
                    {showLeadSelector && (
                      <div className="absolute top-full right-0 mt-1 w-64 max-h-60 overflow-y-auto bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-20">
                        {leads.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-gray-500">リードがありません</p>
                        ) : (
                          leads.map(l => (
                            <button
                              key={l.id}
                              onClick={() => handleLinkLead(l)}
                              className="w-full flex flex-col px-3 py-2 text-left hover:bg-gray-800 transition-colors border-b border-gray-800 last:border-0"
                            >
                              <span className="text-xs font-semibold text-white">{l.company_name}</span>
                              {l.contact_name && (
                                <span className="text-[10px] text-gray-500">{l.contact_name}</span>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          </div>

          {/* Sentiment description */}
          <div className={clsx('flex items-center gap-2 px-3 py-2 rounded-lg border text-xs', cfg.bg, cfg.border, cfg.color)}>
            <span className="text-base">{cfg.emoji}</span>
            <span>{cfg.description}</span>
          </div>

          {/* Reply content */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              返信内容
            </h3>
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
              <pre className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed font-sans">
                {reply.content}
              </pre>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
              {error}
            </div>
          )}

          {/* AI response section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                AI 返信文案
              </h3>
              <div className="flex items-center gap-2">
                {aiResponse && (
                  <>
                    <button
                      onClick={handleOpenGmailCompose}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      Gmailで返信
                    </button>
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">コピー済み</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          コピー
                        </>
                      )}
                    </button>
                  </>
                )}
                <button
                  onClick={handleGenerateResponse}
                  disabled={isGenerating}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                    aiResponse
                      ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700'
                      : 'bg-violet-600 hover:bg-violet-500 text-white'
                  )}
                >
                  {isGenerating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : aiResponse ? (
                    <RefreshCw className="w-3.5 h-3.5" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  {isGenerating ? '生成中...' : aiResponse ? '再生成' : 'AIで生成'}
                </button>
              </div>
            </div>

            {aiResponse ? (
              <div className="space-y-2">
                <div className="relative">
                  <textarea
                    value={aiResponse}
                    onChange={e => setAiResponse(e.target.value)}
                    rows={6}
                    className="w-full bg-gray-800/60 border border-gray-700/50 rounded-xl px-4 py-3 text-sm text-gray-300 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent leading-relaxed"
                  />
                  <div className="absolute bottom-2 right-2 flex items-center gap-1 text-gray-600">
                    <Pencil className="w-3 h-3" />
                    <span className="text-[10px]">編集可</span>
                  </div>
                </div>
                {aiResponse !== (reply.ai_response ?? '') && (
                  <button
                    onClick={handleSaveResponse}
                    disabled={isSavingResponse}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    {isSavingResponse ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    変更を保存
                  </button>
                )}
              </div>
            ) : (
              <div
                onClick={handleGenerateResponse}
                className="flex flex-col items-center justify-center gap-3 py-8 bg-gray-800/30 border border-dashed border-gray-700 rounded-xl cursor-pointer hover:border-violet-500/50 hover:bg-violet-500/5 transition-all group"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
                    <p className="text-xs text-gray-500">AIが返信文案を生成しています...</p>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-6 h-6 text-gray-600 group-hover:text-violet-400 transition-colors" />
                    <p className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">
                      クリックしてAI返信文案を生成
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
