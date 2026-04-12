'use client'

import { useState, useMemo, useCallback, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, Filter, ChevronUp, ChevronDown, ChevronsUpDown,
  Upload, Download, Plus, Trash2, ExternalLink, Loader2,
  Building2, CheckSquare, Square, Globe, Mail, Phone, Sparkles
} from 'lucide-react'
import StatusBadge from './StatusBadge'
import LeadModal from './LeadModal'
import CSVImport from './CSVImport'
import { updateLeadStatus, deleteLeads, createLead } from '@/app/dashboard/leads/actions'
import type { Lead, LeadStatus } from '@/types/leads'
import { LEAD_STATUSES, INDUSTRIES, STATUS_CONFIG, PREFECTURES } from '@/types/leads'
import { detectContactMethod } from '@/lib/contact-method'
import clsx from 'clsx'

const CONTACT_METHOD_BADGE: Record<string, { icon: string; label: string; color: string }> = {
  form: { icon: '📝', label: 'フォーム', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  email: { icon: '📧', label: 'メール', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  instagram: { icon: '📸', label: 'Instagram', color: 'text-pink-400 bg-pink-500/10 border-pink-500/20' },
  manual: { icon: '✋', label: '手動', color: 'text-gray-400 bg-gray-500/10 border-gray-500/20' },
  none: { icon: '❌', label: 'なし', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
  unscanned: { icon: '🔍', label: '未スキャン', color: 'text-gray-500 bg-gray-500/10 border-gray-700/30' },
}

type SortField = 'company_name' | 'industry' | 'status' | 'created_at'
type SortDir = 'asc' | 'desc'

interface LeadsTableProps {
  initialLeads: Lead[]
  queueStatusMap?: Record<string, string>
}

// 送信キューステータスバッジの設定
const QUEUE_STATUS_BADGE: Record<string, { label: string; color: string }> = {
  '確認待ち': { label: '確認待ち', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  '失敗':     { label: '送信失敗', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
  'form_not_found': { label: 'フォーム未検出', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
}

const inputCls = 'bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all'

export default function LeadsTable({ initialLeads, queueStatusMap = {} }: LeadsTableProps) {
  const router = useRouter()
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all' | 'queue_確認待ち' | 'queue_失敗' | 'queue_form_not_found'>('all')
  const [industryFilter, setIndustryFilter] = useState('all')
  const [prefectureFilter, setPrefectureFilter] = useState('all')
  const [methodFilter, setMethodFilter] = useState<'all' | 'email' | 'form'>('all')
  const [excludeQueued, setExcludeQueued] = useState(true) // デフォルトで確認待ちを除外
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [selected, setSelected] = useState<Set<string>>(() => {
    // localStorageから復元
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('leads_selected')
        if (saved) return new Set(JSON.parse(saved) as string[])
      } catch { /* ignore */ }
    }
    return new Set<string>()
  })
  // selectedをlocalStorageに永続化
  useEffect(() => {
    localStorage.setItem('leads_selected', JSON.stringify(Array.from(selected)))
  }, [selected])

  const [activeLead, setActiveLead] = useState<Lead | null>(null)
  const [showCSV, setShowCSV] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 50
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
    if (statusFilter !== 'all') {
      if (statusFilter.startsWith('queue_')) {
        if (statusFilter === 'queue_失敗') {
          rows = rows.filter((l) => queueStatusMap[l.id] === '失敗')
        } else if (statusFilter === 'queue_form_not_found') {
          rows = rows.filter((l) => queueStatusMap[l.id] === 'form_not_found')
        } else {
          const queueStatus = statusFilter.replace('queue_', '')
          rows = rows.filter((l) => queueStatusMap[l.id] === queueStatus)
        }
      } else {
        rows = rows.filter((l) => l.status === statusFilter)
      }
    }
    if (industryFilter !== 'all') rows = rows.filter((l) => l.industry === industryFilter)
    if (prefectureFilter !== 'all') rows = rows.filter((l) => (l.prefecture ?? l.notes) === prefectureFilter)
    if (excludeQueued && statusFilter !== 'queue_確認待ち') {
      rows = rows.filter((l) => !queueStatusMap[l.id] || queueStatusMap[l.id] !== '確認待ち')
    }
    if (methodFilter !== 'all') {
      rows = rows.filter((l) => {
        const method = detectContactMethod(l)
        return method === methodFilter
      })
    }

    return [...rows].sort((a, b) => {
      const av = a[sortField] ?? ''
      const bv = b[sortField] ?? ''
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
    })
  }, [leads, search, statusFilter, industryFilter, prefectureFilter, methodFilter, excludeQueued, sortField, sortDir, queueStatusMap])

  // ── Status counts ──────────────────────────────────────────
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: leads.length }
    LEAD_STATUSES.forEach((s) => { c[s] = leads.filter((l) => l.status === s).length })
    // Queue status counts
    c['queue_確認待ち'] = leads.filter((l) => queueStatusMap[l.id] === '確認待ち').length
    c['queue_失敗'] = leads.filter((l) => queueStatusMap[l.id] === '失敗').length
    c['queue_form_not_found'] = leads.filter((l) => queueStatusMap[l.id] === 'form_not_found').length
    return c
  }, [leads, queueStatusMap])

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
    setSelected((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        // Deselect only current filtered items (keep others)
        filtered.forEach((l) => next.delete(l.id))
      } else {
        // Add current filtered items to existing selection
        filtered.forEach((l) => next.add(l.id))
      }
      return next
    })
  }
  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

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

  // ── Bulk delete (APIルート経由で大量削除対応) ─────────────────
  const handleBulkDelete = () => {
    if (!selected.size || !confirm(`${selected.size}件を削除しますか？`)) return
    startTransition(async () => {
      const ids = [...selected]
      // 200件ずつAPIに送信
      const CHUNK = 200
      for (let i = 0; i < ids.length; i += CHUNK) {
        const res = await fetch('/api/leads/bulk-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: ids.slice(i, i + CHUNK) }),
        })
        if (!res.ok) {
          const data = await res.json()
          showToast(data.error || '削除エラー', 'error')
          return
        }
      }
      setLeads((prev) => prev.filter((l) => !selected.has(l.id)))
      setSelected(new Set())
      showToast(`${ids.length}件を削除しました`, 'success')
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
      <div className="px-4 md:px-8 pt-6 md:pt-8 pb-4">
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white">リード管理</h1>
            <p className="text-gray-400 text-xs md:text-sm mt-1">
              {leads.length.toLocaleString()}件のリード
            </p>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <button
              onClick={() => setShowCSV(true)}
              className="flex items-center gap-1.5 md:gap-2 px-2.5 md:px-4 py-2 md:py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 text-gray-300 text-xs md:text-sm font-medium rounded-xl transition-all"
            >
              <Upload className="w-3.5 md:w-4 h-3.5 md:h-4" />
              <span className="hidden sm:inline">CSVインポート</span>
              <span className="sm:hidden">CSV</span>
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
              className="flex items-center gap-1.5 md:gap-2 px-2.5 md:px-4 py-2 md:py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 text-gray-300 text-xs md:text-sm font-medium rounded-xl transition-all"
            >
              <Download className="w-3.5 md:w-4 h-3.5 md:h-4" />
              <span className="hidden sm:inline">エクスポート</span>
              <span className="sm:hidden">出力</span>
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 md:gap-2 px-2.5 md:px-4 py-2 md:py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-xs md:text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-violet-500/20"
            >
              <Plus className="w-3.5 md:w-4 h-3.5 md:h-4" />
              <span className="hidden sm:inline">リード追加</span>
              <span className="sm:hidden">追加</span>
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
                onClick={() => { setStatusFilter(s); setPage(1) }}
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
          {/* Queue status filters */}
          <span className="w-px h-5 bg-gray-700 mx-1" />
          {([
            { key: 'queue_確認待ち' as const, label: '確認待ち', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', dot: 'bg-amber-400' },
            { key: 'queue_失敗' as const, label: '送信失敗', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', dot: 'bg-red-400' },
            { key: 'queue_form_not_found' as const, label: 'フォーム未検出', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', dot: 'bg-orange-400' },
          ]).map(({ key, label, color, bg, border, dot }) => {
            const active = statusFilter === key
            return (
              <button
                key={key}
                onClick={() => { setStatusFilter(active ? 'all' : key); setPage(1) }}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all border',
                  active
                    ? `${bg} ${border} ${color}`
                    : 'bg-gray-800/50 border-gray-700/50 text-gray-500 hover:border-gray-600 hover:text-gray-300'
                )}
              >
                <span className={clsx('w-1.5 h-1.5 rounded-full', active ? dot : 'bg-gray-600')} />
                {label}
                {(counts[key] ?? 0) > 0 && (
                  <span className={clsx(
                    'px-1.5 py-0.5 rounded text-xs',
                    active ? 'bg-white/10' : 'bg-gray-700/50 text-gray-500'
                  )}>
                    {counts[key]}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Search + Filter bar ──────────────────────────────── */}
      <div className="px-4 md:px-8 pb-4 flex flex-wrap items-center gap-2 md:gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="会社名・担当者・メールで検索"
            className={clsx(inputCls, 'pl-9 w-full')}
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={industryFilter}
            onChange={(e) => { setIndustryFilter(e.target.value); setPage(1) }}
            className={clsx(inputCls, 'cursor-pointer')}
          >
            <option value="all">業種: すべて</option>
            {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
          <select
            value={prefectureFilter}
            onChange={(e) => { setPrefectureFilter(e.target.value); setPage(1) }}
            className={clsx(inputCls, 'cursor-pointer')}
          >
            <option value="all">都道府県: すべて</option>
            {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            value={methodFilter}
            onChange={(e) => { setMethodFilter(e.target.value as 'all' | 'email' | 'form'); setPage(1) }}
            className={clsx(inputCls, 'cursor-pointer')}
          >
            <option value="all">送信方法: すべて</option>
            <option value="email">メール</option>
            <option value="form">フォーム</option>
          </select>
          <button
            onClick={() => { setExcludeQueued(v => !v); setPage(1) }}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all',
              excludeQueued
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600'
            )}
          >
            {excludeQueued ? '確認待ち除外中' : '確認待ち含む'}
          </button>
        </div>

        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const ids = Array.from(selected)
                // 選択をlocalStorageにも保存（文面生成ページで復元可能）
                localStorage.setItem('bulk_selected_leads', JSON.stringify(ids))
                router.push(`/dashboard/compose?mode=bulk&leads=${ids.join(',')}`)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-violet-500/10 border border-violet-500/20 text-violet-400 text-sm rounded-xl hover:bg-violet-500/20 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              {selected.size}件 一括文面生成
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl hover:bg-red-500/20 transition-colors"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {selected.size}件削除
            </button>
          </div>
        )}

        <div className="ml-auto text-xs text-gray-500">
          {filtered.length.toLocaleString()} 件表示（{page}/{Math.ceil(filtered.length / PAGE_SIZE) || 1}ページ）
        </div>
      </div>

      {/* ── Table (desktop) / Cards (mobile) ────────────────── */}
      <div className="flex-1 overflow-auto px-4 md:px-8 pb-8">

        {/* ── Mobile card view ──────────────────────────────── */}
        <div className="md:hidden space-y-3">
          {filtered.length === 0 ? (
            <div className="px-4 py-16 text-center">
              <Building2 className="w-8 h-8 text-gray-700 mx-auto mb-3" />
              <p className="text-sm text-gray-500">
                {search || statusFilter !== 'all' || industryFilter !== 'all'
                  ? '条件に一致するリードがありません'
                  : 'リードが登録されていません。'}
              </p>
            </div>
          ) : (
            filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((lead) => {
              const method = lead.contact_method ?? 'unscanned'
              const badge = CONTACT_METHOD_BADGE[method] || CONTACT_METHOD_BADGE.unscanned
              return (
                <div
                  key={lead.id}
                  className={clsx(
                    'border border-gray-800 rounded-xl p-4 transition-colors',
                    selected.has(lead.id) ? 'bg-violet-500/5 border-violet-500/20' : 'bg-gray-900/50'
                  )}
                >
                  {/* Top: checkbox + company + status */}
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => toggleOne(lead.id)}
                      className="text-gray-500 hover:text-gray-300 transition-colors mt-0.5 flex-shrink-0"
                    >
                      {selected.has(lead.id)
                        ? <CheckSquare className="w-4 h-4 text-violet-400" />
                        : <Square className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => setActiveLead(lead)}
                      className="flex-1 text-left min-w-0"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-7 h-7 bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold text-gray-300">
                          {lead.company_name[0]}
                        </div>
                        <span className="text-sm font-medium text-gray-200 truncate">
                          {lead.company_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 ml-9">
                        <span className={clsx('inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border', badge.color)}>
                          {badge.icon} {badge.label}
                        </span>
                        {lead.industry && (
                          <span className="text-[10px] text-gray-500">{lead.industry}</span>
                        )}
                      </div>
                    </button>
                    <div className="flex flex-col items-end gap-1">
                      <select
                        value={lead.status}
                        onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className={clsx(
                          'text-[10px] rounded-lg border px-1.5 py-0.5 cursor-pointer transition-all focus:outline-none focus:ring-1 focus:ring-violet-500 flex-shrink-0',
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
                      {queueStatusMap[lead.id] && QUEUE_STATUS_BADGE[queueStatusMap[lead.id]] && (
                        <span className={clsx(
                          'inline-flex items-center text-[10px] px-1.5 py-0.5 rounded border',
                          QUEUE_STATUS_BADGE[queueStatusMap[lead.id]].color
                        )}>
                          {QUEUE_STATUS_BADGE[queueStatusMap[lead.id]].label}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Contact info */}
                  <div className="ml-7 mt-2 space-y-0.5">
                    {lead.contact_name && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <User className="w-3 h-3 text-gray-600 flex-shrink-0" />
                        {lead.contact_name}
                      </div>
                    )}
                    {lead.email && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Mail className="w-3 h-3 text-gray-600 flex-shrink-0" />
                        <span className="truncate">{lead.email}</span>
                      </div>
                    )}
                    {lead.phone && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Phone className="w-3 h-3 text-gray-600 flex-shrink-0" />
                        {lead.phone}
                      </div>
                    )}
                  </div>

                  {/* Bottom: date + actions */}
                  <div className="flex items-center justify-between ml-7 mt-2 pt-2 border-t border-gray-800/60">
                    <span className="text-[10px] text-gray-600">
                      {new Date(lead.created_at).toLocaleDateString('ja-JP')}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => router.push(`/dashboard/compose?leadId=${lead.id}`)}
                        className="p-1.5 rounded-lg text-violet-500/60 hover:text-violet-400 hover:bg-violet-500/10 transition-all"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                      </button>
                      {lead.website_url && (
                        <a
                          href={lead.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-gray-800 transition-all"
                        >
                          <Globe className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        onClick={() => setActiveLead(lead)}
                        className="p-1.5 rounded-lg text-gray-600 hover:text-violet-400 hover:bg-gray-800 transition-all"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* ── Desktop table view ────────────────────────────── */}
        <div className="hidden md:block border border-gray-800 rounded-2xl overflow-hidden">
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
                filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((lead) => (
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
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">
                            {lead.company_name}
                          </span>
                          {(() => {
                            const method = lead.contact_method ?? 'unscanned'
                            const badge = CONTACT_METHOD_BADGE[method] || CONTACT_METHOD_BADGE.unscanned
                            return (
                              <span className={clsx('inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border w-fit', badge.color)}>
                                {badge.icon} {badge.label}
                              </span>
                            )
                          })()}
                        </div>
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
                      <div className="flex flex-col gap-1">
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
                        {queueStatusMap[lead.id] && QUEUE_STATUS_BADGE[queueStatusMap[lead.id]] && (
                          <span className={clsx(
                            'inline-flex items-center text-[10px] px-1.5 py-0.5 rounded border w-fit',
                            QUEUE_STATUS_BADGE[queueStatusMap[lead.id]].color
                          )}>
                            {QUEUE_STATUS_BADGE[queueStatusMap[lead.id]].label}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500">
                        {new Date(lead.created_at).toLocaleDateString('ja-JP')}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/dashboard/compose?leadId=${lead.id}`)
                          }}
                          title="文面生成"
                          className="p-1.5 rounded-lg text-violet-500/60 hover:text-violet-400 hover:bg-violet-500/10 transition-all"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                        </button>
                        {lead.website_url && (
                          <a
                            href={lead.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title="Webサイト"
                            className="p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-gray-800 transition-all"
                          >
                            <Globe className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          onClick={() => setActiveLead(lead)}
                          title="詳細"
                          className="p-1.5 rounded-lg text-gray-600 hover:text-violet-400 hover:bg-gray-800 transition-all"
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

        {/* Pagination */}
        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <span className="text-xs text-gray-500">
              {((page - 1) * PAGE_SIZE + 1).toLocaleString()}〜{Math.min(page * PAGE_SIZE, filtered.length).toLocaleString()} / {filtered.length.toLocaleString()}件
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="px-2 py-1 text-xs rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                最初
              </button>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2 py-1 text-xs rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ← 前
              </button>
              {(() => {
                const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
                const pages: number[] = []
                const start = Math.max(1, page - 2)
                const end = Math.min(totalPages, page + 2)
                for (let i = start; i <= end; i++) pages.push(i)
                return pages.map(p => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={clsx(
                      'w-7 h-7 text-xs rounded-lg',
                      p === page
                        ? 'bg-violet-600 text-white font-bold'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    )}
                  >
                    {p}
                  </button>
                ))
              })()}
              <button
                onClick={() => setPage(p => Math.min(Math.ceil(filtered.length / PAGE_SIZE), p + 1))}
                disabled={page >= Math.ceil(filtered.length / PAGE_SIZE)}
                className="px-2 py-1 text-xs rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                次 →
              </button>
              <button
                onClick={() => setPage(Math.ceil(filtered.length / PAGE_SIZE))}
                disabled={page >= Math.ceil(filtered.length / PAGE_SIZE)}
                className="px-2 py-1 text-xs rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                最後
              </button>
            </div>
          </div>
        )}
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
