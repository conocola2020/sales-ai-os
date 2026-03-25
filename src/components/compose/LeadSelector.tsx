'use client'

import { useState, useRef, useEffect, CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Search, Building2, ChevronDown, X } from 'lucide-react'
import type { Lead } from '@/types/leads'
import { STATUS_CONFIG } from '@/types/leads'
import clsx from 'clsx'

interface LeadSelectorProps {
  leads: Lead[]
  selectedLeadId: string
  onSelect: (leadId: string) => void
}

export default function LeadSelector({ leads, selectedLeadId, onSelect }: LeadSelectorProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({})
  const [mounted, setMounted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedLead = leads.find(l => l.id === selectedLeadId) ?? null

  const filtered = query.trim()
    ? leads.filter(l =>
        l.company_name.includes(query) ||
        (l.contact_name ?? '').includes(query) ||
        (l.industry ?? '').includes(query)
      )
    : leads

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const updateDropdownPosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      })
    }
  }

  const handleToggle = () => {
    if (!open) updateDropdownPosition()
    setOpen(v => !v)
  }

  // Update dropdown position on scroll/resize
  useEffect(() => {
    if (!open) return
    const onUpdate = () => updateDropdownPosition()
    window.addEventListener('scroll', onUpdate, true)
    window.addEventListener('resize', onUpdate)
    return () => {
      window.removeEventListener('scroll', onUpdate, true)
      window.removeEventListener('resize', onUpdate)
    }
  }, [open])

  // Close on click/touch outside (mouse + mobile touch)
  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (!open) return
      const target = e.target as Node
      if (
        containerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) return
      setOpen(false)
      setQuery('')
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [open])

  const dropdown = open && mounted ? createPortal(
    <div ref={dropdownRef} style={dropdownStyle} className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl overflow-hidden">
      {/* Search */}
      <div className="p-3 border-b border-gray-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="会社名・担当者・業種で検索..."
            style={{ fontSize: '16px' }}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* List */}
      <div className="max-h-56 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-gray-500">
            {leads.length === 0 ? 'リードが登録されていません' : '一致するリードが見つかりません'}
          </div>
        ) : (
          filtered.map(lead => (
            <button
              key={lead.id}
              onClick={() => { onSelect(lead.id); setOpen(false); setQuery('') }}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-800',
                lead.id === selectedLeadId && 'bg-violet-500/10'
              )}
            >
              <div className="w-7 h-7 bg-gradient-to-br from-violet-500/70 to-indigo-600/70 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-xs">{lead.company_name[0]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{lead.company_name}</p>
                <p className="text-xs text-gray-500 truncate">
                  {lead.contact_name ?? '—'}{lead.industry ? ` · ${lead.industry}` : ''}
                </p>
              </div>
              <span className={clsx(
                'px-2 py-0.5 rounded text-xs font-medium flex-shrink-0',
                STATUS_CONFIG[lead.status].bg,
                STATUS_CONFIG[lead.status].color
              )}>
                {lead.status}
              </span>
            </button>
          ))
        )}
      </div>

      {leads.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-800 text-xs text-gray-600 text-right">
          {filtered.length} 件
        </div>
      )}
    </div>,
    document.body
  ) : null

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-medium text-gray-400 mb-1.5">
        対象リード <span className="text-red-400">*</span>
      </label>

      <button
        ref={buttonRef}
        onClick={handleToggle}
        className={clsx(
          'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all',
          open
            ? 'bg-gray-800 border-violet-500 ring-1 ring-violet-500/30'
            : 'bg-gray-800 border-gray-700 hover:border-gray-600'
        )}
      >
        {selectedLead ? (
          <>
            <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-xs">{selectedLead.company_name[0]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{selectedLead.company_name}</p>
              <p className="text-xs text-gray-500 truncate">
                {selectedLead.contact_name ?? '担当者未登録'}{selectedLead.industry ? ` · ${selectedLead.industry}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={clsx(
                'px-2 py-0.5 rounded-md text-xs font-medium',
                STATUS_CONFIG[selectedLead.status].bg,
                STATUS_CONFIG[selectedLead.status].color
              )}>
                {selectedLead.status}
              </span>
              <span
                role="button"
                onClick={(e) => { e.stopPropagation(); onSelect('') }}
                className="text-gray-600 hover:text-gray-400 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
              <Building2 className="w-4 h-4 text-gray-500" />
            </div>
            <span className="text-sm text-gray-500 flex-1">リードを選択してください</span>
            <ChevronDown className={clsx('w-4 h-4 text-gray-500 flex-shrink-0 transition-transform', open && 'rotate-180')} />
          </>
        )}
      </button>

      {dropdown}
    </div>
  )
}
