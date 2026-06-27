import { useEffect, useState } from 'react'
import { Card } from './ui/card'
import { formatNumber } from '@/utils/formatCurrency'
import { cn } from '@/lib/utils'

const items = [
  { key: 'available', label: 'Available', color: 'text-primary', bg: 'bg-primary-light/50 dark:bg-primary-dark/20' },
  { key: 'booked', label: 'Booked', color: 'text-amber', bg: 'bg-amber-light/50 dark:bg-amber-light/5' },
  { key: 'sold', label: 'Sold', color: 'text-red', bg: 'bg-red-light/50 dark:bg-red-light/5' },
  { key: 'onHold', label: 'On Hold', color: 'text-purple', bg: 'bg-purple-light/50 dark:bg-purple-light/5' },
]

function AnimatedNumber({ value }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const duration = 800
    const start = performance.now()
    const from = display
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1)
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)
      setDisplay(Math.round(from + (value - from) * easeOutQuart))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [value])
  return <span>{formatNumber(display)}</span>
}

export function StatsBar({ stats }) {
  const total = stats?.total ?? 0
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      <Card className="p-5 border-border/60 shadow-sm flex flex-col justify-center">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-2">Total Plots</p>
        <p className="text-3xl font-bold text-text">
          <AnimatedNumber value={total} />
        </p>
      </Card>
      {items.map(({ key, label, color, bg }) => (
        <Card key={key} className={cn("p-5 border-transparent shadow-sm flex flex-col justify-center", bg)}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-2">{label}</p>
          <p className={cn("text-3xl font-bold", color)}>
            <AnimatedNumber value={stats?.[key] ?? 0} />
          </p>
        </Card>
      ))}
    </div>
  )
}
