'use client'

import { useState, useMemo, useTransition } from 'react'
import {
  Search, Filter, ChevronUp, ChevronDown, ChevronsUpDown,
  Upload, Download, Plus, Trash2, ExternalLink, Loader2,
  Building2, CheckSquare, Square, Globe, Mail, Phone
} from 'lucide-react'
import StatusBadge from './StatusBadge'
import LeadModal from './LeadModal'
import CSVImport from './CSVImport'
import { updateLeadStatus, deleteLeads, createLead } from '@/app/dashboard/leads/actions'
import type { Lead, LeadStatus } from '@/types/leads'
import { LEAD_STATUSES, INDUSTRIES, STATUS_CONFIG } from '@/types/leads'
import clsx from 'clsx'

type SortField = 'company_name' | 'industry' | 'status' | 'created_at'
type SortDir = 'asc' | 'desc'

interface LeadsTableProps {
  initialLeads: Lead[]
}

const inputCls = 'bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all'

export default function LeadsTable({ initialLeads }: LeadsTableProps) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all')
  const [industryFilter, setIndustryFilter] = useState('all')
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [activeLead, setActiveLead] = useState<Lead | null>(null)
  const [showCSV, setShowCSV] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [isPending, startTransition] = useTransition()

  // ── Filtering + Sorting ────────────────────────────────────
  const filtered = useMemo(() => {
    let rows = leads
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(
        (l) =>
          l.company_name.toLowerCase().includes(q) ||
          (l.contact_name ?? '').toLowerCase().includes(q) ||
          (l.email ?? '').toLowerCase().includes(q)
      )
    }
    if (statusFilter !== 'all') rows = rows.filter((l) => l.status === statusFilter)
    if (industryFilter !== 'all') rows = rows.filter((l) => l.industry === industryFilter)

    return [...rows].sort((a, b) => {
      const av = a[sortField] ?? ''
      const bv = b[sortField] ?? ''
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
    })
  }, [leads, search, statusFilter, industryFilter, sortField, sortDir])

  // ── Status counts ──────────────────────────────────────────
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: leads.length }
    LEAD_STATUSES.forEach((s) => { c[s] = leads.filter((l) => l.status === s).length })
    return c
  }, [leads])

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortField(field); setSortDir('asc') }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronsUpDown className="w-3 h-3 text-gray-600" />
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-violet-400" />
      : <ChevronDown className="w-3 h-3 text-violet-400" />
  }

  // ── Selection ──────────────────────────────────────────────
  const allSelected = filtered.length > 0 && filtered.every((l) => selected.has(l.id))
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(filtered.map((l) => l.id)))
  }
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Toast helper ───────────────────────────────────────────
  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Status quick-change ────────────────────────────────────
  const handleStatusChange = (id: string, status: string) => {
    startTransition(async () => {
      const { error } = await updateLeadStatus(id, status)
      if (error) { showToast(error, 'error'); return }
      setLeads((prev) => prev.map((l) => l.id === id ? { ...l, status: status as LeadStatus } : l))
    })
  }

  // ── Bulk delete ────────────────────────────────────────────
  const handleBulkDelete = () => {
    if (!selected.size || !confirm(`${selected.size}件を削除しますか？`)) return
    startTransition(async () => {
      const { error } = await deleteLeads([...selected])
      if (error) { showToast(error, 'error'); return }
      setLeads((prev) => prev.filter((l) => !selected.has(l.id)))
      setSelected(new Set())
      showToast(`${selected.size}件を削除しました`, 'success')
    })
  }

  // ── Add new lead ───────────────────────────────────────────
  const [newCompany, setNewCompany] = useState('')
  const handleQuickAdd = async () => {
    if (!newCompany.trim()) return
    const { data, error } = await createLead({ company_name: newCompany.trim(), status: '未着手' })
    if (error) { showToast(error, 'error'); return }
    if (data) {
      setLeads((prev) => [data, ...prev])
      setNewCompany('')
      setShowAdd(false)
      showToast('リードを追加しました', 'success')
    }
  }

  return (
    <div className="flex flex-col h-full relative">

      {/* ── Toast ───────────────────────────────────────────── */}
      {toast && (
        <div className={clsx(
          'fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border shadow-xl text-sm font-medium',
          toast.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        )}>
          {toast.msg}
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────── */}
      {activeLead && (
        <LeadModal
          lead={activeLead}
          onClose={() => setActiveLead(null)}
          onUpdated={(updated) => {
            setLeads((prev) => prev.map((l) => l.id === updated.id ? updated : l))
            setActiveLead(null)
            showToast('保存しました', 'success')
          }}
          onDeleted={(id) => {
            setLeads((prev) => prev.filter((l) => l.id !== id))
            setActiveLead(null)
            showToast('削除しました', 'success')
          }}
        />
      )}
      {showCSV && (
        <CSVImport
          onClose={() => setShowCSV(false)}
          onSuccess={(count) => {
            setShowCSV(false)
            showToast(`${count}件インポートしました。ページを更新してください。`, 'success')
          }}
        />
      )}

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="px-8 pt-8 pb-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">リード管理</h1>
            <p className="text-gray-400 text-sm mt-1">
              {leads.length.toLocaleString()}件のリード
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCSV(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 text-gray-300 text-sm font-medium rounded-xl transition-all"
            >
              <Upload className="w-4 h-4" />
              CSVインポート
            </button>
            <button
              onClick={async () => {
                try {
                  const res = await fetch('/api/export', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'leads', format: 'csv' }),
                  })
                  if (!res.ok) throw new Error('Export failed')
                  const blob = await res.blob()
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`
                  a.click()
                  URL.revokeObjectURL(url)
                } catch {
                  setToast({ msg: 'エクスポートに失敗しました', type: 'error' })
                }
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 text-gray-300 text-sm font-medium rounded-xl transition-all"
            >
              <Download className="w-4 h-4" />
              エクスポート
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-violet-500/20"
            >
              <Plus className="w-4 h-4" />
              リード追加
            </button>
          </div>
        </div>

        {/* Quick add form */}
        {showAdd && (
          <div className="flex items-center gap-3 mb-4 p-4 bg-gray-900 border border-gray-800 rounded-2xl">
            <Building2 className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <input
              autoFocus
              value={newCompany}
              onChange={(e) => setNewCompany(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleQuickAdd(); if (e.key === 'Escape') setShowAdd(false) }}
              placeholder="会社名を入力して Enter"
              className={clsx(inputCls, 'flex-1')}
            />
            <button onClick={handleQuickAdd} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors">
              追加
            </button>
            <button onClick={() => setShowAdd(false)} className="text-gray-500 hover:text-gray-300 transition-colors text-sm">
              キャンセル
            </button>
          </div>
        )}

        {/* Status tab filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {(['all', ...LEAD_STATUSES] as const).map((s) => {
            const active = statusFilter === s
            const cfg = s !== 'all' ? STATUS_CONFIG[s] : null
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all border',
                  active
                    ? s === 'all'
                      ? 'bg-violet-600/20 border-violet-500/30 text-violet-300'
                      : `${cfg!.bg} ${cfg!.border} ${cfg!.color}`
                    : 'bg-gray-800/50 border-gray-700/50 text-gray-500 hover:border-gray-600 hover:text-gray-300'
                )}
              >
                {s !== 'all' && cfg && (
                  <span className={clsx('w-1.5 h-1.5 rounded-full', active ? cfg.dot : 'bg-gray-600')} />
                )}
                {s === 'all' ? 'すべて' : s}
                <span className={clsx(
                  'px-1.5 py-0.5 rounded text-xs',
                  active ? 'bg-white/10' : 'bg-gray-700/50 text-gray-500'
                )}>
                  {counts[s] ?? 0}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Search + Filter bar ──────────────────────────────── */}
      <div className="px-8 pb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="会社名・担当者・メールで検索"
            className={clsx(inputCls, 'pl-9 w-full')}
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={industryFilter}
            onChange={(e) => setIndustryFilter(e.target.value)}
            className={clsx(inputCls, 'cursor-pointer')}
          >
            <option value="all">業種: すべて</option>
            {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>

        {selected.size > 0 && (
          <button
            onClick={handleBulkDelete}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl hover:bg-red-500/20 transition-colors"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {selected.size}件削除
          </button>
        )}

        <div className="ml-auto text-xs text-gray-500">
          {filtered.length.toLocaleString()} 件表示
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto px-8 pb-8">
        <div className="border border-gray-800 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-900 border-b border-gray-800">
                <th className="w-10 px-4 py-3">
                  <button onClick={toggleAll} className="text-gray-500 hover:text-gray-300 transition-colors">
                    {allSelected
                      ? <CheckSquare className="w-4 h-4 text-violet-400" />
                      : <Square className="w-4 h-4" />}
                  </button>
                </th>
                {[
                  { label: '会社名', field: 'company_name' as SortField },
                  { label: '担当者 / 連絡先', field: null },
                  { label: '業種', field: 'industry' as SortField },
                  { label: 'ステータス', field: 'status' as SortField },
                  { label: '登録日', field: 'created_at' as SortField },
                  { label: '', field: null },
                ].map(({ label, field }) => (
                  <th key={label} className="px-4 py-3 text-left">
                    {field ? (
                      <button
                        onClick={() => toggleSort(field)}
                        className="flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-gray-200 transition-colors"
                      >
                        {label}
                        <SortIcon field={field} />
                      </button>
                    ) : (
                      <span className="text-xs font-semibold text-gray-400">{label}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <Building2 className="w-8 h-8 text-gray-700 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">
                      {search || statusFilter !== 'all' || industryFilter !== 'all'
                        ? '条件に一致するリードがありません'
                        : 'リードが登録されていません。CSVインポートまたは手動追加してください。'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((lead) => (
                  <tr
                    key={lead.id}
                    className={clsx(
                      'border-t border-gray-800/60 hover:bg-gray-800/30 transition-colors',
                      selected.has(lead.id) && 'bg-violet-500/5'
                    )}
                  >
                    {/* Checkbox */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleOne(lead.id)}
                        className="text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        {selected.has(lead.id)
                          ? <CheckSquare className="w-4 h-4 text-violet-400" />
                          : <Square className="w-4 h-4" />}
                      </button>
                    </td>

                    {/* Company */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setActiveLead(lead)}
                        className="flex items-center gap-3 group text-left"
                      >
                        <div className="w-8 h-8 bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold text-gray-300 group-hover:from-violet-600/30 group-hover:to-indigo-600/30 transition-all">
                          {lead.company_name[0]}
                        </div>
                        <span className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">
                          {lead.company_name}
                        </span>
                      </button>
                    </td>

                    {/* Contact */}
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        {lead.contact_name && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-400">
                            <User className="w-3 h-3 text-gray-600" />
                            {lead.contact_name}
                          </div>
                        )}
                        {lead.email && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <Mail className="w-3 h-3 text-gray-600" />
                            <span className="truncate max-w-[160px]">{lead.email}</span>
                          </div>
                        )}
                        {lead.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <Phone className="w-3 h-3 text-gray-600" />
                            {lead.phone}
                          </div>
                        )}
                        {!lead.contact_name && !lead.email && !lead.phone && (
                          <span className="text-xs text-gray-600">—</span>
                        )}
                      </div>
                    </td>

                    {/* Industry */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-400">{lead.industry || '—'}</span>
                    </td>

                    {/* Status dropdown */}
                    <td className="px-4 py-3">
                      <select
                        value={lead.status}
                        onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className={clsx(
                          'text-xs rounded-lg border px-2 py-1 cursor-pointer transition-all focus:outline-none focus:ring-1 focus:ring-violet-500',
                          STATUS_CONFIG[lead.status].bg,
                          STATUS_CONFIG[lead.status].border,
                          STATUS_CONFIG[lead.status].color,
                          'bg-transparent'
                        )}
                        style={{ backgroundColor: 'transparent' }}
                      >
                        {LEAD_STATUSES.map((s) => (
                          <option key={s} value={s} className="bg-gray-900 text-gray-200">{s}</option>
                        ))}
                      </select>
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500">
                        {new Date(lead.created_at).toLocaleDateString('ja-JP')}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {lead.website_url && (
                          <a
                            href={lead.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-gray-600 hover:text-gray-300 transition-colors"
                          >
                            <Globe className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          onClick={() => setActiveLead(lead)}
                          className="text-gray-600 hover:text-violet-400 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// Re-export User icon needed inline
function User(props: React.ComponentProps<typeof Building2>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}
