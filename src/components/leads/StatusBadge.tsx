import { STATUS_CONFIG, type LeadStatus } from '@/types/leads'
import clsx from 'clsx'

interface StatusBadgeProps {
  status: LeadStatus
  size?: 'sm' | 'md'
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        cfg.bg, cfg.border, cfg.color,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
      )}
    >
      <span className={clsx('rounded-full flex-shrink-0', cfg.dot, size === 'sm' ? 'w-1 h-1' : 'w-1.5 h-1.5')} />
      {cfg.label}
    </span>
  )
}
