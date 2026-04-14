import ComposePage from '@/components/compose/ComposePage'
import { getLeadOptions } from '@/app/dashboard/leads/actions'
import { getMessages, getQueuedLeadStatuses } from './actions'
import { getTemplates, seedDefaultTemplates } from '@/app/dashboard/settings/actions'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ leadId?: string; mode?: string; leads?: string }>
}

export default async function ComposePageRoute({ searchParams }: Props) {
  const [leadsResult, messagesResult, templatesResult, queuedResult, params] = await Promise.all([
    getLeadOptions(),
    getMessages(),
    getTemplates(),
    getQueuedLeadStatuses(),
    searchParams,
  ])

  const leads = leadsResult.data ?? []
  const messages = messagesResult.data ?? []
  let templates = templatesResult.data ?? []
  const queuedStatuses = queuedResult.data ?? []
  // API側でデモ判定するため、ページ側では常にfalse
  const isDemo = false

  // テンプレートがなければデフォルトを作成
  if (templates.length === 0) {
    await seedDefaultTemplates()
    const refreshed = await getTemplates()
    templates = refreshed.data ?? []
  }

  return (
    <ComposePage
      leads={leads}
      initialMessages={messages}
      isDemo={isDemo}
      initialLeadId={params.leadId ?? ''}
      initialMode={params.mode === 'bulk' ? 'bulk' : undefined}
      initialBulkLeadIds={params.leads?.split(',').filter(Boolean)}
      templates={templates}
      queuedStatuses={queuedStatuses}
    />
  )
}
