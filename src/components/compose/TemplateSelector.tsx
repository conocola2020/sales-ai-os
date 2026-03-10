'use client'

import clsx from 'clsx'
import { FileText, Target, Handshake, Sparkles } from 'lucide-react'
import type { MessageTemplate } from '@/types/settings'

interface TemplateSelectorProps {
  templates: MessageTemplate[]
  selectedId: string
  onChange: (id: string) => void
}

const TEMPLATE_ICONS: Record<string, React.ElementType> = {
  '不の解決型': Target,
  '標準営業型': FileText,
  'コラボ提案型': Handshake,
}

const TEMPLATE_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  '不の解決型': {
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/30',
  },
  '標準営業型': {
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
  },
  'コラボ提案型': {
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
  },
}

const DEFAULT_STYLE = {
  color: 'text-gray-400',
  bg: 'bg-gray-700/20',
  border: 'border-gray-600/30',
}

export default function TemplateSelector({
  templates,
  selectedId,
  onChange,
}: TemplateSelectorProps) {
  if (templates.length === 0) return null

  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1.5">テンプレート</label>
      <div className="grid grid-cols-3 gap-2">
        {templates.map(t => {
          const active = selectedId === t.id
          const Icon = TEMPLATE_ICONS[t.name] ?? Sparkles
          const style = TEMPLATE_COLORS[t.name] ?? DEFAULT_STYLE
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={clsx(
                'flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border text-center transition-all',
                active
                  ? `${style.bg} ${style.border} ring-1 ring-offset-0`
                  : 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600 hover:bg-gray-800'
              )}
            >
              <Icon className={clsx('w-5 h-5', active ? style.color : 'text-gray-500')} />
              <span
                className={clsx('text-xs font-semibold', active ? style.color : 'text-gray-300')}
              >
                {t.name}
              </span>
              <span
                className={clsx(
                  'text-[11px] leading-tight',
                  active ? 'text-gray-400' : 'text-gray-600'
                )}
              >
                {t.description}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
