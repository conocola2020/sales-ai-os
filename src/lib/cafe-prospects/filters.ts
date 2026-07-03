import type { RawPlace } from './types'

const CAFE_TYPES = new Set(['cafe', 'coffee_shop'])

export function isCafeType(
  types: string[] | undefined,
  primaryType: string | null | undefined
): boolean {
  if (primaryType && CAFE_TYPES.has(primaryType)) return true
  return (types || []).some(type => CAFE_TYPES.has(type))
}

export function isOperational(businessStatus: string | undefined): boolean {
  return !businessStatus || businessStatus === 'OPERATIONAL'
}

export function hasWebsite(place: RawPlace): boolean {
  return Boolean(place.websiteUri?.trim())
}
