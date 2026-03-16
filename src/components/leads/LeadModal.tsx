'use client'

import { useState, useTransition } from 'react'
import {
  X, Building2, User, Mail, Phone, Globe, Briefcase,
  FileText, Save, Trash2, ExternalLink, Loader2, AlertCircle
} from 'lucide-react'
import { updateLead, deleteLead } from '@/app/dashboard/leads/actions'
import StatusBadge from './StatusBadge'
import type { Lead, LeadStatus } from '@/types/leads'
import { LEAD_STATUSES, INDUSTRIES, STATUS_CONFIG } from '@/types/leads'
import clsx from 'clsx'

interface LeadModalProps {
  lead: Lead
  onClose: () => void
  onUpdated: (updated: Lead) => void
  onDeleted: (id: string) => void
}

interface FieldProps {
  label: string
  icon: React.ReactNode
  children: React.ReactNode
}

function Field({ label, icon, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
        <span className="text-gray-500">{icon}</span>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputCls = 'w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all'

export default function LeadModal({ lead, onClose, onUpdated, onDeleted }: LeadModalProps) {
  const [form, setForm] = useState<Lead>({ ...lead })
  const [error, setError] = useState('')
  const [showDelete, setShowDelete] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isDeleting, startDelete] = useTransition()

  const set = (field: keyof Lead, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const isDirty = JSON.stringify(form) !== JSON.stringify(lead)

  const handleSave = () => {
    if (!form.company_name.trim()) { setError('会社名は必須です'); return }
    setError('')
    startTransition(async () => {
      const { error } = await updateLead(lead.id, {
        company_name: form.company_name,
        contact_name: form.contact_name,
        email: form.email,
        phone: form.phone,
        website_url: form.website_url,
        company_url: form.company_url,
        industry: form.industry,
        status: form.status,
        notes: form.notes,
      })
      if (error) { setError(error); return }
      onUpdated(form)
    })
  }

  const handleDelete = () => {
    startDelete(async () => {
      const { error } = await deleteLead(lead.id)
      if (error) { setError(error); return }
      onDeleted(lead.id)
    })
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">{form.company_name[0]}</span>
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-white truncate">{lead.company_name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <StatusBadge status={lead.status} size="sm" />
                {lead.industry && (
                  <span className="text-xs text-gray-500">{lead.industry}</span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors ml-3 flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Status */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-400">ステータス</label>
            <div className="flex flex-wrap gap-2">
              {LEAD_STATUSES.map((s) => {
                const cfg = STATUS_CONFIG[s]
                const active = form.status === s
                return (
                  <button
                    key={s}
                    onClick={() => set('status', s)}
                    className={clsx(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all',
                      active
                        ? `${cfg.bg} ${cfg.border} ${cfg.color} ring-1 ring-offset-0 ring-offset-transparent`
                        : 'bg-gray-800/50 border-gray-700/50 text-gray-500 hover:border-gray-600 hover:text-gray-300'
                    )}
                  >
                    <span className={clsx('w-1.5 h-1.5 rounded-full', active ? cfg.dot : 'bg-gray-600')} />
                    {s}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="会社名 *" icon={<Building2 className="w-3 h-3" />}>
              <input
                value={form.company_name}
                onChange={(e) => set('company_name', e.target.value)}
                className={inputCls}
                placeholder="株式会社サンプル"
              />
            </Field>

            <Field label="担当者名" icon={<User className="w-3 h-3" />}>
              <input
                value={form.contact_name ?? ''}
                onChange={(e) => set('contact_name', e.target.value)}
                className={inputCls}
                placeholder="山田 太郎"
              />
            </Field>

            <Field label="メールアドレス" icon={<Mail className="w-3 h-3" />}>
              <input
                type="email"
                value={form.email ?? ''}
                onChange={(e) => set('email', e.target.value)}
                className={inputCls}
                placeholder="info@example.com"
              />
            </Field>

            <Field label="電話番号" icon={<Phone className="w-3 h-3" />}>
              <input
                value={form.phone ?? ''}
                onChange={(e) => set('phone', e.target.value)}
                className={inputCls}
                placeholder="03-1234-5678"
              />
            </Field>
          </div>

          <Field label="掲載URL（サウナイキタイ等）" icon={<Globe className="w-3 h-3" />}>
            <div className="flex gap-2">
              <input
                value={form.website_url ?? ''}
                onChange={(e) => set('website_url', e.target.value)}
                className={inputCls}
                placeholder="https://sauna-ikitai.com/saunas/..."
              />
              {form.website_url && (
                <a
                  href={form.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 w-10 flex items-center justify-center bg-gray-800 border border-gray-700 rounded-xl hover:bg-gray-700 transition-colors"
                >
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </a>
              )}
            </div>
          </Field>

          <Field label="企業HP URL（フォーム送信先）" icon={<Building2 className="w-3 h-3" />}>
            <div className="flex gap-2">
              <input
                value={form.company_url ?? ''}
                onChange={(e) => set('company_url', e.target.value)}
                className={inputCls}
                placeholder="https://company-example.com"
              />
              {form.company_url && (
                <a
                  href={form.company_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 w-10 flex items-center justify-center bg-gray-800 border border-gray-700 rounded-xl hover:bg-gray-700 transition-colors"
                >
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </a>
              )}
            </div>
          </Field>

          <Field label="業種" icon={<Briefcase className="w-3 h-3" />}>
            <select
              value={form.industry ?? ''}
              onChange={(e) => set('industry', e.target.value)}
              className={clsx(inputCls, 'cursor-pointer')}
            >
              <option value="">選択してください</option>
              {INDUSTRIES.map((ind) => (
                <option key={ind} value={ind}>{ind}</option>
              ))}
            </select>
          </Field>

          <Field label="メモ" icon={<FileText className="w-3 h-3" />}>
            <textarea
              value={form.notes ?? ''}
              onChange={(e) => set('notes', e.target.value)}
              rows={3}
              className={clsx(inputCls, 'resize-none')}
              placeholder="自由記入欄..."
            />
          </Field>

          {/* Metadata */}
          <div className="pt-2 border-t border-gray-800">
            <p className="text-xs text-gray-600">
              登録: {new Date(lead.created_at).toLocaleDateString('ja-JP')} ／
              更新: {new Date(lead.updated_at).toLocaleDateString('ja-JP')}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-800">
          {showDelete ? (
            <div className="flex items-center gap-2 flex-1">
              <p className="text-xs text-red-400 flex-1">本当に削除しますか？</p>
              <button
                onClick={() => setShowDelete(false)}
                className="px-3 py-1.5 text-xs text-gray-400 border border-gray-700 rounded-lg hover:border-gray-600 transition-colors"
              >
                戻る
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg hover:bg-red-500/20 transition-colors"
              >
                {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                削除する
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDelete(true)}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              削除
            </button>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 border border-gray-700 rounded-xl transition-colors"
            >
              閉じる
            </button>
            <button
              onClick={handleSave}
              disabled={!isDirty || isPending}
              className="flex items-center gap-2 px-5 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
