import type { RawPlace } from './types'

export interface SearchTextOptions {
  textQuery: string
  pageToken?: string
  languageCode?: string
  regionCode?: string
  onApiCall?: () => Promise<void> | void
}

export interface SearchTextResponse {
  places: RawPlace[]
  nextPageToken?: string
}

export const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.addressComponents',
  'places.location',
  'places.types',
  'places.primaryType',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.businessStatus',
  'nextPageToken',
].join(',')

const SEARCH_TEXT_URL = 'https://places.googleapis.com/v1/places:searchText'

class PlacesApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message)
    this.name = 'PlacesApiError'
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isRetryable(err: unknown, retriesForInvalidToken: boolean): boolean {
  if (!(err instanceof PlacesApiError)) return false
  if (err.status === 429) return true
  if (err.status >= 500) return true
  return retriesForInvalidToken && err.status === 400 && err.code === 'INVALID_ARGUMENT'
}

async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { retries: number; baseMs: number; retryInvalidPageToken?: boolean }
): Promise<T> {
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt === opts.retries || !isRetryable(err, Boolean(opts.retryInvalidPageToken))) throw err
      const baseDelay = err instanceof PlacesApiError && err.code === 'INVALID_ARGUMENT' ? 3000 : Math.pow(2, attempt) * opts.baseMs
      const delay = baseDelay + Math.floor(Math.random() * 500)
      await sleep(delay)
    }
  }
  throw new Error('unreachable')
}

export async function searchText(opts: SearchTextOptions): Promise<SearchTextResponse> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || ''
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY is not set')

  const request = async (): Promise<SearchTextResponse> => {
    await opts.onApiCall?.()

    const res = await fetch(SEARCH_TEXT_URL, {
      method: 'POST',
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        textQuery: opts.textQuery,
        languageCode: opts.languageCode ?? 'ja',
        regionCode: opts.regionCode ?? 'JP',
        ...(opts.pageToken ? { pageToken: opts.pageToken } : {}),
      }),
    })

    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      const code = typeof body?.error?.status === 'string' ? body.error.status : undefined
      const detail = typeof body?.error?.message === 'string' ? body.error.message : `HTTP ${res.status}`
      const message = `HTTP ${res.status}: ${detail}`
      throw new PlacesApiError(message, res.status, code)
    }

    return {
      places: Array.isArray(body.places) ? body.places : [],
      nextPageToken: typeof body.nextPageToken === 'string' ? body.nextPageToken : undefined,
    }
  }

  const retryInvalidPageToken = Boolean(opts.pageToken)
  return withRetry(request, {
    retries: retryInvalidPageToken ? 1 : 5,
    baseMs: 1000,
    retryInvalidPageToken,
  })
}

export async function searchTextAll(
  textQuery: string,
  opts: { onApiCall?: () => Promise<void> | void; shouldContinue?: (places: RawPlace[]) => boolean } = {}
): Promise<RawPlace[]> {
  const places: RawPlace[] = []
  let pageToken: string | undefined

  for (let page = 1; page <= 3; page++) {
    if (pageToken) await sleep(2100)
    const res = await searchText({ textQuery, pageToken, onApiCall: opts.onApiCall })
    places.push(...res.places)
    if (opts.shouldContinue && !opts.shouldContinue(res.places)) break
    if (!res.nextPageToken) break
    pageToken = res.nextPageToken
  }

  return places
}
