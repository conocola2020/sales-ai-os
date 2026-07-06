import type { RawPlace } from './types'

/** 業種ごとの対象 Places タイプ（industry-configs の placesTypes）に含まれるか */
export function isTargetType(
  types: string[] | undefined,
  primaryType: string | null | undefined,
  targetTypes: readonly string[],
): boolean {
  const set = new Set(targetTypes)
  if (primaryType && set.has(primaryType)) return true
  return (types || []).some(type => set.has(type))
}

export function isOperational(businessStatus: string | undefined): boolean {
  return !businessStatus || businessStatus === 'OPERATIONAL'
}

export function hasWebsite(place: RawPlace): boolean {
  return Boolean(place.websiteUri?.trim())
}
