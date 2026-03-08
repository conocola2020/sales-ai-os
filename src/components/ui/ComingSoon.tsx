import { LucideIcon, Wrench } from 'lucide-react'

interface ComingSoonProps {
  title: string
  description: string
  icon?: LucideIcon
  features?: string[]
}

export default function ComingSoon({ title, description, icon: Icon, features }: ComingSoonProps) {
  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto mt-16 text-center">
        <div className="w-16 h-16 bg-violet-500/10 border border-violet-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
          {Icon ? (
            <Icon className="w-7 h-7 text-violet-400" />
          ) : (
            <Wrench className="w-7 h-7 text-violet-400" />
          )}
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">{title}</h1>
        <p className="text-gray-400 mb-8">{description}</p>

        {features && features.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-left">
            <p className="text-sm font-semibold text-gray-300 mb-4">実装予定の機能</p>
            <ul className="space-y-2">
              {features.map((f, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-gray-400">
                  <div className="w-1.5 h-1.5 bg-violet-500 rounded-full flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2">
          <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
          <span className="text-amber-400 text-sm">開発中</span>
        </div>
      </div>
    </div>
  )
}
