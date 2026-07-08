import ReviewsPage from '@/components/meo/ReviewsPage'
import { getMeoData } from '../actions'

export const dynamic = 'force-dynamic'

export default async function MeoReviewsRoute() {
  const { location, reviews, isDemo } = await getMeoData()
  return <ReviewsPage location={location} reviews={reviews} isDemo={isDemo} />
}
