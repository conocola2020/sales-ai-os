'use client'

import { Building2, Target, Lightbulb, Tag, Users, Briefcase } from 'lucide-react'
import type { AnalysisResult as AnalysisResultType } from '@/types/analyses'

interface AnalysisResultProps {
  result: AnalysisResultType
  url: string
}

export default function AnalysisResult({ result, url }: AnalysisResultProps) {
  return (
    <div className="space-y-4">
      {/* Company header */}
      <div className="bg-gray-50/60 border border-gray-200/50 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-violet-500/20 border border-violet-500/30 rounded-xl flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-violet-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-gray-900">
              {result.company_name || '企業名不明'}
            </h3>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-gray-400 truncate block mt-0.5 max-w-xs"
            >
              {url}
            </a>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {result.industry && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-500/10 border border-violet-500/20 rounded-full text-xs text-violet-600">
                  <Briefcase className="w-3 h-3" />
                  {result.industry}
                </span>
              )}
              {result.scale && result.scale !== '不明' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs text-blue-600">
                  <Users className="w-3 h-3" />
                  {result.scale}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Business summary */}
        {result.business_summary && (
          <div className="mt-3 pt-3 border-t border-gray-200/50">
            <p className="text-sm text-gray-700 leading-relaxed">{result.business_summary}</p>
          </div>
        )}
      </div>

      {/* Challenges */}
      {result.challenges.length > 0 && (
        <div className="bg-gray-50/60 border border-gray-200/50 rounded-xl p-4">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
            <Target className="w-4 h-4 text-amber-600" />
            課題・ニーズ
          </h4>
          <ul className="space-y-2">
            {result.challenges.map((challenge, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="w-5 h-5 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-600 text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-medium">
                  {i + 1}
                </span>
                <span className="text-sm text-gray-700 leading-relaxed">{challenge}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Proposal points */}
      {result.proposal_points.length > 0 && (
        <div className="bg-gray-50/60 border border-gray-200/50 rounded-xl p-4">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
            <Lightbulb className="w-4 h-4 text-emerald-600" />
            提案ポイント
          </h4>
          <ul className="space-y-2">
            {result.proposal_points.map((point, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="w-5 h-5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-600 text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-medium">
                  {i + 1}
                </span>
                <span className="text-sm text-gray-700 leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Keywords */}
      {result.keywords.length > 0 && (
        <div className="bg-gray-50/60 border border-gray-200/50 rounded-xl p-4">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
            <Tag className="w-4 h-4 text-gray-400" />
            キーワード
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {result.keywords.map((keyword, i) => (
              <span
                key={i}
                className="px-2.5 py-1 bg-gray-200/60 border border-gray-300/50 rounded-lg text-xs text-gray-700"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
