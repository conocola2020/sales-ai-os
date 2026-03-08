import CompaniesPage from '@/components/companies/CompaniesPage'
import { getAnalyses } from '@/app/dashboard/companies/actions'
import { getLeads } from '@/app/dashboard/leads/actions'

export default async function CompaniesPageRoute() {
  const [analysesResult, leadsResult] = await Promise.all([
    getAnalyses(),
    getLeads(),
  ])

  const analyses = analysesResult.data ?? []
  const leads = leadsResult.data ?? []
  const isDemo =
    !process.env.ANTHROPIC_API_KEY ||
    process.env.ANTHROPIC_API_KEY === 'your-anthropic-api-key-here'

  return (
    <CompaniesPage
      initialAnalyses={analyses}
      leads={leads}
      isDemo={isDemo}
    />
  )
}
