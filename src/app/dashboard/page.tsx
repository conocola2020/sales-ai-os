import {
  Users,
  Send,
  MessageSquare,
  TrendingUp,
  Zap,
  ArrowUpRight,
  Building2,
  Handshake,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'

const stats = [
  {
    label: 'リード総数',
    value: '1,248',
    change: '+12%',
    positive: true,
    icon: Users,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
  {
    label: '今月の送信数',
    value: '342',
    change: '+8%',
    positive: true,
    icon: Send,
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
  },
  {
    label: '返信受信数',
    value: '47',
    change: '+24%',
    positive: true,
    icon: MessageSquare,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  {
    label: '返信率',
    value: '13.7%',
    change: '+2.1%',
    positive: true,
    icon: TrendingUp,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
]

const recentActivities = [
  { type: 'sent', text: '株式会社テクノソリューションへ送信完了', time: '5分前', status: 'success' },
  { type: 'reply', text: 'エムツービジネスから返信受信', time: '12分前', status: 'reply' },
  { type: 'sent', text: 'グローバルマーケティング株式会社へ送信完了', time: '28分前', status: 'success' },
  { type: 'error', text: 'フォームエラー: 株式会社イノベーション', time: '1時間前', status: 'error' },
  { type: 'deal', text: '商談スケジュール: デジタルソリューションズ', time: '2時間前', status: 'deal' },
  { type: 'sent', text: 'サイバーエージェント系列企業へ送信完了', time: '3時間前', status: 'success' },
]

const pipeline = [
  { stage: 'コンタクト済み', count: 342, color: 'bg-blue-500' },
  { stage: '返信あり', count: 47, color: 'bg-violet-500' },
  { stage: '商談中', count: 12, color: 'bg-amber-500' },
  { stage: '成約', count: 5, color: 'bg-emerald-500' },
]

export default async function DashboardPage() {
  const userName = 'デモユーザー'

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            おかえりなさい、{userName}さん
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            今日も営業活動を効率化しましょう
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-emerald-400 text-sm font-medium">自動送信: 稼働中</span>
          </div>
          <button className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
            <Zap className="w-4 h-4" />
            クイック送信
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.label}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-all"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-10 h-10 ${stat.bg} border ${stat.border} rounded-xl flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div className={`flex items-center gap-1 text-xs font-semibold ${stat.positive ? 'text-emerald-400' : 'text-red-400'}`}>
                  <ArrowUpRight className="w-3 h-3" />
                  {stat.change}
                </div>
              </div>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-gray-400 text-sm mt-1">{stat.label}</p>
            </div>
          )
        })}
      </div>

      {/* Middle section */}
      <div className="grid grid-cols-3 gap-6">
        {/* Pipeline */}
        <div className="col-span-1 bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-white">営業パイプライン</h2>
            <Handshake className="w-4 h-4 text-gray-500" />
          </div>
          <div className="space-y-4">
            {pipeline.map((stage) => {
              const max = pipeline[0].count
              const pct = Math.round((stage.count / max) * 100)
              return (
                <div key={stage.stage}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-gray-300">{stage.stage}</span>
                    <span className="text-sm font-semibold text-white">{stage.count}</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${stage.color} rounded-full transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-5 pt-4 border-t border-gray-800">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">成約率</span>
              <span className="text-emerald-400 font-semibold">1.46%</span>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-white">最近のアクティビティ</h2>
            <button className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
              すべて見る
            </button>
          </div>
          <div className="space-y-3">
            {recentActivities.map((activity, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-800/50 transition-colors">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5
                  ${activity.status === 'success' ? 'bg-emerald-500/10' : ''}
                  ${activity.status === 'reply' ? 'bg-violet-500/10' : ''}
                  ${activity.status === 'error' ? 'bg-red-500/10' : ''}
                  ${activity.status === 'deal' ? 'bg-amber-500/10' : ''}
                `}>
                  {activity.status === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  {activity.status === 'reply' && <MessageSquare className="w-3.5 h-3.5 text-violet-400" />}
                  {activity.status === 'error' && <AlertCircle className="w-3.5 h-3.5 text-red-400" />}
                  {activity.status === 'deal' && <Handshake className="w-3.5 h-3.5 text-amber-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">{activity.text}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3 text-gray-600" />
                    <span className="text-xs text-gray-500">{activity.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white mb-4">クイックアクション</h2>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'リードをインポート', icon: Users, href: '/dashboard/leads', desc: 'CSVから一括登録' },
            { label: '文面を生成', icon: Zap, href: '/dashboard/compose', desc: 'AIで営業文章作成' },
            { label: '送信を開始', icon: Send, href: '/dashboard/sending', desc: 'フォーム自動送信' },
            { label: 'レポートを確認', icon: TrendingUp, href: '/dashboard/reports', desc: '成果分析・可視化' },
          ].map((action) => {
            const Icon = action.icon
            return (
              <a
                key={action.label}
                href={action.href}
                className="flex items-center gap-3 p-4 bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 hover:border-gray-600 rounded-xl transition-all group"
              >
                <div className="w-9 h-9 bg-violet-500/10 border border-violet-500/20 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-violet-500/20 transition-colors">
                  <Icon className="w-4 h-4 text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">{action.label}</p>
                  <p className="text-xs text-gray-500">{action.desc}</p>
                </div>
              </a>
            )
          })}
        </div>
      </div>

      {/* Today's tasks */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">今日のタスク</h2>
            <span className="text-xs text-gray-500">3 / 8 完了</span>
          </div>
          <div className="space-y-2">
            {[
              { text: '新規リード50件のリサーチ', done: true },
              { text: '製造業向け文面の確認・承認', done: true },
              { text: '昨日の返信への対応', done: true },
              { text: 'IT企業100件への送信', done: false },
              { text: '商談資料の準備（ABC商事）', done: false },
            ].map((task, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border
                  ${task.done ? 'bg-emerald-500 border-emerald-500' : 'border-gray-600'}`}
                >
                  {task.done && <CheckCircle2 className="w-3 h-3 text-white" />}
                </div>
                <span className={`text-sm ${task.done ? 'text-gray-500 line-through' : 'text-gray-300'}`}>
                  {task.text}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">注目のリード</h2>
            <Building2 className="w-4 h-4 text-gray-500" />
          </div>
          <div className="space-y-3">
            {[
              { name: 'ABC商事株式会社', industry: '製造業', score: 92, status: '返信待ち' },
              { name: 'デジタルソリューションズ', industry: 'IT・SaaS', score: 87, status: '商談中' },
              { name: 'グローバルトレード', industry: '商社', score: 81, status: 'コンタクト済' },
            ].map((lead, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-xl">
                <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">{lead.name[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-200 truncate">{lead.name}</p>
                  <p className="text-xs text-gray-500">{lead.industry}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold text-violet-400">{lead.score}</div>
                  <div className="text-xs text-gray-500">{lead.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
