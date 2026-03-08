import Sidebar from '@/components/layout/Sidebar'

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
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      <Sidebar userName={userName} userEmail={userEmail} />
      <main className="flex-1 overflow-y-auto bg-gray-950">
        {children}
      </main>
    </div>
  )
}
