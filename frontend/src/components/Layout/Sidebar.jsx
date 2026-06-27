import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderKanban,
  Bell,
  Settings,
  Map,
  Receipt,
  IndianRupee,
  ChevronLeft,
  ChevronRight,
  MapPin,
  LogOut,
  X,
  Users,
  FileText,
  BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/context/LanguageContext'
import { resolveAvatarUrl } from '@/utils/mediaUrl'

const ownerLinks = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'overview' },
  { to: '/dashboard/projects', icon: FolderKanban, label: 'projects' },
  { to: '/dashboard/bookings', icon: Receipt, label: 'bookings' },
  { to: '/dashboard/brokers', icon: Users, label: 'brokers' },
  { to: '/dashboard/documents', icon: FileText, label: 'documents' },
  { to: '/dashboard/analytics', icon: BarChart3, label: 'analytics' },
  { to: '/dashboard/notifications', icon: Bell, label: 'notifications' },
  { to: '/dashboard/settings', icon: Settings, label: 'settings' },
]

const brokerLinks = [
  { to: '/broker', icon: LayoutDashboard, label: 'overview' },
  { to: '/broker/projects', icon: Map, label: 'projects' },
  { to: '/broker/bookings', icon: Receipt, label: 'bookings' },
  { to: '/broker/earnings', icon: IndianRupee, label: 'earnings' },
  { to: '/broker/notifications', icon: Bell, label: 'notifications' },
  { to: '/broker/settings', icon: Settings, label: 'settings' },
]

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
  const { user, logout } = useAuth()
  const { t } = useLanguage()
  const location = useLocation()
  const links = user?.role === 'broker' ? brokerLinks : ownerLinks

  const initials = (user?.name || user?.phone || '??').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
  const avatarSrc = resolveAvatarUrl(user?.avatar)

  const header = (showClose) => (
    <div className="flex items-center justify-between px-5 py-5 border-b border-border shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 bg-primary/15 border border-primary/20 rounded-xl flex items-center justify-center text-primary shadow-sm">
          <MapPin size={18} />
        </div>
        {(!collapsed || showClose) && (
          <span className="font-bold text-text text-lg tracking-tight truncate">LandLink</span>
        )}
      </div>
      {showClose ? (
        <button type="button" onClick={onMobileClose} className="p-1 text-muted hover:text-text" aria-label="Close menu">
          <X className="w-5 h-5" />
        </button>
      ) : (
        <button type="button" onClick={onToggle} className="hidden md:flex w-8 h-8 items-center justify-center text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-all" aria-label="Collapse sidebar">
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      )}
    </div>
  )

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden" onClick={onMobileClose} />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 bg-card border-r border-border z-50 flex flex-col transition-all duration-300 ease-in-out',
          mobileOpen ? 'translate-x-0 w-full sm:w-[280px]' : '-translate-x-full md:translate-x-0',
          collapsed && !mobileOpen ? 'md:w-[88px]' : 'md:w-[260px]'
        )}
      >
        {header(mobileOpen)}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          {links.map(({ to, icon: Icon, label }) => {
            const active = location.pathname === to || (to !== '/dashboard' && to !== '/broker' && location.pathname.startsWith(to))
            return (
              <NavLink
                key={to}
                to={to}
                end={to === '/dashboard' || to === '/broker'}
                onClick={onMobileClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                  active
                    ? 'text-primary bg-primary/10 border border-primary/15 shadow-sm'
                    : 'text-muted hover:text-text hover:bg-bg/80 border border-transparent'
                )}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {(!collapsed || mobileOpen) && <span className="truncate">{t(label)}</span>}
              </NavLink>
            )
          })}
        </nav>

        <div className="border-t border-border p-4">
          <div className={cn('flex items-center gap-3 p-2 rounded-2xl bg-bg/70 border border-border/60', collapsed && !mobileOpen ? 'justify-center' : '')}>
            <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 border border-border bg-primary/10 flex items-center justify-center">
              {avatarSrc ? (
                <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-primary text-sm font-bold">{initials}</span>
              )}
            </div>
            {(!collapsed || mobileOpen) && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-text truncate">{user?.name || 'User'}</p>
                  <p className="text-[10px] text-muted font-semibold uppercase tracking-wider">{user?.role}</p>
                </div>
                <button onClick={logout} className="p-2 text-muted hover:text-red hover:bg-red-light rounded-lg transition-all" type="button">
                  <LogOut size={16} />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
