import { cn } from '@/lib/utils'

export function Input({ className, label, error, ...props }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-sm font-medium text-[#E8EAF0]">{label}</label>
      )}
      <input
        className={cn(
          'input-field flex h-11 w-full px-4 py-2 text-sm',
          error && 'border-[#EF4444]',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-[#EF4444]">{error}</p>}
    </div>
  )
}
