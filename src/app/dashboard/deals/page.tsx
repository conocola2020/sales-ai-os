import DealsPageComponent from '@/components/deals/DealsPage'
import { getDeals } from './actions'
import { getLeads } from '@/app/dashboard/leads/actions'

interface DealsPageProps {
  searchParams: Promise<{ leadId?: string }>
}

export default async function DealsPage({ searchParams }: DealsPageProps) {
  const [dealsResult, leadsResult, params] = await Promise.all([
    getDeals(),
    getLeads(),
    searchParams,
  ])

  const deals = dealsResult.data ?? []
  const leads = leadsResult.data ?? []

  // If navigated from 返信管理 with ?leadId=xxx, pre-fill the create modal
  const initialLead = params.leadId
    ? (leads.find(l => l.id === params.leadId) ?? null)
    : null

  return (
    <DealsPageComponent
      initialDeals={deals}
      leads={leads}
      initialLead={initialLead}
    />
  )
}
