import type { Metadata } from 'next'
import MeoShell from '@/components/meo/MeoShell'
import {
  MEO_PRODUCT_NAME,
  MEO_PRODUCT_TAGLINE,
  MEO_PRODUCT_DESCRIPTION,
} from '@/lib/meo/branding'

export const metadata: Metadata = {
  title: `${MEO_PRODUCT_NAME} | ${MEO_PRODUCT_TAGLINE}`,
  description: MEO_PRODUCT_DESCRIPTION,
}

export default async function MeoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let userName = 'デモユーザー'
  let userEmail = 'demo@meo-compass.local'

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const isConfigured =
    supabaseUrl &&
    supabaseUrl !== 'your-supabase-url' &&
    supabaseKey &&
    supabaseKey !== 'your-supabase-anon-key'

  if (isConfigured) {
    const { createClient } = await import('@/lib/supabase/server')
    const { redirect } = await import('next/navigation')
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) redirect('/auth/login')
    userName = user!.user_metadata?.full_name || user!.email?.split('@')[0] || 'ユーザー'
    userEmail = user!.email || ''
  }

  return (
    <MeoShell userName={userName} userEmail={userEmail}>
      {children}
    </MeoShell>
  )
}
