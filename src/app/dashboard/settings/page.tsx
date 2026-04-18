import SettingsPage from '@/components/settings/SettingsPage'
import { getSettings, getTemplates, seedDefaultTemplates } from '@/app/dashboard/settings/actions'
import { getAuthenticatedUser } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function SettingsPageRoute() {
  const [settingsResult, templatesResult, authResult] = await Promise.all([
    getSettings(),
    getTemplates(),
    getAuthenticatedUser(),
  ])
  const currentUserId = authResult.user?.id ?? null
  const currentRole = authResult.role ?? null

  // 初回アクセス時にデフォルトテンプレートを挿入
  if (templatesResult.data.length === 0) {
    await seedDefaultTemplates()
    // 再取得
    const refreshed = await getTemplates()
    return (
      <SettingsPage
        initialSettings={settingsResult.data}
        templates={refreshed.data}
        currentUserId={currentUserId}
        currentRole={currentRole}
      />
    )
  }

  return (
    <SettingsPage
      initialSettings={settingsResult.data}
      templates={templatesResult.data}
      currentUserId={currentUserId}
      currentRole={currentRole}
    />
  )
}
