import SettingsPage from '@/components/settings/SettingsPage'
import { getSettings, getTemplates, seedDefaultTemplates } from '@/app/dashboard/settings/actions'

export const dynamic = 'force-dynamic'

export default async function SettingsPageRoute() {
  const [settingsResult, templatesResult] = await Promise.all([
    getSettings(),
    getTemplates(),
  ])

  // 初回アクセス時にデフォルトテンプレートを挿入
  if (templatesResult.data.length === 0) {
    await seedDefaultTemplates()
    // 再取得
    const refreshed = await getTemplates()
    return (
      <SettingsPage
        initialSettings={settingsResult.data}
        templates={refreshed.data}
      />
    )
  }

  return (
    <SettingsPage
      initialSettings={settingsResult.data}
      templates={templatesResult.data}
    />
  )
}
