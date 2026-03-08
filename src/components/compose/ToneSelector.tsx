'use client'

import { TONES, TONE_CONFIG, type Tone } from '@/types/messages'
import clsx from 'clsx'

interface ToneSelectorProps {
  value: Tone
  onChange: (tone: Tone) => void
}

export default function ToneSelector({ value, onChange }: ToneSelectorProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1.5">トーン</label>
      <div className="grid grid-cols-3 gap-2">
        {TONES.map(tone => {
          const cfg = TONE_CONFIG[tone]
          const active = value === tone
          return (
            <button
              key={tone}
              onClick={() => onChange(tone)}
              className={clsx(
                'flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border text-center transition-all',
                active
                  ? `${cfg.bg} ${cfg.border} ring-1 ring-offset-0`
                  : 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600 hover:bg-gray-800'
              )}
            >
              <span className="text-xl leading-none">{cfg.emoji}</span>
              <span className={clsx('text-xs font-semibold', active ? cfg.color : 'text-gray-300')}>
                {cfg.label}
              </span>
              <span className={clsx('text-xs leading-tight', active ? 'text-gray-400' : 'text-gray-600')}>
                {cfg.description}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
