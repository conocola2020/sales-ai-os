import { BarChart3 } from 'lucide-react'
import ComingSoon from '@/components/ui/ComingSoon'

export default function ReportsPage() {
  return (
    <ComingSoon
      title="レポート・分析"
      description="営業活動全体のパフォーマンスを可視化し、改善ポイントを特定します。"
      icon={BarChart3}
      features={[
        '送信数・返信率・成約率の時系列グラフ',
        '業界別・地域別のパフォーマンス分析',
        '文面別A/Bテスト結果レポート',
        'Instagram活動のエンゲージメント分析',
        'ROI計算・売上予測',
        'CSVエクスポートと定期レポート配信',
      ]}
    />
  )
}
