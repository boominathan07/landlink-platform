import { PLOT_STATUS } from '@/utils/plotColors'
import { cn } from '@/lib/utils'

export function PlotStatusBadge({ status, className }) {
  const config = PLOT_STATUS[status] || PLOT_STATUS.available
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        className
      )}
      style={{
        backgroundColor: config.bg,
        color: config.text,
        borderColor: config.border,
      }}
    >
      {config.label}
    </span>
  )
}
