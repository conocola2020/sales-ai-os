import RepliesPageComponent from '@/components/replies/RepliesPage'
import { getReplies } from './actions'
import { getLeads } from '@/app/dashboard/leads/actions'

export const dynamic = 'force-dynamic'

export default async function RepliesPage() {
  const [repliesResult, leadsResult] = await Promise.all([
    getReplies(),
    getLeads(),
  ])

  const replies = repliesResult.data ?? []
  const leads = leadsResult.data ?? []

  return (
    <RepliesPageComponent
      initialReplies={replies}
      leads={leads}
    />
  )
}
