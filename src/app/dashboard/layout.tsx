import DashboardShell from '@/components/layout/DashboardShell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let userName = 'デモユーザー'
  let userEmail = 'demo@sales-ai-os.com'
  let orgName: string | null = null

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const isConfigured = supabaseUrl && supabaseUrl !== 'your-supabase-url' && supabaseKey && supabaseKey !== 'your-supabase-anon-key'

  if (isConfigured) {
    const { getAuthenticatedUser } = await import('@/lib/supabase/server')
    const { redirect } = await import('next/navigation')
    const { user, orgId, supabase } = await getAuthenticatedUser()
    if (!user) redirect('/auth/login')
    userName = user!.user_metadata?.full_name || user!.email?.split('@')[0] || 'ユーザー'
    userEmail = user!.email || ''

    if (orgId) {
      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', orgId)
        .single()
      orgName = org?.name ?? null
    }
  }

  return (
    <DashboardShell userName={userName} userEmail={userEmail} orgName={orgName}>
      {children}
    </DashboardShell>
  )
}
