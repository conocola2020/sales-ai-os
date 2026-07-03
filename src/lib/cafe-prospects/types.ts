/** Google Places API (New) の Place レスポンス（取得フィールドのみ抜粋） */
export interface RawPlace {
  id: string
  displayName?: { text: string; languageCode?: string }
  formattedAddress?: string
  addressComponents?: AddressComponent[]
  location?: { latitude: number; longitude: number }
  types?: string[]
  primaryType?: string
  nationalPhoneNumber?: string
  websiteUri?: string
  rating?: number
  userRatingCount?: number
  businessStatus?: 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY'
}

export interface AddressComponent {
  longText: string
  shortText: string
  types: string[]
}

/** Supabase cafe_prospects 実スキーマ（migration 017）に合わせた保存行 */
export interface CafeProspectRow {
  user_id: string
  place_id: string
  name: string
  formatted_address: string | null
  prefecture: string | null
  phone: string | null
  website: string | null
  latitude: number | null
  longitude: number | null
  rating: number | null
  user_rating_count: number | null
  primary_type: string | null
  business_status: string | null
  status: 'untouched' | 'verified' | 'excluded' | 'promoted'
  notes: string | null
  raw_data: RawPlace
  source: 'google_places_api'
}

export interface SearchAreaConfig {
  id: string
  prefecture: string
  textQuery: string
  maxCount?: number
  group?: string
  locationBias?: {
    circle: { center: { latitude: number; longitude: number }; radius: number }
  }
}

export interface FetchStats {
  totalApiCalls: number
  rawCount: number
  uniqueCount: number
  duplicateCount: number
  notCafeTypeCount: number
  closedCount: number
  blacklistedCount: number
  adoptedWithWebsite: number
  adoptedWithoutWebsite: number
  savedCount: number
  errorCount: number
}

export interface ClassifiedPlace {
  place: RawPlace
  status: CafeProspectRow['status']
  excludedReason: string | null
  hasWebsite: boolean
}
