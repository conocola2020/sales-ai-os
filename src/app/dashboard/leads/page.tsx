import { getLeads, getLeadQueueStatuses } from './actions'
import LeadsTable from '@/components/leads/LeadsTable'

export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
  const [{ data: leads }, queueStatusMap] = await Promise.all([
    getLeads(),
    getLeadQueueStatuses(),
  ])
  return (
    <div className="h-full flex flex-col">
      <LeadsTable initialLeads={leads} queueStatusMap={queueStatusMap} />
    </div>
  )
}
