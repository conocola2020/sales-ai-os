import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function isSupabaseConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return !!(url && url !== 'your-supabase-url' && key && key !== 'your-supabase-anon-key')
}

function createMockClient() {
  const empty = { data: [] as any[], count: 0, error: null }
  const makeBuilder = (): any => {
    const b: any = {}
    const chainMethods = [
      'select', 'insert', 'update', 'upsert', 'delete',
      'eq', 'neq', 'in', 'not', 'is', 'gte', 'lte', 'gt', 'lt',
      'ilike', 'like', 'order', 'range', 'limit', 'filter', 'match',
      'contains', 'overlaps',
    ]
    chainMethods.forEach(m => { b[m] = (..._: any[]) => b })
    b.single = () => Promise.resolve({ data: null, error: null })
    b.maybeSingle = () => Promise.resolve({ data: null, error: null })
    b.then = (resolve: any, reject: any) => Promise.resolve(empty).then(resolve, reject)
    b.catch = () => b
    b.finally = (fn?: any) => { fn?.(); return b }
    return b
  }
  return {
    from: (_: string) => makeBuilder(),
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      signOut: () => Promise.resolve({ error: null }),
    },
    storage: { from: (_: string) => makeBuilder() },
    rpc: (_: string, __?: any) => makeBuilder(),
  }
}

export async function createClient() {
  if (!isSupabaseConfigured()) {
    return createMockClient() as any
  }

  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server component - cookie setting ignored
          }
        },
      },
    }
  )
}
