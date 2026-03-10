import { getTargets, getTargetStats } from './actions'
import InstagramPageComponent from '@/components/instagram/InstagramPage'

export const dynamic = 'force-dynamic'

export default async function InstagramPage() {
  const [targetsResult, statsResult] = await Promise.all([
    getTargets(),
    getTargetStats(),
  ])

  const targets = targetsResult.data ?? []
  const stats = statsResult.data ?? {
    total: 0,
    approached: 0,
    dmSent: 0,
    replied: 0,
    converted: 0,
    replyRate: null,
  }

  return (
    <InstagramPageComponent
      initialTargets={targets}
      initialStats={stats}
    />
  )
}
