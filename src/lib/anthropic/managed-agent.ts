/**
 * Anthropic Managed Agents API ラッパー
 *
 * /v1/agents, /v1/environments, /v1/sessions を使って
 * クラウドサンドボックス内でフォーム送信を実行する。
 *
 * Beta: anthropic-beta: managed-agents-2026-04-01
 */

import { getAnthropicApiKey } from '@/lib/env'

const API_BASE = 'https://api.anthropic.com'
const BETA_HEADER = 'managed-agents-2026-04-01'
const AGENT_MODEL = 'claude-sonnet-4-6'

// ─── 型定義 ─────────────────────────────────────

interface AgentResponse {
  id: string
  type: 'agent'
  name: string
  model: { id: string }
  system: string
  tools: unknown[]
  created_at: string
}

interface EnvironmentResponse {
  id: string
  type: 'environment'
  name: string
  config: { type: string; networking: { type: string } }
  created_at: string
}

interface SessionResponse {
  id: string
  type: 'session'
  agent: string
  environment_id: string
  title: string
  created_at: string
}

interface StreamEvent {
  type: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export interface FormSubmissionRequest {
  companyUrl: string
  contactUrl?: string
  messageContent: string
  senderCompany: string
  senderName: string
  senderEmail: string
  senderPhone: string
  subject?: string
}

export interface FormSubmissionResult {
  result: 'success' | 'failed' | 'form_not_found' | 'manual'
  message: string
  contactUrl?: string
}

// ─── API ヘルパー ───────────────────────────────

function headers(): Record<string, string> {
  return {
    'x-api-key': getAnthropicApiKey(),
    'anthropic-version': '2023-06-01',
    'anthropic-beta': BETA_HEADER,
    'Content-Type': 'application/json',
  }
}

async function apiRequest<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const errorBody = await res.text()
    throw new Error(
      `Managed Agents API error (${res.status}): ${errorBody}`
    )
  }

  return res.json() as Promise<T>
}

// ─── Agent 管理 ──────────────────────────────────

const FORM_AGENT_SYSTEM = `あなたはフォーム送信エージェントです。企業のお問い合わせフォームにメッセージを送信してください。

## ツール使用方針
- web_fetch でページHTMLを取得し、フォーム構造を解析する
- bash (curl) でフォームデータをPOSTする
- 必ず結果を以下のJSON形式で最後に出力すること:
  {"result": "success|failed|form_not_found|manual", "message": "詳細"}

## フォーム探索手順
1. 指定されたURLにアクセスし、HTMLを取得
2. HTMLから「お問い合わせ」「contact」「inquiry」「toiawase」を含むリンクを探す
3. リンクが見つかったらそのページのHTMLを取得
4. 見つからない場合は以下のパスを順に試す:
   /contact, /contact/, /inquiry, /toiawase, /form, /contact-us

## フォーム送信手順
### Contact Form 7 (WordPress) の場合
HTMLに \`_wpcf7\` hidden fieldがある場合:
- formId を取得
- curl で /wp-json/contact-form-7/v1/contact-forms/{formId}/feedback にPOST
- FormDataとして各フィールドを送信
- レスポンスの status が "mail_sent" なら成功

### 通常のHTMLフォームの場合
- form の action URLを特定
- フィールドの name 属性をマッピング
- curl -X POST でフォームデータを送信
- レスポンスコードとHTML内容で成功/失敗を判定

## フィールドマッピング規則
| フォームのラベル/name | 入力する値 |
|---|---|
| company, 会社名, 法人名 | {sender_company} |
| name, お名前, 氏名, 担当者 | {sender_name} |
| email, メール, mail | {sender_email} |
| email_confirm, 確認 | {sender_email} (同じ値) |
| tel, 電話, phone | {sender_phone} |
| message, 本文, お問い合わせ内容, 備考 | {message_content} |
| subject, 件名 | {subject} |

## 注意事項
- reCAPTCHA v2（画像選択）がある場合は {"result": "manual", "message": "CAPTCHA検出"} を返す
- 送信成功時は {"result": "success", "message": "送信完了", "contactUrl": "フォームURL"} を返す
- フォームが見つからない場合は {"result": "form_not_found", "message": "..."} を返す
`

export async function getOrCreateAgent(): Promise<string> {
  // 環境変数に保存されたAgent IDがあればそれを使う
  const existingId = process.env.MANAGED_AGENT_ID
  if (existingId) {
    try {
      await apiRequest<AgentResponse>('GET', `/v1/agents/${existingId}`)
      return existingId
    } catch {
      // Agent が存在しない場合は新規作成
    }
  }

  const agent = await apiRequest<AgentResponse>('POST', '/v1/agents', {
    name: 'form-submission-agent',
    model: AGENT_MODEL,
    system: FORM_AGENT_SYSTEM,
    tools: [
      {
        type: 'agent_toolset_20260401',
        default_config: { enabled: false },
        configs: [
          { name: 'bash', enabled: true },
          { name: 'web_fetch', enabled: true },
          { name: 'web_search', enabled: true },
        ],
      },
    ],
  })

  console.log(`[ManagedAgent] Created agent: ${agent.id}`)
  return agent.id
}

