'use client'

import { useState } from 'react'
import { X, Trash2, AlertCircle } from 'lucide-react'
import { clsx } from 'clsx'
import type { Deal, DealInsert, DealStage } from '@/types/deals'
import { DEAL_STAGES, STAGE_CONFIG } from '@/types/deals'
import type { Lead, LeadOption } from '@/types/leads'
import { createDeal, updateDeal, deleteDeal } from '@/app/dashboard/deals/actions'

interface DealFormModalProps {
  deal?: Deal | null          // null = create mode, Deal = edit mode
  initialLead?: LeadOption | null   // pre-fill lead when creating from 返信管理
  leads: LeadOption[]
  onClose: () => void
  onSaved: (deal: Deal) => void
  onDeleted?: (id: string) => void
}

function formatAmountDisplay(val: string): string {
  const n = parseInt(val.replace(/,/g, ''), 10)
  if (isNaN(n)) return val
  return n.toLocaleString()
}

export default function DealFormModal({
  deal,
  initialLead,
  leads,
  onClose,
  onSaved,
  onDeleted,
}: DealFormModalProps) {
  const isEdit = !!deal

  // Form state
  const [stage, setStage] = useState<DealStage>(deal?.stage ?? '初回接触')
  const [companyName, setCompanyName] = useState(
    deal?.company_name ?? initialLead?.company_name ?? ''
  )
  const [contactName, setContactName] = useState(
    deal?.contact_name ?? initialLead?.contact_name ?? ''
  )
  const [leadId, setLeadId] = useState<string | null>(
    deal?.lead_id ?? initialLead?.id ?? null
  )
  const [amountStr, setAmountStr] = useState(deal?.amount?.toString() ?? '')
  const [probability, setProbability] = useState<number>(deal?.probability ?? 50)
  const [nextAction, setNextAction] = useState(deal?.next_action ?? '')
  const [nextActionDate, setNextActionDate] = useState(deal?.next_action_date ?? '')
  const [meetingDate, setMeetingDate] = useState(
    deal?.meeting_date ? deal.meeting_date.slice(0, 16) : ''
  )
  const [meetingUrl, setMeetingUrl] = useState(
    deal?.meeting_url ?? (isEdit ? '' : 'https://timerex.net/s/daichi_3022_c34c/a78a4d68')
  )
  const [notes, setNotes] = useState(deal?.notes ?? '')

  // UI state
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [leadSearch, setLeadSearch] = useState('')

  const parseAmount = (): number | null => {
    const raw = amountStr.replace(/,/g, '').trim()
    if (!raw) return null
    const n = parseInt(raw, 10)
    return isNaN(n) || n < 0 ? null : n
  }

  const handleSave = async () => {
    if (!companyName.trim()) {
      setError('会社名は必須です')
      return
    }
    setError(null)
    setSaving(true)

    const payload: DealInsert = {
      lead_id: leadId,
      company_name: companyName.trim(),
      contact_name: contactName.trim() || null,
      stage,
      amount: parseAmount(),
      probability,
      next_action: nextAction.trim() || null,
      next_action_date: nextActionDate || null,
      meeting_date: meetingDate ? new Date(meetingDate).toISOString() : null,
      meeting_url: meetingUrl.trim() || null,
      notes: notes.trim() || null,
    }

    if (isEdit && deal) {
      const { data, error: err } = await updateDeal(deal.id, payload)
      setSaving(false)
      if (err || !data) {
        setError(err ?? '更新に失敗しました')
        return
      }
      onSaved(data)
    } else {
      const { data, error: err } = await createDeal(payload)
      setSaving(false)
      if (err || !data) {
        setError(err ?? '作成に失敗しました')
        return
      }
      onSaved(data)
    }
  }

  const handleDelete = async () => {
    if (!deal) return
    setDeleting(true)
    const { error: err } = await deleteDeal(deal.id)
    setDeleting(false)
    if (err) {
      setError(err)
      setConfirmDelete(false)
      return
    }
    onDeleted?.(deal.id)
  }

  // Lead search dropdown
  const filteredLeads = leadSearch.trim()
    ? leads.filter(
        l =>
          l.company_name.toLowerCase().includes(leadSearch.toLowerCase()) ||
          (l.contact_name ?? '').toLowerCase().includes(leadSearch.toLowerCase())
      ).slice(0, 6)
    : []

  const selectedLead = leads.find(l => l.id === leadId) ?? null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
          <h2 className="text-lg font-semibold text-white">
            {isEdit ? '商談を編集' : '商談を追加'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Stage selector */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">ステージ</label>
            <div className="grid grid-cols-3 gap-2">
              {DEAL_STAGES.map(s => {
                const c = STAGE_CONFIG[s]
                const isSelected = stage === s
                return (
                  <button
                    key={s}
                    onClick={() => setStage(s)}
                    className={clsx(
                      'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all',
                      isSelected
                        ? [c.bg, c.color, c.border, 'ring-1', c.border.replace('border-', 'ring-')]
                        : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600'
                    )}
                  >
                    <span>{c.emoji}</span>
                    <span>{c.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Company name */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              会社名 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="株式会社〇〇"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          {/* Contact name */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">担当者名</label>
            <input
              type="text"
              value={contactName}
              onChange={e => setContactName(e.target.value)}
              placeholder="山田 太郎"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          {/* Lead link */}
          <div className="relative">
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              リンクするリード（任意）
            </label>
            {selectedLead ? (
              <div className="flex items-center justify-between bg-gray-800 border border-violet-500/40 rounded-lg px-3 py-2">
                <div>
                  <p className="text-sm text-white">{selectedLead.company_name}</p>
                  {selectedLead.contact_name && (
                    <p className="text-xs text-gray-400">{selectedLead.contact_name}</p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setLeadId(null)
                    setLeadSearch('')
                  }}
                  className="text-gray-500 hover:text-white transition-colors text-xs"
                >
                  解除
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={leadSearch}
                  onChange={e => setLeadSearch(e.target.value)}
                  placeholder="会社名・担当者名で検索"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors"
                />
                {filteredLeads.length > 0 && (
                  <div className="absolute top-full mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 overflow-hidden">
                    {filteredLeads.map(l => (
                      <button
                        key={l.id}
                        onClick={() => {
                          setLeadId(l.id)
                          setLeadSearch('')
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-700 transition-colors"
                      >
                        <p className="text-sm text-white">{l.company_name}</p>
                        {l.contact_name && (
                          <p className="text-xs text-gray-400">{l.contact_name}</p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Amount + Probability */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">金額（円）</label>
              <input
                type="text"
                inputMode="numeric"
                value={amountStr}
                onChange={e => {
                  const raw = e.target.value.replace(/[^0-9]/g, '')
                  setAmountStr(raw)
                }}
                onBlur={() => {
                  const raw = amountStr.replace(/,/g, '')
                  const n = parseInt(raw, 10)
                  if (!isNaN(n)) setAmountStr(formatAmountDisplay(raw))
                }}
                placeholder="1,000,000"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                確度: <span className="text-white font-semibold">{probability}%</span>
              </label>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={probability}
                onChange={e => setProbability(parseInt(e.target.value, 10))}
                className="w-full accent-violet-500 mt-2.5"
              />
            </div>
          </div>

          {/* Next action */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">次回アクション</label>
            <input
              type="text"
              value={nextAction}
              onChange={e => setNextAction(e.target.value)}
              placeholder="提案資料を送付する"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          {/* Next action date */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              次回アクション日
            </label>
            <input
              type="date"
              value={nextActionDate}
              onChange={e => setNextActionDate(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors [color-scheme:dark]"
            />
          </div>

          {/* Meeting date */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              ミーティング日時
            </label>
            <input
              type="datetime-local"
              value={meetingDate}
              onChange={e => setMeetingDate(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors [color-scheme:dark]"
            />
          </div>

          {/* Meeting URL */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              ミーティングURL
            </label>
            <input
              type="url"
              value={meetingUrl}
              onChange={e => setMeetingUrl(e.target.value)}
              placeholder="https://timerex.net/..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">メモ</label>
            <textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="商談の詳細メモ..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 shrink-0 flex items-center gap-3">
          {/* Delete (edit only) */}
          {isEdit && onDeleted && (
            <>
              {confirmDelete ? (
                <>
                  <span className="text-xs text-red-400 mr-auto">本当に削除しますか？</span>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-3 py-1.5 rounded-lg text-xs bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                  >
                    {deleting ? '削除中...' : '削除する'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="mr-auto p-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </>
          )}

          {!confirmDelete && (
            <>
              <button
                onClick={onClose}
                className="ml-auto px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50 transition-colors"
              >
                {saving ? '保存中...' : isEdit ? '更新する' : '追加する'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
