import MeoDashboard from '@/components/meo/MeoDashboard'
import { getMeoData } from './actions'

export const dynamic = 'force-dynamic'

export default async function MeoDashboardRoute() {
  const data = await getMeoData()
  return <MeoDashboard data={data} />
}
