import { getLeads } from './actions'
import LeadsTable from '@/components/leads/LeadsTable'

export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
  const { data: leads } = await getLeads()
  return (
    <div className="h-full flex flex-col">
      <LeadsTable initialLeads={leads} />
    </div>
  )
}
