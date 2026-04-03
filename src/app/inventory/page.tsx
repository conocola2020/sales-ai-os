'use client'

import { useState, useEffect, useCallback } from 'react'
import type { InventoryItem } from '@/types/inventory'
import {
  getInventory,
  updateStock,
  addItem,
  updateItem,
  deleteItem,
} from './actions'

// ─── PIN Auth Gate ───────────────────────────────────────────

function PinGate({ onAuth }: { onAuth: () => void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Verify PIN via API to avoid exposing env var on client
    const res = await fetch('/api/inventory/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    })

    if (res.ok) {
      sessionStorage.setItem('inventory_auth', '1')
      onAuth()
    } else {
      setError('PINが正しくありません')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-sm space-y-6"
      >
        <div className="text-center">
          <div className="text-4xl mb-3">📦</div>
          <h1 className="text-xl font-bold text-white">在庫管理</h1>
          <p className="text-gray-400 text-sm mt-1">PINを入力してください</p>
        </div>
        <input
          type="password"
          inputMode="numeric"
          maxLength={8}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="PIN"
          autoFocus
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-center text-white text-2xl tracking-[0.5em] placeholder:text-gray-500 placeholder:tracking-normal placeholder:text-base focus:outline-none focus:border-violet-500"
        />
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        <button
          type="submit"
          disabled={loading || !pin}
          className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors"
        >
          {loading ? '確認中...' : 'ログイン'}
        </button>
      </form>
    </div>
  )
}

// ─── Item Form Modal ─────────────────────────────────────────

type FormData = Omit<InventoryItem, 'id' | 'updated_at'>

const emptyForm: FormData = {
  name: '',
  category: '',
  unit: '個',
  note: '',
  shop: 0,
  workshop: 0,
  min_stock: 0,
}

function ItemFormModal({
  item,
  onClose,
  onSave,
}: {
  item: InventoryItem | null
  onClose: () => void
  onSave: (data: FormData, id?: number) => Promise<void>
}) {
  const [form, setForm] = useState<FormData>(
    item
      ? {
          name: item.name,
          category: item.category,
          unit: item.unit,
          note: item.note,
          shop: item.shop,
          workshop: item.workshop,
          min_stock: item.min_stock,
        }
      : { ...emptyForm }
  )
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    await onSave(form, item?.id)
    setSaving(false)
    onClose()
  }

  const set = (key: keyof FormData, value: string | number) =>
    setForm((p) => ({ ...p, [key]: value }))

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md space-y-4"
      >
        <h2 className="text-lg font-bold text-white">
          {item ? '商品を編集' : '新しい商品を追加'}
        </h2>

        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-400">商品名 *</label>
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white mt-1 focus:outline-none focus:border-violet-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-400">カテゴリ</label>
              <input
                value={form.category}
                onChange={(e) => set('category', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white mt-1 focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400">単位</label>
              <input
                value={form.unit}
                onChange={(e) => set('unit', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white mt-1 focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-400">備考</label>
            <input
              value={form.note}
              onChange={(e) => set('note', e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white mt-1 focus:outline-none focus:border-violet-500"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-sm text-gray-400">店舗在庫</label>
              <input
                type="number"
                min={0}
                value={form.shop}
                onChange={(e) => set('shop', parseInt(e.target.value) || 0)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white mt-1 focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400">工房在庫</label>
              <input
                type="number"
                min={0}
                value={form.workshop}
                onChange={(e) => set('workshop', parseInt(e.target.value) || 0)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white mt-1 focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400">最低在庫</label>
              <input
                type="number"
                min={0}
                value={form.min_stock}
                onChange={(e) => set('min_stock', parseInt(e.target.value) || 0)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white mt-1 focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2.5 rounded-xl transition-colors"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={saving || !form.name.trim()}
            className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white py-2.5 rounded-xl transition-colors"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Main Inventory Page ─────────────────────────────────────

export default function InventoryPage() {
  const [authed, setAuthed] = useState(false)
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<InventoryItem | null>(null)
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  // Check sessionStorage auth on mount
  useEffect(() => {
    if (sessionStorage.getItem('inventory_auth') === '1') {
      setAuthed(true)
    }
  }, [])

  const fetchItems = useCallback(async () => {
    try {
      const data = await getInventory()
      setItems(data)
    } catch (err) {
      console.error('Failed to fetch inventory:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authed) fetchItems()
  }, [authed, fetchItems])

  if (!authed) return <PinGate onAuth={() => setAuthed(true)} />

  const categories = ['all', ...new Set(items.map((i) => i.category).filter(Boolean))]

  const filtered = items.filter((item) => {
    const matchesText =
      !filter ||
      item.name.toLowerCase().includes(filter.toLowerCase()) ||
      item.note.toLowerCase().includes(filter.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter
    return matchesText && matchesCategory
  })

  const alertCount = items.filter(
    (i) => i.min_stock > 0 && i.shop + i.workshop <= i.min_stock
  ).length

  const handleStockChange = async (
    id: number,
    location: 'shop' | 'workshop',
    delta: number
  ) => {
    setActionLoading(id)
    try {
      await updateStock(id, location, delta)
      await fetchItems()
    } catch (err) {
      console.error('Stock update failed:', err)
    }
    setActionLoading(null)
  }

  const handleSave = async (data: FormData, id?: number) => {
    if (id) {
      await updateItem(id, data)
    } else {
      await addItem(data)
    }
    await fetchItems()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('この商品を削除しますか？')) return
    setActionLoading(id)
    try {
      await deleteItem(id)
      await fetchItems()
    } catch (err) {
      console.error('Delete failed:', err)
    }
    setActionLoading(null)
  }

  const isLowStock = (item: InventoryItem) =>
    item.min_stock > 0 && item.shop + item.workshop <= item.min_stock

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="sticky top-0 bg-gray-950/95 backdrop-blur border-b border-gray-800 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📦</span>
              <h1 className="text-xl font-bold">在庫管理</h1>
              {alertCount > 0 && (
                <span className="bg-red-500/20 text-red-400 text-xs font-medium px-2 py-0.5 rounded-full">
                  {alertCount}件 在庫不足
                </span>
              )}
            </div>
            <button
              onClick={() => {
                setEditItem(null)
                setShowForm(true)
              }}
              className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
            >
              + 追加
            </button>
          </div>

          {/* Search + Category Filter */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="検索..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-violet-500"
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === 'all' ? '全カテゴリ' : c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Item List */}
      <div className="max-w-4xl mx-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="text-center text-gray-500 py-20">読み込み中...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-500 py-20">
            {items.length === 0 ? '商品がありません。「+ 追加」から登録してください。' : '該当する商品がありません'}
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className={`bg-gray-900 border rounded-xl p-4 transition-colors ${
                isLowStock(item)
                  ? 'border-red-500/50 bg-red-500/5'
                  : 'border-gray-800'
              }`}
            >
              {/* Item Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{item.name}</span>
                    {item.category && (
                      <span className="bg-gray-800 text-gray-400 text-xs px-2 py-0.5 rounded">
                        {item.category}
                      </span>
                    )}
                    {isLowStock(item) && (
                      <span className="text-red-400 text-xs font-medium">
                        在庫不足
                      </span>
                    )}
                  </div>
                  {item.note && (
                    <p className="text-gray-500 text-xs mt-0.5">{item.note}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setEditItem(item)
                      setShowForm(true)
                    }}
                    className="text-gray-500 hover:text-white text-sm px-2 py-1 rounded transition-colors"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-gray-500 hover:text-red-400 text-sm px-2 py-1 rounded transition-colors"
                  >
                    削除
                  </button>
                </div>
              </div>

              {/* Stock Controls */}
              <div className="grid grid-cols-2 gap-3">
                {(['shop', 'workshop'] as const).map((loc) => (
                  <div
                    key={loc}
                    className="bg-gray-800/50 rounded-lg p-3 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs text-gray-400">
                        {loc === 'shop' ? '店舗' : '工房'}
                      </div>
                      <div className="text-lg font-bold text-white">
                        {item[loc]}
                        <span className="text-xs text-gray-500 ml-1">
                          {item.unit}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        disabled={actionLoading === item.id || item[loc] <= 0}
                        onClick={() => handleStockChange(item.id, loc, -1)}
                        className="w-8 h-8 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white text-lg flex items-center justify-center transition-colors"
                      >
                        -
                      </button>
                      <button
                        disabled={actionLoading === item.id}
                        onClick={() => handleStockChange(item.id, loc, 1)}
                        className="w-8 h-8 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white text-lg flex items-center justify-center transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Min stock info */}
              {item.min_stock > 0 && (
                <div className="mt-2 text-xs text-gray-500">
                  合計: {item.shop + item.workshop}{item.unit} / 最低: {item.min_stock}{item.unit}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <ItemFormModal
          item={editItem}
          onClose={() => {
            setShowForm(false)
            setEditItem(null)
          }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
