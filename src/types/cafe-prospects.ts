export type CafeProspectStatus = 'untouched' | 'verified' | 'excluded' | 'promoted'

export const CAFE_PROSPECT_STATUSES: CafeProspectStatus[] = [
  'untouched', 'verified', 'excluded', 'promoted',
]

export const CAFE_PROSPECT_STATUS_LABELS: Record<CafeProspectStatus, string> = {
  untouched: '未精査',
  verified:  '精査済み',
  excluded:  '対象外',
  promoted:  '昇格済み',
}

export type CafeProspectContactMethod =
  | 'form' | 'email' | 'instagram' | 'manual' | 'none'

export interface CafeProspect {
  id: string
  user_id: string
  place_id: string
  name: string
  formatted_address: string | null
  prefecture: string | null
  phone: string | null
  website: string | null
  instagram_url: string | null
  email: string | null
  contact_form_url: string | null
  latitude: number | null
  longitude: number | null
  rating: number | null
  user_rating_count: number | null
  primary_type: string | null
  business_status: string | null
  status: CafeProspectStatus
  contact_method: CafeProspectContactMethod | null
  source: string
  lead_id: string | null
  notes: string | null
  raw_data: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export type CafeProspectInsert =
  Pick<CafeProspect, 'place_id' | 'name'> &
  Partial<Omit<CafeProspect, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'place_id' | 'name'>>

export type CafeProspectUpdate = Partial<CafeProspectInsert>
