'use client'

import { useState } from 'react'
import { X, Send, ExternalLink, Building2, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import type { SendQueueItem } from '@/types/sending'
import { markAsSent, markAsFailed } from '@/app/dashboard/sending/actions'

interface SendConfirmModalProps {
  item: SendQueueItem
  onClose: () => void
  onSent: (id: string) => void
}

export default function SendConfirmModal({ item, onClose, onSent }: SendConfirmModalProps) {
  const [step, setStep] = useState<'confirm' | 'sending' | 'success' | 'error'>('confirm')
  const [errorMsg, setErrorMsg] = useState('')
  const lead = item.lead

  const handleSend = async () => {
    setStep('sending')
    // Simulate a short delay to represent the "sending" action
    await new Promise(resolve => setTimeout(resolve, 1000))

    const { error } = await markAsSent(item.id)
    if (error) {
      await markAsFailed(item.id, error)
      setErrorMsg(error)
      setStep('error')
    } else {
      setStep('success')
    }
  }

  const handleSuccess = () => {
    onSent(item.id)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={step === 'confirm' ? onClose : undefined}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            {step === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : step === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-400" />
            ) : (
              <Send className="w-4 h-4 text-violet-400" />
            )}
            <h2 className="text-sm font-semibold text-white">
              {step === 'success'
                ? '送信完了'
                : step === 'error'
                ? '送信エラー'
                : step === 'sending'
                ? '送信中...'
                : '送信確認'}
            </h2>
          </div>
          {step !== 'sending' && (
            <button
              onClick={step === 'success' ? handleSuccess : onClose}
              className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-5 max-h-[70vh] overflow-y-auto space-y-4">

          {/* Success state */}
          {step === 'success' && (
            <div className="flex flex-col items-center py-6 gap-3">
              <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-white">送信完了しました</p>
                <p className="text-sm text-gray-500 mt-1">
                  {lead?.company_name ?? '企業'} への送信が完了し、リードのステータスを「送信済み」に更新しました。
                </p>
              </div>
            </div>
          )}

          {/* Error state */}
          {step === 'error' && (
            <div className="flex flex-col items-center py-4 gap-3">
              <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center">
                <AlertCircle className="w-7 h-7 text-red-400" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-white">送信に失敗しました</p>
                <p className="text-sm text-red-400 mt-1">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Sending state */}
          {step === 'sending' && (
            <div className="flex flex-col items-center py-8 gap-4">
              <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
              <p className="text-sm text-gray-400">送信処理中...</p>
            </div>
          )}

          {/* Confirm state */}
          {step === 'confirm' && (
            <>
              {/* Lead info */}
              {lead && (
                <div className="flex items-start gap-3 p-3 bg-gray-800/50 border border-gray-700/50 rounded-xl">
                  <div className="w-9 h-9 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-semibold text-gray-300">
                    {lead.company_name?.charAt(0) ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="text-sm font-semibold text-white">{lead.company_name}</p>
                    {lead.contact_name && (
                      <p className="text-xs text-gray-500">担当: {lead.contact_name}</p>
                    )}
                    {lead.website_url && (
                      <a
                        href={lead.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1"
                      >
                        <Building2 className="w-3 h-3" />
                        {lead.website_url}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Warning */}
              <div className="flex items-start gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300/90">
                  以下の文面を企業の問い合わせフォームから送信してください。送信後に「送信完了」ボタンを押すとステータスが更新されます。
                </p>
              </div>

              {/* Message content */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-gray-400">送信文面</p>
                  <button
                    onClick={() => navigator.clipboard.writeText(item.message_content)}
                    className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    コピー
                  </button>
                </div>
                <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-4">
                  <pre className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed font-sans">
                    {item.message_content}
                  </pre>
                </div>
              </div>

              {/* Open website button */}
              {lead?.website_url && (
                <a
                  href={lead.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm text-gray-300 font-medium rounded-xl transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  問い合わせページを開く
                </a>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-800">
          {step === 'confirm' && (
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-xl transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSend}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                送信完了とする
              </button>
            </div>
          )}

          {step === 'success' && (
            <button
              onClick={handleSuccess}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              閉じる
            </button>
          )}

          {step === 'error' && (
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-xl transition-colors"
              >
                閉じる
              </button>
              <button
                onClick={() => setStep('confirm')}
                className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                再試行
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
