/**
 * 一括生成のグローバルストア
 * 中断されても自動再開する仕組み
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

// 生成ジョブのパラメータ（再開用）
interface GenerationJob {
  allLeadIds: string[]
  completedLeadIds: string[]
  tone: string
  customInstructions: string
  templateId?: string
  leads: Array<{ id: string; company_name: string }>
}

const initialState: BulkGenerateState = {
  isGenerating: false,
  progress: { total: 0, completed: 0 },
  results: [],
  batchInfo: null,
}

let state: BulkGenerateState = { ...initialState }
let restored = false
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((l) => l())
}

// クライアント側で確実にlocalStorageから復元する
function ensureRestored() {
  if (restored) return
  if (typeof window === 'undefined') return
  restored = true
  try {
    const saved = localStorage.getItem('bulk_generate_state')
    if (saved) {
      const parsed = JSON.parse(saved) as BulkGenerateState
      state = { ...parsed, isGenerating: false, batchInfo: null }
    }
  } catch { /* ignore */ }
}

function setState(partial: Partial<BulkGenerateState>) {
  ensureRestored()
  state = { ...state, ...partial }
  try {
    localStorage.setItem('bulk_generate_state', JSON.stringify(state))
  } catch { /* ignore */ }
  notify()
}

function saveJob(job: GenerationJob | null) {
  try {
    if (job) {
      localStorage.setItem('bulk_generate_job', JSON.stringify(job))
    } else {
      localStorage.removeItem('bulk_generate_job')
    }
  } catch { /* ignore */ }
}

function loadJob(): GenerationJob | null {
  try {
    const saved = localStorage.getItem('bulk_generate_job')
    return saved ? JSON.parse(saved) : null
  } catch { return null }
}

// 起動時にlocalStorageから復元（SSRでなければここで動く）
try {
  if (typeof window !== 'undefined') {
    ensureRestored()
  }
} catch { /* ignore */ }

// useSyncExternalStore用
export function subscribe(listener: () => void) {
  ensureRestored()
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getSnapshot(): BulkGenerateState {
  ensureRestored()
  return state
}

export function clearResults() {
  state = { ...initialState }
  saveJob(null)
  try {
    localStorage.removeItem('bulk_generate_state')
    localStorage.removeItem('bulk_generate_job')
  } catch { /* ignore */ }
  notify()
}

// 未完了のジョブがあるか確認
export function hasPendingJob(): boolean {
  const job = loadJob()
  if (!job) return false
  return job.completedLeadIds.length < job.allLeadIds.length
}

// 未完了のジョブの残り件数を取得
export function getPendingCount(): number {
  const job = loadJob()
  if (!job) return 0
  return job.allLeadIds.length - job.completedLeadIds.length
}

// 未完了のジョブを再開
export function resumeGeneration() {
  const job = loadJob()
  if (!job) return

  const remainingIds = job.allLeadIds.filter(
    (id) => !job.completedLeadIds.includes(id)
  )

  if (remainingIds.length === 0) {
    saveJob(null)
    return
  }

  // 既存の結果を保持したまま残りを生成
  runGeneration({
    leadIds: remainingIds,
    tone: job.tone,
    customInstructions: job.customInstructions,
    templateId: job.templateId,
    leads: job.leads,
  }, true)
}

// 生成開始
export function startBulkGeneration(params: {
  leadIds: string[]
  tone: string
  customInstructions: string
  templateId?: string
  leads: Array<{ id: string; company_name: string }>
}) {
  runGeneration(params, false)
}

async function runGeneration(
  params: {
    leadIds: string[]
    tone: string
    customInstructions: string
    templateId?: string
    leads: Array<{ id: string; company_name: string }>
  },
  isResume: boolean
) {
  const { leadIds, tone, customInstructions, templateId, leads } = params
  const BATCH_SIZE = 8
  const total = isResume ? (state.progress.total || leadIds.length) : leadIds.length
  const batches: string[][] = []

  for (let i = 0; i < leadIds.length; i += BATCH_SIZE) {
    batches.push(leadIds.slice(i, i + BATCH_SIZE))
  }

  // ジョブを保存（再開用）
  const existingJob = loadJob()
  const job: GenerationJob = {
    allLeadIds: isResume && existingJob ? existingJob.allLeadIds : leadIds,
    completedLeadIds: isResume && existingJob ? existingJob.completedLeadIds : [],
    tone,
    customInstructions,
    templateId,
    leads,
  }
  saveJob(job)

  const startCompleted = isResume ? state.progress.completed : 0

  setState({
    isGenerating: true,
    results: isResume ? state.results : [],
    progress: { total, completed: startCompleted },
    batchInfo: batches.length > 1 ? { current: 1, total: batches.length } : null,
  })

  let totalCompleted = startCompleted

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

              // ジョブの完了リストを更新
              job.completedLeadIds.push(data.leadId)
              saveJob(job)

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
    // 全件完了 → ジョブをクリア
    saveJob(null)
  } catch (err) {
    console.error('Bulk generate error:', err)
    // 中断された → ジョブは保持（再開可能）
  } finally {
    setState({ isGenerating: false, batchInfo: null })
  }
}
