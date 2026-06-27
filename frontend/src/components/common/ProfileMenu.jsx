import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Settings, LogOut, ChevronDown } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { resolveAvatarUrl } from '@/utils/mediaUrl'
import { cn } from '@/lib/utils'

export default function ProfileMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const settingsPath = user?.role === 'broker' ? '/broker/settings' : '/dashboard/settings'

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const initials = (user?.name || '??').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
  const avatarSrc = resolveAvatarUrl(user?.avatar)

  const go = (path) => {
    setOpen(false)
    navigate(path)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 group"
        aria-label="Profile menu"
      >
        <div className="hidden md:block text-right">
          <p className="text-[13px] font-bold text-text leading-tight">{user?.name}</p>
          <p className="text-[10px] text-accent font-bold uppercase tracking-wider">{user?.plan || 'Standard'} Member</p>
        </div>
        <div className="w-10 h-10 ring-2 ring-primary/20 rounded-2xl overflow-hidden flex-shrink-0 shadow-inner bg-bg flex items-center justify-center border border-border/40 group-hover:ring-primary/50 transition-all">
          {avatarSrc ? (
            <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-primary text-xs font-black">{initials}</span>
          )}
        </div>
        <ChevronDown size={14} className={cn('text-muted transition-transform hidden sm:block', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 rounded-2xl border border-border/60 bg-card/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden animate-in origin-top-right">
          {[
            { label: 'Profile', icon: User, action: () => go(settingsPath) },
            { label: 'Settings', icon: Settings, action: () => go(settingsPath) },
          ].map(({ label, icon: Icon, action }) => (
            <button
              key={label}
              type="button"
              onClick={action}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-text hover:bg-primary/10 hover:text-primary transition-colors"
            >
              <Icon size={16} /> {label}
            </button>
          ))}
          <div className="border-t border-border/40" />
          <button
            type="button"
            onClick={() => { setOpen(false); logout(); navigate('/login') }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-danger hover:bg-danger/10 transition-colors"
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      )}
    </div>
  )
}
