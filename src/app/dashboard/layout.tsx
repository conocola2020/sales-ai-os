import DashboardShell from '@/components/layout/DashboardShell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let userName = 'デモユーザー'
  let userEmail = 'demo@sales-ai-os.com'

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const isConfigured = supabaseUrl && supabaseUrl !== 'your-supabase-url' && supabaseKey && supabaseKey !== 'your-supabase-anon-key'

  if (isConfigured) {
    const { createClient } = await import('@/lib/supabase/server')
    const { redirect } = await import('next/navigation')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/auth/login')
    userName = user!.user_metadata?.full_name || user!.email?.split('@')[0] || 'ユーザー'
    userEmail = user!.email || ''
  }

  return (
    <DashboardShell userName={userName} userEmail={userEmail}>
      {children}
    </DashboardShell>
  )
}
