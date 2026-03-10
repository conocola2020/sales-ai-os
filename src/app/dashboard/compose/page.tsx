import ComposePage from '@/components/compose/ComposePage'
import { getLeads } from '@/app/dashboard/leads/actions'
import { getMessages } from './actions'
import { getTemplates, seedDefaultTemplates } from '@/app/dashboard/settings/actions'

interface Props {
  searchParams: Promise<{ leadId?: string }>
}

export default async function ComposePageRoute({ searchParams }: Props) {
  const [leadsResult, messagesResult, templatesResult, params] = await Promise.all([
    getLeads(),
    getMessages(),
    getTemplates(),
    searchParams,
  ])

  const leads = leadsResult.data ?? []
  const messages = messagesResult.data ?? []
  let templates = templatesResult.data ?? []
  const isDemo =
    !process.env.ANTHROPIC_API_KEY ||
    process.env.ANTHROPIC_API_KEY === 'your-anthropic-api-key-here'

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
      templates={templates}
    />
  )
}
