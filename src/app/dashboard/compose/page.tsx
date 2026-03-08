import ComposePage from '@/components/compose/ComposePage'
import { getLeads } from '@/app/dashboard/leads/actions'
import { getMessages } from './actions'

interface Props {
  searchParams: Promise<{ leadId?: string }>
}

export default async function ComposePageRoute({ searchParams }: Props) {
  const [leadsResult, messagesResult, params] = await Promise.all([
    getLeads(),
    getMessages(),
    searchParams,
  ])

  const leads = leadsResult.data ?? []
  const messages = messagesResult.data ?? []
  const isDemo =
    !process.env.ANTHROPIC_API_KEY ||
    process.env.ANTHROPIC_API_KEY === 'your-anthropic-api-key-here'

  return (
    <ComposePage
      leads={leads}
      initialMessages={messages}
      isDemo={isDemo}
      initialLeadId={params.leadId ?? ''}
    />
  )
}
