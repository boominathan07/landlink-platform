import { cn } from '@/lib/utils'

const variants = {
  default: 'bg-gradient-to-br from-[#4F8EF7] to-[#7B5EA7] text-white hover:shadow-[0_6px_28px_rgba(79,142,247,0.5)] hover:scale-[1.03] active:scale-[0.97]',
  outline: 'border border-[rgba(79,142,247,0.4)] bg-transparent text-[#4F8EF7] hover:bg-[rgba(79,142,247,0.1)] hover:border-[#4F8EF7]',
  accent: 'bg-[#10B981] text-white hover:opacity-90',
  ghost: 'hover:bg-[rgba(79,142,247,0.1)] text-[#4F8EF7]',
  destructive: 'bg-[rgba(239,68,68,0.15)] border border-[rgba(239,68,68,0.4)] text-[#EF4444] hover:bg-[rgba(239,68,68,0.25)]',
}

const sizes = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-5 text-sm',
  lg: 'h-12 px-8 text-sm',
}

export function Button({
  className,
  variant = 'default',
  size = 'md',
  type = 'button',
  children,
  ...props
}) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-[10px] font-medium tracking-wide transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none disabled:scale-100',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
