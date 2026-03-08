import { Settings } from 'lucide-react'
import ComingSoon from '@/components/ui/ComingSoon'

export default function SettingsPage() {
  return (
    <ComingSoon
      title="設定"
      description="システム全体の設定、API連携、送信設定などを管理します。"
      icon={Settings}
      features={[
        'Supabase・APIキーの管理',
        '送信制限・スケジュール設定',
        'メール受信アカウント連携',
        'Instagram アカウント連携',
        'チームメンバーの招待・権限管理',
        '通知・アラート設定',
      ]}
    />
  )
}
