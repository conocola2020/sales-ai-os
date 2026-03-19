import RepliesPageComponent from '@/components/replies/RepliesPage'
import { getReplies } from './actions'
import { getLeads } from '@/app/dashboard/leads/actions'
import { getSendQueue } from '@/app/dashboard/sending/actions'

export const dynamic = 'force-dynamic'

export default async function RepliesPage() {
  const [repliesResult, leadsResult, sendResult] = await Promise.all([
    getReplies(),
    getLeads(),
    getSendQueue(),
  ])

  const replies = repliesResult.data ?? []
  const leads = leadsResult.data ?? []
  // 送信済みリードのIDを抽出
  const sentLeadIds = (sendResult.data ?? [])
    .filter(q => q.status === '送信済み')
    .map(q => q.lead_id)
    .filter((id): id is string => !!id)

  return (
    <RepliesPageComponent
      initialReplies={replies}
      leads={leads}
      sentLeadIds={sentLeadIds}
    />
  )
}
