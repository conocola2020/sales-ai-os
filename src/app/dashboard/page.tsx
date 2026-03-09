import DashboardOverview from '@/components/dashboard/DashboardOverview'
import { getLeads } from './leads/actions'
import { getSendStats } from './sending/actions'
import { getReplyStats } from './replies/actions'
import { getDealStats } from './deals/actions'
import { getTargetStats } from './instagram/actions'

export default async function DashboardPage() {
  const [leadsResult, sendResult, replyResult, dealResult, igResult] = await Promise.all([
    getLeads(),
    getSendStats(),
    getReplyStats(),
    getDealStats(),
    getTargetStats(),
  ])

  return (
    <DashboardOverview
      leads={leadsResult.data ?? []}
      sendStats={sendResult.data ?? { total: 0, pending: 0, reviewing: 0, sent: 0, failed: 0 }}
      replyStats={replyResult.data ?? { total: 0, unread: 0, interested: 0, considering: 0, declined: 0, questions: 0, other: 0 }}
      dealStats={dealResult.data ?? { total: 0, active: 0, won: 0, lost: 0, pipelineAmount: 0, weightedAmount: 0, winRate: null }}
      igStats={igResult.data ?? { total: 0, approached: 0, dmSent: 0, replied: 0, converted: 0, replyRate: null }}
    />
  )
}
