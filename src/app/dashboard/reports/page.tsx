import ReportsPageComponent from '@/components/reports/ReportsPage'
import { getLeads } from '@/app/dashboard/leads/actions'
import { getSendStats } from '@/app/dashboard/sending/actions'
import { getReplyStats } from '@/app/dashboard/replies/actions'
import { getDealStats } from '@/app/dashboard/deals/actions'
import { getTargetStats } from '@/app/dashboard/instagram/actions'

export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
  const [leadsResult, sendResult, replyResult, dealResult, igResult] = await Promise.all([
    getLeads(),
    getSendStats(),
    getReplyStats(),
    getDealStats(),
    getTargetStats(),
  ])

  return (
    <ReportsPageComponent
      leads={leadsResult.data ?? []}
      sendStats={sendResult.data ?? { total: 0, reviewing: 0, sent: 0, failed: 0 }}
      replyStats={replyResult.data ?? { total: 0, unread: 0, interested: 0, considering: 0, declined: 0, questions: 0, other: 0 }}
      dealStats={dealResult.data ?? { total: 0, active: 0, won: 0, lost: 0, pipelineAmount: 0, weightedAmount: 0, winRate: null }}
      igStats={igResult.data ?? { total: 0, approached: 0, dmSent: 0, replied: 0, converted: 0, replyRate: null }}
    />
  )
}
