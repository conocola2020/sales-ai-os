'use client'

import { useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Upload,
  Camera,
  Loader2,
  CheckCircle2,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
  ReceiptText,
} from 'lucide-react'
import clsx from 'clsx'

interface ReceiptItem {
  item_name: string
  amount: number
  expense_category: string
}

interface OcrResult {
  receipt_date: string
  store_name: string
  items: ReceiptItem[]
  total_amount: number
}

const EXPENSE_CATEGORIES = [
  '食費',
  '交通費',
  '消耗品',
  '交際費',
  '通信費',
  '書籍・資料費',
  '会議費',
  'その他',
]

type Step = 'upload' | 'processing' | 'review' | 'saved'

export default function ReceiptPage() {
  const [step, setStep] = useState<Step>('upload')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null)
  const [editedDate, setEditedDate] = useState('')
  const [editedStore, setEditedStore] = useState('')
  const [editedItems, setEditedItems] = useState<ReceiptItem[]>([])
  const [categoryType, setCategoryType] = useState<'business' | 'personal'>('business')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('画像ファイルを選択してください')
      return
    }
    setError(null)
    setSelectedFile(file)
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileSelect(file)
  }

  const handleOcr = async () => {
    if (!selectedFile) return
    setStep('processing')
    setError(null)

    try {
      const formData = new FormData()
      formData.append('image', selectedFile)

      const res = await fetch('/api/ocr-receipt', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok || data.error) {
        throw new Error(data.error || 'OCRに失敗しました')
      }

      const result: OcrResult = data.result
      setOcrResult(result)
      setEditedDate(result.receipt_date || '')
      setEditedStore(result.store_name || '')
      setEditedItems(result.items || [])
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OCRに失敗しました')
      setStep('upload')
    }
  }

  const totalAmount = editedItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

  const handleAddItem = () => {
    setEditedItems(prev => [...prev, { item_name: '', amount: 0, expense_category: 'その他' }])
  }

  const handleRemoveItem = (index: number) => {
    setEditedItems(prev => prev.filter((_, i) => i !== index))
  }

  const handleItemChange = (index: number, field: keyof ReceiptItem, value: string | number) => {
    setEditedItems(prev =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    )
  }

  const handleSave = async () => {
    if (!editedDate || !editedStore) {
      setError('日付と店名を入力してください')
      return
    }
    setIsSaving(true)
    setError(null)

    try {
      const supabase = createClient()

      // Upload image to Supabase Storage (best effort)
      let imageUrl: string | null = null
      if (selectedFile) {
        const ext = selectedFile.name.split('.').pop() || 'jpg'
        const path = `${Date.now()}.${ext}`
        const { data: uploadData } = await supabase.storage
          .from('receipt-images')
          .upload(path, selectedFile, { upsert: false })
        if (uploadData) {
          const { data: urlData } = supabase.storage
            .from('receipt-images')
            .getPublicUrl(uploadData.path)
          imageUrl = urlData.publicUrl
        }
      }

      // Insert receipt
      const { data: receipt, error: receiptError } = await supabase
        .from('receipts')
        .insert({
          receipt_date: editedDate,
          store_name: editedStore,
          total_amount: totalAmount,
          category_type: categoryType,
          image_url: imageUrl,
        })
        .select('id')
        .single()

      if (receiptError) throw receiptError

      // Insert items
      if (editedItems.length > 0) {
        const { error: itemsError } = await supabase.from('receipt_items').insert(
          editedItems.map(item => ({
            receipt_id: receipt.id,
            item_name: item.item_name || '不明',
            amount: Number(item.amount) || 0,
            expense_category: item.expense_category || 'その他',
          }))
        )
        if (itemsError) throw itemsError
      }

      setStep('saved')
    } catch (err) {
      console.error(err)
      setError('保存に失敗しました。Supabaseの設定を確認してください。')
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    setStep('upload')
    setPreviewUrl(null)
    setSelectedFile(null)
    setOcrResult(null)
    setEditedDate('')
    setEditedStore('')
    setEditedItems([])
    setCategoryType('business')
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="min-h-full bg-gray-950 px-4 py-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <ReceiptText className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">レシート読み取り</h1>
        </div>
        <p className="text-sm text-gray-500 ml-12">AIがレシートから経費データを自動抽出します</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-8">
        {(['upload', 'processing', 'review', 'saved'] as Step[]).map((s, i) => {
          const labels = ['アップロード', '読み取り中', '確認・編集', '保存完了']
          const isActive = step === s
          const isDone =
            ['upload', 'processing', 'review', 'saved'].indexOf(step) >
            ['upload', 'processing', 'review', 'saved'].indexOf(s)
          return (
            <div key={s} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={clsx(
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                    isActive
                      ? 'bg-emerald-500 text-white'
                      : isDone
                        ? 'bg-emerald-500/30 text-emerald-400'
                        : 'bg-gray-800 text-gray-600'
                  )}
                >
                  {isDone ? '✓' : i + 1}
                </div>
                <span
                  className={clsx(
                    'text-[10px] mt-1 whitespace-nowrap',
                    isActive ? 'text-emerald-400' : isDone ? 'text-emerald-600' : 'text-gray-600'
                  )}
                >
                  {labels[i]}
                </span>
              </div>
              {i < 3 && (
                <div
                  className={clsx(
                    'w-8 h-px mb-4 mx-1',
                    isDone ? 'bg-emerald-500/40' : 'bg-gray-800'
                  )}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Step: Upload */}
      {step === 'upload' && (
        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleInputChange}
            className="hidden"
            id="receipt-upload"
          />

          {previewUrl ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="レシートプレビュー"
                className="w-full max-h-80 object-contain rounded-2xl border border-gray-800 bg-gray-900"
              />
              <button
                onClick={() => {
                  setPreviewUrl(null)
                  setSelectedFile(null)
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}
                className="absolute top-2 right-2 w-7 h-7 bg-gray-900/80 border border-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:text-white"
              >
                ×
              </button>
            </div>
          ) : (
            <div
              onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={clsx(
                'border-2 border-dashed rounded-2xl p-8 flex flex-col items-center gap-4 cursor-pointer transition-all',
                isDragOver
                  ? 'border-emerald-500 bg-emerald-500/5'
                  : 'border-gray-700 hover:border-gray-600 bg-gray-900/40'
              )}
            >
              <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center">
                <Upload className="w-7 h-7 text-gray-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-300">画像をアップロード</p>
                <p className="text-xs text-gray-600 mt-1">タップしてカメラ・アルバムから選択</p>
              </div>
            </div>
          )}

          {/* Camera / Library buttons */}
          <div className="grid grid-cols-2 gap-3">
            <label
              htmlFor="receipt-upload-camera"
              className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-sm text-gray-300 hover:bg-gray-800 cursor-pointer transition-colors"
            >
              <Camera className="w-4 h-4 text-gray-500" />
              カメラで撮影
              <input
                id="receipt-upload-camera"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleInputChange}
                className="hidden"
              />
            </label>
            <label
              htmlFor="receipt-upload-library"
              className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-sm text-gray-300 hover:bg-gray-800 cursor-pointer transition-colors"
            >
              <Upload className="w-4 h-4 text-gray-500" />
              アルバムから
              <input
                id="receipt-upload-library"
                type="file"
                accept="image/*"
                onChange={handleInputChange}
                className="hidden"
              />
            </label>
          </div>

          <button
            onClick={handleOcr}
            disabled={!selectedFile}
            className={clsx(
              'w-full py-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all',
              selectedFile
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                : 'bg-gray-800 text-gray-600 cursor-not-allowed'
            )}
          >
            AIで読み取り開始
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Step: Processing */}
      {step === 'processing' && (
        <div className="flex flex-col items-center gap-6 py-12">
          <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center">
            <Loader2 className="w-9 h-9 text-emerald-400 animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-gray-200">AIがレシートを読み取っています</p>
            <p className="text-sm text-gray-500 mt-1">しばらくお待ちください...</p>
          </div>
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="処理中"
              className="w-full max-h-48 object-contain rounded-xl border border-gray-800 opacity-40"
            />
          )}
        </div>
      )}

      {/* Step: Review */}
      {step === 'review' && ocrResult && (
        <div className="space-y-5">
          {/* Category type selector */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              振り分け先
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { value: 'business', label: '事業用（日次入力）', color: 'violet' },
                  { value: 'personal', label: '個人生活費', color: 'amber' },
                ] as const
              ).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setCategoryType(opt.value)}
                  className={clsx(
                    'px-3 py-3 rounded-xl text-sm font-medium border transition-all',
                    categoryType === opt.value
                      ? opt.color === 'violet'
                        ? 'bg-violet-600/20 border-violet-500/40 text-violet-300'
                        : 'bg-amber-600/20 border-amber-500/40 text-amber-300'
                      : 'bg-gray-800/50 border-gray-700/50 text-gray-500 hover:text-gray-300'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Store & Date */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">基本情報</p>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">店名</label>
                <div className="relative">
                  <input
                    type="text"
                    value={editedStore}
                    onChange={e => setEditedStore(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 pr-8 focus:outline-none focus:border-emerald-500/50"
                  />
                  <Pencil className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-600" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">日付</label>
                <div className="relative">
                  <input
                    type="date"
                    value={editedDate}
                    onChange={e => setEditedDate(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 pr-8 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">品目</p>
              <button
                onClick={handleAddItem}
                className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <Plus className="w-3 h-3" />
                追加
              </button>
            </div>
            <div className="space-y-3">
              {editedItems.map((item, index) => (
                <div key={index} className="bg-gray-800/50 rounded-xl p-3 space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={item.item_name}
                      onChange={e => handleItemChange(index, 'item_name', e.target.value)}
                      placeholder="品目名"
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-emerald-500/50 min-w-0"
                    />
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={item.amount}
                        onChange={e => handleItemChange(index, 'amount', Number(e.target.value))}
                        className="w-24 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 text-right focus:outline-none focus:border-emerald-500/50"
                      />
                      <span className="text-sm text-gray-500">円</span>
                    </div>
                    <button
                      onClick={() => handleRemoveItem(index)}
                      className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <select
                    value={item.expense_category}
                    onChange={e => handleItemChange(index, 'expense_category', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-400 focus:outline-none focus:border-emerald-500/50"
                  >
                    {EXPENSE_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              {editedItems.length === 0 && (
                <p className="text-xs text-gray-600 text-center py-2">
                  品目がありません。「追加」から入力してください
                </p>
              )}
            </div>

            {/* Total */}
            <div className="mt-4 pt-3 border-t border-gray-700/50 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-400">合計</span>
              <span className="text-lg font-bold text-white">
                ¥{totalAmount.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={clsx(
              'w-full py-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all',
              isSaving
                ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
            )}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                Supabaseに保存
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>

          <button
            onClick={handleReset}
            className="w-full py-3 text-sm text-gray-600 hover:text-gray-400 transition-colors"
          >
            最初からやり直す
          </button>
        </div>
      )}

      {/* Step: Saved */}
      {step === 'saved' && (
        <div className="flex flex-col items-center gap-6 py-12 text-center">
          <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-white">保存しました！</p>
            <p className="text-sm text-gray-500 mt-1">
              {editedStore} のレシートを
              {categoryType === 'business' ? '事業用（日次入力）' : '個人生活費'}
              として保存しました
            </p>
            <p className="text-base font-semibold text-emerald-400 mt-3">
              ¥{totalAmount.toLocaleString()}
            </p>
          </div>
          <button
            onClick={handleReset}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-emerald-500/20 transition-all"
          >
            別のレシートを読み取る
          </button>
        </div>
      )}
    </div>
  )
}
