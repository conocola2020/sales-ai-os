import CitationsPage from '@/components/meo/CitationsPage'
import { getMeoData } from '../actions'

export const dynamic = 'force-dynamic'

export default async function MeoCitationsRoute() {
  const { location, citations, isDemo } = await getMeoData()
  return <CitationsPage location={location} citations={citations} isDemo={isDemo} />
}
