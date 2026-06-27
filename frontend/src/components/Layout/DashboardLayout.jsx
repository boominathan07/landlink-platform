import { useState, useEffect } from 'react'
import { Outlet, Navigate, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import NotificationBell from '../common/NotificationBell'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/context/LanguageContext'
import { Menu } from 'lucide-react'
import ProfileMenu from '../common/ProfileMenu'
import { cn } from '@/lib/utils'

export function DashboardLayout({ role }) {
  const { user, loading } = useAuth()
  const { t } = useLanguage()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg font-bold text-primary animate-pulse">
        Initializing LandLink...
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (role && user.role !== role) {
    return <Navigate to={user.role === 'broker' ? '/broker' : '/dashboard'} replace />
  }

  return (
    <div className="flex h-screen bg-bg overflow-hidden font-sans">
      {/* Sidebar - Fixed 260px (collapsed 88px) */}
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      
      {/* Main Content Area */}
      <div className={cn(
        "flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-bg relative transition-all duration-300",
        collapsed ? "md:ml-[88px]" : "md:ml-[260px]"
      )}>
        {/* Header - Glassmorphism */}
        <header className="min-h-[72px] pt-2 sm:pt-0 gradient-header backdrop-blur-md border-b border-border/50 flex items-center justify-between px-4 sm:px-6 lg:px-10 flex-shrink-0 z-30">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-2 -ml-1 text-muted hover:text-text hover:bg-bg rounded-lg transition-colors shrink-0"
            >
              <Menu size={20} />
            </button>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted leading-none mb-1 truncate">
                {user.role === 'owner' ? 'Administrator' : 'Broker Portal'}
              </p>
              <p className="text-sm font-semibold text-text leading-tight truncate">
                {t('welcome')}, <span className="text-primary">{user.name || 'User'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 lg:gap-6 shrink-0">
            <NotificationBell />
            
            <div className="pl-3 sm:pl-6 border-l border-border/50">
              <ProfileMenu />
            </div>
          </div>
        </header>

        {/* Scrollable Content Container */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-10 scroll-smooth custom-scrollbar bg-bg/30">
          <div className="max-w-[1600px] mx-auto w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
