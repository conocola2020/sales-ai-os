import SendingPageComponent from '@/components/sending/SendingPage'
import { getSendQueue } from './actions'
import { getLeads } from '@/app/dashboard/leads/actions'
import { getMessages } from '@/app/dashboard/compose/actions'

export const dynamic = 'force-dynamic'

export default async function SendingPage() {
  const [queueResult, leadsResult, messagesResult] = await Promise.all([
    getSendQueue(),
    getLeads(),
    getMessages(),
  ])

  const queue = queueResult.data ?? []
  const leads = leadsResult.data ?? []
  const messages = messagesResult.data ?? []

  return (
    <SendingPageComponent
      initialQueue={queue}
      leads={leads}
      messages={messages}
    />
  )
}
