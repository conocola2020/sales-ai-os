'use client'

import { useState, useCallback } from 'react'
import {
  Globe,
  Search,
  Loader2,
  AlertCircle,
  Info,
  Sparkles,
  Save,
  MessageSquare,
  CheckCircle2,
  X,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import AnalysisResultComponent from './AnalysisResult'
import SaveToLeadModal from './SaveToLeadModal'
import AnalysisHistory from './AnalysisHistory'
import type { AnalysisResult, CompanyAnalysis } from '@/types/analyses'
import type { Lead } from '@/types/leads'
import clsx from 'clsx'

interface CompaniesPageProps {
  initialAnalyses: CompanyAnalysis[]
  leads: Lead[]
  isDemo: boolean
}

const LOADING_MESSAGES = [
  'URLを取得中...',
  'ページを解析中...',
  'AIが分析中...',
  '課題を抽出中...',
  '提案ポイントを生成中...',
]

export default function CompaniesPage({ initialAnalyses, leads, isDemo }: CompaniesPageProps) {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0)
  const [error, setError] = useState('')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [currentUrl, setCurrentUrl] = useState('')
  const [analyses, setAnalyses] = useState<CompanyAnalysis[]>(initialAnalyses)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [savedLeadId, setSavedLeadId] = useState<string | null>(null)
  const [savedLeadName, setSavedLeadName] = useState<string | null>(null)

  const handleAnalyze = useCallback(async () => {
    const trimmedUrl = url.trim()
    if (!trimmedUrl) {
      setError('URLを入力してください')
      return
    }
    setError('')
    setResult(null)
    setSavedLeadId(null)
    setSavedLeadName(null)
    setIsAnalyzing(true)
    setLoadingMsgIdx(0)
    setCurrentUrl(trimmedUrl)

    // Cycle loading messages
    const intervalId = setInterval(() => {
      setLoadingMsgIdx(prev => (prev + 1) % LOADING_MESSAGES.length)
    }, 800)

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmedUrl }),
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json?.error ?? `HTTP ${res.status}`)
      }

      setResult(json.result as AnalysisResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析に失敗しました')
    } finally {
      clearInterval(intervalId)
      setIsAnalyzing(false)
    }
  }, [url])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isAnalyzing) {
      handleAnalyze()
    }
  }

  const handleSaved = (leadId: string, leadName: string) => {
    setSavedLeadId(leadId)
    setSavedLeadName(leadName)
    setShowSaveModal(false)
    // Refresh analyses list
    window.location.reload()
  }

  const handleSelectHistory = (analysis: CompanyAnalysis) => {
    setCurrentUrl(analysis.url)
    setUrl(analysis.url)
    setResult({
      company_name: analysis.company_name ?? '',
      industry: analysis.industry ?? '',
      scale: analysis.scale ?? '不明',
      business_summary: analysis.business_summary ?? '',
      challenges: analysis.challenges ?? [],
      proposal_points: analysis.proposal_points ?? [],
      keywords: analysis.keywords ?? [],
    })
    setSavedLeadId(analysis.lead_id)
    setSavedLeadName(analysis.lead?.company_name ?? null)
  }

  const handleDeleteHistory = (id: string) => {
    setAnalyses(prev => prev.filter(a => a.id !== id))
  }

  const handleGoToCompose = () => {
    if (savedLeadId) {
      router.push(`/dashboard/compose?leadId=${savedLeadId}`)
    } else {
      router.push('/dashboard/compose')
    }
  }

  const [showHistory, setShowHistory] = useState(false)

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-gray-800 flex-shrink-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-base md:text-lg font-semibold text-white">企業分析AI</h1>
          <p className="text-[10px] md:text-xs text-gray-500 mt-0.5 truncate">
            URLを入力するだけで企業情報・課題・提案ポイントをAIが自動分析します
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-violet-500/10 border border-violet-500/20 rounded-lg text-xs font-medium text-violet-400">
            <Sparkles className="w-3 h-3" />
            claude-sonnet-4-6
          </span>
          {/* Mobile: toggle history */}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="md:hidden flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-400 hover:text-white transition-colors"
          >
            <Search className="w-3 h-3" />
            履歴
            {analyses.length > 0 && (
              <span className="px-1 py-0.5 bg-violet-500/20 text-violet-400 rounded text-[10px]">{analyses.length}</span>
            )}
          </button>
        </div>
      </div>

      {/* Demo / API key banner */}
      {isDemo && (
        <div className="mx-4 md:mx-6 mt-3 md:mt-4 flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 md:px-4 py-2.5 md:py-3">
          <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-[10px] md:text-xs text-amber-400">
            <span className="font-semibold">デモモード:</span>{' '}
            <span className="hidden sm:inline">ANTHROPIC_API_KEY が未設定です。.env.local に設定するとリアルな分析が可能になります。</span>
            現在はサンプル分析を表示します。
          </p>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mx-4 md:mx-6 mt-3 md:mt-4 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 md:px-4 py-2.5 md:py-3">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-xs text-red-400">{error}</p>
          <button
            onClick={() => setError('')}
            className="ml-auto text-red-500 hover:text-red-300 text-xs"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Mobile: History panel (collapsible) */}
      {showHistory && (
        <div className="md:hidden border-b border-gray-800 p-4 max-h-64 overflow-y-auto bg-gray-900/50">
          <AnalysisHistory
            analyses={analyses}
            onSelect={(analysis) => { handleSelectHistory(analysis); setShowHistory(false) }}
            onDeleted={handleDeleteHistory}
          />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[1fr_300px] gap-0 overflow-hidden">
        {/* Left: Analysis area */}
        <div className="flex flex-col overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-5 md:border-r border-gray-800">
          {/* URL Input */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              企業WebサイトのURL
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="url"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="https://example.com"
                  disabled={isAnalyzing}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all disabled:opacity-60"
                />
              </div>
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || !url.trim()}
                className={clsx(
                  'flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all whitespace-nowrap',
                  url.trim() && !isAnalyzing
                    ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-900/30'
                    : 'bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed'
                )}
              >
                {isAnalyzing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                {isAnalyzing ? '分析中...' : '分析する'}
              </button>
            </div>
          </div>

          {/* Loading state */}
          {isAnalyzing && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="relative">
                <div className="w-16 h-16 bg-violet-500/10 border border-violet-500/20 rounded-2xl flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-violet-400 animate-pulse" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-white">
                  {LOADING_MESSAGES[loadingMsgIdx]}
                </p>
                <p className="text-xs text-gray-500 mt-1">しばらくお待ちください</p>
              </div>
              {/* Progress bar */}
              <div className="w-48 h-1 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-violet-500 rounded-full animate-pulse w-2/3" />
              </div>
            </div>
          )}

          {/* Result */}
          {result && !isAnalyzing && (
            <div className="space-y-4">
              {/* Saved status */}
              {savedLeadId ? (
                <div className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <p className="text-xs text-emerald-400">
                      <span className="font-semibold">{savedLeadName}</span> に紐付けて保存しました
                    </p>
                  </div>
                  <button
                    onClick={handleGoToCompose}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-xs font-semibold text-emerald-400 transition-colors whitespace-nowrap"
                  >
                    <MessageSquare className="w-3 h-3" />
                    文面生成へ
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowSaveModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-xl transition-colors"
                  >
                    <Save className="w-3.5 h-3.5" />
                    リードに保存
                  </button>
                  <button
                    onClick={handleGoToCompose}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-xs font-medium rounded-xl transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    文面生成へ
                  </button>
                  <p className="text-xs text-gray-600 ml-auto">
                    保存しないと履歴に残りません
                  </p>
                </div>
              )}

              <AnalysisResultComponent result={result} url={currentUrl} />
            </div>
          )}

          {/* Empty state */}
          {!result && !isAnalyzing && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mb-4">
                <Globe className="w-8 h-8 text-gray-600" />
              </div>
              <h3 className="text-sm font-medium text-gray-400 mb-1">URLを入力して分析を開始</h3>
              <p className="text-xs text-gray-600 max-w-xs leading-relaxed">
                企業のWebサイトURLを入力すると、業種・規模・課題・提案ポイントをAIが自動分析します
              </p>
            </div>
          )}
        </div>

        {/* Right: History panel (desktop only) */}
        <div className="hidden md:flex flex-col overflow-hidden p-5">
          <AnalysisHistory
            analyses={analyses}
            onSelect={handleSelectHistory}
            onDeleted={handleDeleteHistory}
          />
        </div>
      </div>

      {/* Save modal */}
      {showSaveModal && result && (
        <SaveToLeadModal
          analysisResult={result}
          url={currentUrl}
          leads={leads}
          onClose={() => setShowSaveModal(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
