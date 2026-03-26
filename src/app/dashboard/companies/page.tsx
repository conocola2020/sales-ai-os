import CompaniesPage from '@/components/companies/CompaniesPage'
import { getAnalyses } from '@/app/dashboard/companies/actions'
import { getLeads } from '@/app/dashboard/leads/actions'
import { getAnthropicApiKey } from '@/lib/env'

export const revalidate = 60

export default async function CompaniesPageRoute() {
  const [analysesResult, leadsResult] = await Promise.all([
    getAnalyses(),
    getLeads(),
  ])

  const analyses = analysesResult.data ?? []
  const leads = leadsResult.data ?? []
  const isDemo =
    !getAnthropicApiKey() ||
    getAnthropicApiKey() === 'your-anthropic-api-key-here'

  return (
    <CompaniesPage
      initialAnalyses={analyses}
      leads={leads}
      isDemo={isDemo}
    />
  )
}
