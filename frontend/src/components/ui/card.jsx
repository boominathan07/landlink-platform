import { cn } from '@/lib/utils'

export function Card({ className, children, ...props }) {
  return (
    <div
      className={cn('glass-card', className)}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, children }) {
  return <div className={cn('p-5 pb-0', className)}>{children}</div>
}

export function CardTitle({ className, children }) {
  return <h3 className={cn('text-lg font-medium text-[#E8EAF0]', className)}>{children}</h3>
}

export function CardContent({ className, children }) {
  return <div className={cn('p-5', className)}>{children}</div>
}
