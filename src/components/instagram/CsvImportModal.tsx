'use client'

import { useState, useCallback } from 'react'
import { X, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { bulkCreateTargets } from '@/app/dashboard/instagram/actions'
import type { InstagramTargetInsert } from '@/types/instagram'

interface CsvImportModalProps {
  onClose: () => void
  onImported: (count: number) => void
}

export default function CsvImportModal({ onClose, onImported }: CsvImportModalProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload')
  const [rows, setRows] = useState<InstagramTargetInsert[]>([])
  const [error, setError] = useState('')
  const [importedCount, setImportedCount] = useState(0)
  const [dragOver, setDragOver] = useState(false)

  const parseCSV = useCallback((text: string) => {
    const lines = text.trim().split('\n')
    if (lines.length < 2) {
      setError('CSVファイルにヘッダーとデータが必要です')
      return
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))
    const usernameIdx = headers.findIndex(h => h === 'username' || h === 'ユーザー名')
    if (usernameIdx === -1) {
      setError('username列が見つかりません。ヘッダーに "username" を含めてください。')
      return
    }

    const displayNameIdx = headers.findIndex(h => h === 'display_name' || h === '表示名')
    const bioIdx = headers.findIndex(h => h === 'bio' || h === 'プロフィール')
    const industryIdx = headers.findIndex(h => h === 'industry' || h === '業種')
    const followerIdx = headers.findIndex(h => h === 'follower_count' || h === 'フォロワー数')
    const notesIdx = headers.findIndex(h => h === 'notes' || h === 'メモ')

    const parsed: InstagramTargetInsert[] = []
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''))
      const username = cols[usernameIdx]?.trim()
      if (!username) continue

      parsed.push({
        username,
        display_name: displayNameIdx >= 0 ? cols[displayNameIdx] || null : null,
        bio: bioIdx >= 0 ? cols[bioIdx] || null : null,
        industry: industryIdx >= 0 ? cols[industryIdx] || null : null,
        follower_count: followerIdx >= 0 ? parseInt(cols[followerIdx]) || null : null,
        notes: notesIdx >= 0 ? cols[notesIdx] || null : null,
      })
    }

    if (parsed.length === 0) {
      setError('有効なデータが見つかりません')
      return
    }

    setRows(parsed)
    setError('')
    setStep('preview')
  }, [])

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setError('CSVファイルを選択してください')
      return
    }
    const reader = new FileReader()
    reader.onload = e => parseCSV(e.target?.result as string)
    reader.readAsText(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleImport = async () => {
    setStep('importing')
    const { count, error } = await bulkCreateTargets(rows)
    if (error) {
      setError(error)
      setStep('preview')
    } else {
      setImportedCount(count)
      setStep('done')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-white">CSVインポート</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {step === 'upload' && (
            <>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                  dragOver ? 'border-violet-500 bg-violet-500/5' : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <Upload className="w-8 h-8 text-gray-500 mx-auto mb-3" />
                <p className="text-sm text-gray-400 mb-2">CSVファイルをドラッグ&ドロップ</p>
                <label className="text-xs text-violet-400 hover:text-violet-300 cursor-pointer">
                  またはファイルを選択
                  <input type="file" accept=".csv" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
                </label>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3">
                <p className="text-xs text-gray-400 font-medium mb-1">CSVフォーマット:</p>
                <code className="text-xs text-gray-500">username, display_name, bio, industry, follower_count, notes</code>
              </div>
            </>
          )}

          {step === 'preview' && (
            <>
              <div className="flex items-center gap-2 p-3 bg-violet-500/10 border border-violet-500/20 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-violet-400" />
                <span className="text-sm text-violet-300">{rows.length}件のターゲットを検出</span>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {rows.slice(0, 20).map((row, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 bg-gray-800/50 rounded-lg text-xs">
                    <span className="text-violet-400 font-medium">@{row.username}</span>
                    {row.display_name && <span className="text-gray-400">{row.display_name}</span>}
                    {row.industry && <span className="text-gray-500">{row.industry}</span>}
                  </div>
                ))}
                {rows.length > 20 && (
                  <p className="text-xs text-gray-500 text-center py-2">他 {rows.length - 20}件...</p>
                )}
              </div>
            </>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center py-8 gap-4">
              <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
              <p className="text-sm text-gray-400">インポート中...</p>
            </div>
          )}

          {step === 'done' && (
            <div className="flex flex-col items-center py-6 gap-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              <p className="text-sm font-semibold text-white">{importedCount}件をインポートしました</p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-xs text-red-400">{error}</span>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-800 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-xl transition-colors">
            {step === 'done' ? '閉じる' : 'キャンセル'}
          </button>
          {step === 'preview' && (
            <button onClick={handleImport} className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors">
              インポート実行
            </button>
          )}
          {step === 'done' && (
            <button onClick={() => { onImported(importedCount); onClose() }} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors">
              完了
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
