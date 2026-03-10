'use client'

import { useRef, useState } from 'react'
import { Upload, X, FileText, AlertCircle, CheckCircle2, Download, Loader2 } from 'lucide-react'
import { bulkCreateLeads } from '@/app/dashboard/leads/actions'
import type { LeadInsert } from '@/types/leads'

interface CSVImportProps {
  onClose: () => void
  onSuccess: (count: number) => void
}

// CSV ヘッダーと DB カラムのマッピング
const HEADER_MAP: Record<string, keyof LeadInsert> = {
  '会社名':     'company_name',
  company_name: 'company_name',
  '担当者名':   'contact_name',
  contact_name: 'contact_name',
  'メールアドレス': 'email',
  email:        'email',
  '電話番号':   'phone',
  phone:        'phone',
  'URL':        'website_url',
  website_url:  'website_url',
  '業種':       'industry',
  industry:     'industry',
  'ステータス': 'status',
  status:       'status',
  'メモ':       'notes',
  notes:        'notes',
}

function parseCSV(text: string): LeadInsert[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []

  // BOM 除去
  const rawHeaders = lines[0].replace(/^\uFEFF/, '').split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
  const colMap: { idx: number; field: keyof LeadInsert }[] = []

  rawHeaders.forEach((h, idx) => {
    const field = HEADER_MAP[h]
    if (field) colMap.push({ idx, field })
  })

  const leads: LeadInsert[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCSVLine(lines[i])
    const lead: Partial<LeadInsert> = { status: '未着手' }
    colMap.forEach(({ idx, field }) => {
      const val = cells[idx]?.trim().replace(/^"|"$/g, '') ?? ''
      if (val) (lead as Record<string, string>)[field] = val
    })
    if (lead.company_name) leads.push(lead as LeadInsert)
  }
  return leads
}

function splitCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current); current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

const SAMPLE_CSV = `会社名,担当者名,メールアドレス,電話番号,URL,業種,ステータス,メモ
株式会社サンプル,山田太郎,yamada@sample.co.jp,03-1234-5678,https://sample.co.jp,IT・ソフトウェア,未着手,
テスト商事,鈴木花子,suzuki@test.co.jp,06-9876-5432,https://test.co.jp,製造業,未着手,重要顧客候補`

export default function CSVImport({ onClose, onSuccess }: CSVImportProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<LeadInsert[]>([])
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = (file: File) => {
    setError('')
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const rows = parseCSV(text)
      if (rows.length === 0) {
        setError('有効なデータが見つかりませんでした。ヘッダー行と「会社名」列が必要です。')
        setPreview([])
      } else {
        setPreview(rows)
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file?.name.endsWith('.csv')) handleFile(file)
    else setError('CSVファイルのみアップロード可能です')
  }

  const handleImport = async () => {
    if (!preview.length) return
    setLoading(true)
    try {
      // 500件ずつAPIに送信
      const CHUNK = 500
      let total = 0
      for (let i = 0; i < preview.length; i += CHUNK) {
        const res = await fetch('/api/leads/bulk-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leads: preview.slice(i, i + CHUNK) }),
        })
        const data = await res.json()
        if (!res.ok) { setError(`インポートエラー: ${data.error}`); setLoading(false); return }
        total += data.count
      }
      setLoading(false)
      onSuccess(total)
    } catch (e: any) {
      setLoading(false)
      setError(`インポートエラー: ${e.message}`)
    }
  }

  const downloadSample = () => {
    const blob = new Blob(['\uFEFF' + SAMPLE_CSV], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'leads_sample.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-violet-500/10 border border-violet-500/20 rounded-xl flex items-center justify-center">
              <Upload className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">CSVインポート</h2>
              <p className="text-xs text-gray-500">CSV形式でリードを一括登録</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Sample download */}
          <div className="flex items-center justify-between bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-300">サンプルCSVをダウンロード</span>
            </div>
            <button
              onClick={downloadSample}
              className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 font-medium transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              ダウンロード
            </button>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
              ${dragOver ? 'border-violet-500 bg-violet-500/5' : 'border-gray-700 hover:border-gray-600 hover:bg-gray-800/30'}`}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
            <Upload className="w-8 h-8 text-gray-500 mx-auto mb-3" />
            {fileName ? (
              <>
                <p className="text-sm font-medium text-violet-400">{fileName}</p>
                <p className="text-xs text-gray-500 mt-1">クリックして変更</p>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-300">CSVファイルをドロップ、またはクリックして選択</p>
                <p className="text-xs text-gray-500 mt-1">UTF-8 / Shift-JIS 対応</p>
              </>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Preview */}
          {preview.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-medium text-white">{preview.length}件 検出</span>
                </div>
                <span className="text-xs text-gray-500">プレビュー（最大5件表示）</span>
              </div>
              <div className="border border-gray-800 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-800/60">
                      {['会社名', '担当者', 'メール', '業種', 'ステータス'].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-left text-gray-400 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-t border-gray-800/60 hover:bg-gray-800/30">
                        <td className="px-3 py-2 text-gray-200 font-medium truncate max-w-[120px]">{row.company_name}</td>
                        <td className="px-3 py-2 text-gray-400 truncate max-w-[80px]">{row.contact_name || '—'}</td>
                        <td className="px-3 py-2 text-gray-400 truncate max-w-[120px]">{row.email || '—'}</td>
                        <td className="px-3 py-2 text-gray-400 truncate max-w-[80px]">{row.industry || '—'}</td>
                        <td className="px-3 py-2">
                          <span className="px-1.5 py-0.5 bg-gray-700/50 text-gray-300 rounded text-xs">{row.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 5 && (
                  <div className="px-3 py-2 text-xs text-gray-500 border-t border-gray-800/60 text-center">
                    + {preview.length - 5}件 (非表示)
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-800">
          <p className="text-xs text-gray-500">
            必須: 会社名列。対応列: 担当者名/メール/電話/URL/業種/ステータス/メモ
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 border border-gray-700 rounded-xl transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleImport}
              disabled={!preview.length || loading}
              className="flex items-center gap-2 px-5 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {loading ? 'インポート中...' : `${preview.length}件インポート`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
