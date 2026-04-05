/**
 * 一括生成のグローバルストア
 * ページ遷移してもコンポーネントがアンマウントされても生成が継続する
 */

import { addToQueue } from '@/app/dashboard/sending/actions'

export interface BulkResult {
  leadId: string
  companyName: string
  subject: string
  body: string
  error?: string
  saved?: boolean
  queued?: boolean
}

export interface BulkGenerateState {
  isGenerating: boolean
  progress: { total: number; completed: number }
  results: BulkResult[]
  batchInfo: { current: number; total: number } | null
}

const initialState: BulkGenerateState = {
  isGenerating: false,
  progress: { total: 0, completed: 0 },
  results: [],
  batchInfo: null,
}

// Module-level state（コンポーネントのライフサイクルに依存しない）
let state: BulkGenerateState = { ...initialState }
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((l) => l())
}

function setState(partial: Partial<BulkGenerateState>) {
  state = { ...state, ...partial }
  // localStorageにバックアップ（ページリロードでも復元可能）
  try {
    localStorage.setItem('bulk_generate_state', JSON.stringify(state))
  } catch { /* ignore */ }
  notify()
}

// 起動時にlocalStorageから復元
try {
  const saved = typeof window !== 'undefined' ? localStorage.getItem('bulk_generate_state') : null
  if (saved) {
    const parsed = JSON.parse(saved) as BulkGenerateState
    // 生成中だった場合は完了状態にリセット（fetchは復元できない）
    state = { ...parsed, isGenerating: false, batchInfo: null }
  }
} catch { /* ignore */ }

// useSyncExternalStore用
export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getSnapshot(): BulkGenerateState {
  return state
}

export function clearResults() {
  state = { ...initialState }
  try { localStorage.removeItem('bulk_generate_state') } catch { /* ignore */ }
  notify()
}

// 生成開始（モジュールレベルで実行、コンポーネント非依存）
export function startBulkGeneration(params: {
  leadIds: string[]
  tone: string
  customInstructions: string
  templateId?: string
  leads: Array<{ id: string; company_name: string }>
}) {
  // setTimeout でReactの実行コンテキストから完全に切り離す
  setTimeout(() => runGeneration(params), 0)
}

async function runGeneration(params: {
  leadIds: string[]
  tone: string
  customInstructions: string
  templateId?: string
  leads: Array<{ id: string; company_name: string }>
}) {
  const { leadIds, tone, customInstructions, templateId, leads } = params
  const BATCH_SIZE = 8
  const total = leadIds.length
  const batches: string[][] = []

  for (let i = 0; i < total; i += BATCH_SIZE) {
    batches.push(leadIds.slice(i, i + BATCH_SIZE))
  }

  setState({
    isGenerating: true,
    results: [],
    progress: { total, completed: 0 },
    batchInfo: batches.length > 1 ? { current: 1, total: batches.length } : null,
  })

  let totalCompleted = 0

  try {
    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batchLeadIds = batches[batchIdx]
      if (batches.length > 1) {
        setState({ batchInfo: { current: batchIdx + 1, total: batches.length } })
      }

      const res = await fetch('/api/generate-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadIds: batchLeadIds,
          tone,
          customInstructions,
          templateId: templateId || undefined,
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const reader = res.body?.getReader()
      if (!reader) throw new Error('ストリーム取得に失敗')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const data = JSON.parse(line)
            if (data.type === 'result') {
              const realLead = leads.find((l) => l.id === data.leadId)
              const newResult: BulkResult = {
                leadId: data.leadId,
                companyName: realLead?.company_name ?? data.companyName,
                subject: data.subject,
                body: data.body,
                error: data.error,
              }
              totalCompleted++
              setState({
                results: [...state.results, newResult],
                progress: { total, completed: totalCompleted },
              })

              // 1件完了ごとに即キュー追加
              if (!data.error && data.body) {
                addToQueue({
                  lead_id: data.leadId,
                  message_content: data.body,
                  subject: data.subject || undefined,
                }).then(({ error: qErr }) => {
                  if (!qErr) {
                    setState({
                      results: state.results.map((p) =>
                        p.leadId === data.leadId ? { ...p, queued: true } : p
                      ),
                    })
                  }
                })
              }
            }
          } catch {
            // Skip malformed lines
          }
        }
      }
    }
  } catch (err) {
    console.error('Bulk generate error:', err)
  } finally {
    setState({ isGenerating: false, batchInfo: null })
  }
}
