'use client'

import { useState } from 'react'
import { X, UserPlus, Link2, Search, Loader2 } from 'lucide-react'
import { saveAnalysis } from '@/app/dashboard/companies/actions'
import { createLead } from '@/app/dashboard/leads/actions'
import type { AnalysisResult } from '@/types/analyses'
import type { Lead, LeadOption } from '@/types/leads'
import clsx from 'clsx'

interface SaveToLeadModalProps {
  analysisResult: AnalysisResult
  url: string
  leads: LeadOption[]
  onClose: () => void
  onSaved: (leadId: string, leadName: string) => void
}

type Tab = 'new' | 'existing'

export default function SaveToLeadModal({
  analysisResult,
  url,
  leads,
  onClose,
  onSaved,
}: SaveToLeadModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('new')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // New lead form state
  const [newLead, setNewLead] = useState({
    company_name: analysisResult.company_name || '',
    contact_name: '',
    email: '',
    phone: '',
    industry: analysisResult.industry || '',
    website: url,
    notes: analysisResult.business_summary || '',
  })

  const filteredLeads = leads.filter(
    l =>
      l.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.contact_name ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCreateNewLead = async () => {
    if (!newLead.company_name.trim()) {
      setError('会社名を入力してください')
      return
    }
    setLoading(true)
    setError('')

    try {
      // Create the lead
      const { data: leadData, error: leadError } = await createLead({
        company_name: newLead.company_name,
        contact_name: newLead.contact_name || null,
        email: newLead.email || null,
        phone: newLead.phone || null,
        industry: newLead.industry || null,
        website_url: newLead.website || null,
        notes: newLead.notes || null,
        status: '未着手',
      })

      if (leadError || !leadData) {
        setError(leadError ?? 'リードの作成に失敗しました')
        return
      }

      // Save analysis linked to the new lead
      await saveAnalysis(analysisResult, url, leadData.id)
      onSaved(leadData.id, leadData.company_name)
    } catch {
      setError('保存中にエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const handleLinkExisting = async (lead: LeadOption) => {
    setLoading(true)
    setError('')
    try {
      await saveAnalysis(analysisResult, url, lead.id)
      onSaved(lead.id, lead.company_name)
    } catch {
      setError('保存中にエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">リードに紐付けて保存</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800">
          <button
            onClick={() => setActiveTab('new')}
            className={clsx(
              'flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium transition-colors border-b-2',
              activeTab === 'new'
                ? 'text-violet-400 border-violet-500'
                : 'text-gray-500 border-transparent hover:text-gray-400'
            )}
          >
            <UserPlus className="w-3.5 h-3.5" />
            新規リードを作成
          </button>
          <button
            onClick={() => setActiveTab('existing')}
            className={clsx(
              'flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium transition-colors border-b-2',
              activeTab === 'existing'
                ? 'text-violet-400 border-violet-500'
                : 'text-gray-500 border-transparent hover:text-gray-400'
            )}
          >
            <Link2 className="w-3.5 h-3.5" />
            既存リードに紐付ける
          </button>
        </div>

        {/* Content */}
        <div className="p-5 max-h-96 overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
              {error}
            </div>
          )}

          {activeTab === 'new' ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  会社名 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newLead.company_name}
                  onChange={e => setNewLead(p => ({ ...p, company_name: e.target.value }))}
                  placeholder="例: 株式会社サンプル"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">担当者名</label>
                  <input
                    type="text"
                    value={newLead.contact_name}
                    onChange={e => setNewLead(p => ({ ...p, contact_name: e.target.value }))}
                    placeholder="例: 山田 太郎"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">業種</label>
                  <input
                    type="text"
                    value={newLead.industry}
                    onChange={e => setNewLead(p => ({ ...p, industry: e.target.value }))}
                    placeholder="例: IT・ソフトウェア"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">メールアドレス</label>
                <input
                  type="email"
                  value={newLead.email}
                  onChange={e => setNewLead(p => ({ ...p, email: e.target.value }))}
                  placeholder="例: contact@example.com"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">メモ</label>
                <textarea
                  value={newLead.notes}
                  onChange={e => setNewLead(p => ({ ...p, notes: e.target.value }))}
                  rows={2}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="会社名・担当者名で検索..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {filteredLeads.length === 0 ? (
                  <p className="text-center text-sm text-gray-500 py-6">
                    {searchQuery ? '一致するリードが見つかりません' : 'リードが登録されていません'}
                  </p>
                ) : (
                  filteredLeads.map(lead => (
                    <button
                      key={lead.id}
                      onClick={() => handleLinkExisting(lead)}
                      disabled={loading}
                      className="w-full flex items-center gap-3 px-3 py-2.5 bg-gray-800/60 border border-gray-700/50 hover:border-violet-500/40 hover:bg-gray-800 rounded-xl text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-semibold text-gray-300">
                        {lead.company_name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {lead.company_name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {lead.contact_name ?? lead.industry ?? '担当者未登録'}
                        </p>
                      </div>
                      <span className="text-xs text-gray-600">選択</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {activeTab === 'new' && (
          <div className="px-5 py-4 border-t border-gray-800">
            <button
              onClick={handleCreateNewLead}
              disabled={loading || !newLead.company_name.trim()}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              {loading ? '保存中...' : 'リードを作成して保存'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
