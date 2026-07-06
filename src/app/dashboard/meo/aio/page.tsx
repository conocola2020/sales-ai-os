import AioPage from '@/components/meo/AioPage'
import { getMeoData } from '../actions'

export const dynamic = 'force-dynamic'

export default async function MeoAioRoute() {
  const { location, aioChecks, isDemo } = await getMeoData()
  return <AioPage location={location} checks={aioChecks} isDemo={isDemo} />
}