// ─── Environment 管理 ────────────────────────────

export async function getOrCreateEnvironment(): Promise<string> {
  const existingId = process.env.MANAGED_ENVIRONMENT_ID
  if (existingId) {
    try {
      await apiRequest<EnvironmentResponse>(
        'GET',
        `/v1/environments/${existingId}`
      )
      return existingId
    } catch {
      // 存在しない場合は新規作成
    }
  }

  const env = await apiRequest<EnvironmentResponse>(
    'POST',
    '/v1/environments',
    {
      name: 'form-submission-env',
      config: {
        type: 'cloud',
        networking: { type: 'unrestricted' },
      },
    }
  )

  console.log(`[ManagedAgent] Created environment: ${env.id}`)
  return env.id
}

// ─── セッション実行 ──────────────────────────────

function buildTaskPrompt(req: FormSubmissionRequest): string {
  const targetUrl = req.contactUrl || req.companyUrl

  return `以下の企業にお問い合わせフォームからメッセージを送信してください。

## 送信先
- URL: ${targetUrl}
${req.contactUrl ? '- このURLは過去に発見済みのフォームページです。直接フォームを探してください。' : '- この企業HPからお問い合わせフォームを探してください。'}

## 送信者情報
- 会社名: ${req.senderCompany}
- 担当者名: ${req.senderName}
- メール: ${req.senderEmail}
- 電話: ${req.senderPhone}

## 送信内容
${req.subject ? `件名: ${req.subject}` : ''}
本文:
${req.messageContent}

---
上記の情報でフォーム送信を実行し、結果をJSON形式で報告してください。`
}

export async function runFormSubmission(
  req: FormSubmissionRequest
): Promise<FormSubmissionResult> {
  const agentId = await getOrCreateAgent()
  const environmentId = await getOrCreateEnvironment()

  // セッション作成
  const session = await apiRequest<SessionResponse>(
    'POST',
    '/v1/sessions',
    {
      agent: agentId,
      environment_id: environmentId,
      title: `form-send-${Date.now()}`,
    }
  )

  console.log(`[ManagedAgent] Created session: ${session.id}`)

  // タスク送信
  await apiRequest<void>(
    'POST',
    `/v1/sessions/${session.id}/events`,
    {
      events: [
        {
          type: 'user.message',
          content: [
            {
              type: 'text',
              text: buildTaskPrompt(req),
            },
          ],
        },
      ],
    }
  )

  // ストリーミングで結果を取得
  const result = await streamSessionResult(session.id)
  return result
}

async function streamSessionResult(
  sessionId: string
): Promise<FormSubmissionResult> {
  const res = await fetch(
    `${API_BASE}/v1/sessions/${sessionId}/stream`,
    {
      method: 'GET',
      headers: {
        ...headers(),
        Accept: 'text/event-stream',
      },
    }
  )

  if (!res.ok) {
    throw new Error(`Stream error (${res.status}): ${await res.text()}`)
  }

  const reader = res.body?.getReader()
  if (!reader) {
    throw new Error('No response body for stream')
  }

  const decoder = new TextDecoder()
  let fullText = ''
  const timeout = 120_000 // 2分タイムアウト
  const startTime = Date.now()

  try {
    while (true) {
      if (Date.now() - startTime > timeout) {
        throw new Error('Session timeout (120s)')
      }

      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue

        try {
          const event: StreamEvent = JSON.parse(line.slice(6))

          if (event.type === 'agent.message') {
            // テキストコンテンツを蓄積
            if (event.content) {
              for (const block of event.content) {
                if (block.type === 'text' && block.text) {
                  fullText += block.text
                }
              }
            }
          }

          if (event.type === 'session.status_idle') {
            // エージェントが完了
            break
          }
        } catch {
          // JSON パース失敗は無視
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  return parseAgentResult(fullText)
}

function parseAgentResult(text: string): FormSubmissionResult {
  // Agent の出力からJSON結果を抽出
  const jsonMatch = text.match(
    /\{[^{}]*"result"\s*:\s*"(?:success|failed|form_not_found|manual)"[^{}]*\}/
  )

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as FormSubmissionResult
      return {
        result: parsed.result,
        message: parsed.message || '',
        contactUrl: parsed.contactUrl,
      }
    } catch {
      // パース失敗 → フォールバック
    }
  }

  // JSON が見つからない場合、テキストから推測
  if (
    text.includes('mail_sent') ||
    text.includes('送信完了') ||
    text.includes('success')
  ) {
    return { result: 'success', message: 'エージェントが送信完了を報告' }
  }

  if (
    text.includes('form_not_found') ||
    text.includes('フォームが見つかりません')
  ) {
    return {
      result: 'form_not_found',
      message: 'フォームが見つかりませんでした',
    }
  }

  if (text.includes('CAPTCHA') || text.includes('captcha')) {
    return {
      result: 'manual',
      message: 'CAPTCHAが検出されました。手動対応が必要です。',
    }
  }

  return {
    result: 'failed',
    message: `エージェントの応答を解析できませんでした: ${text.substring(0, 200)}`,
  }
}
