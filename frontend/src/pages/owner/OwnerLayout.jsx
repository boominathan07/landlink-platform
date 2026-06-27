import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FolderOpen, ClipboardList,
  Users, FileText, BarChart2, Bell, Settings,
  LogOut, ChevronLeft, ChevronRight, MapPin, Menu, X
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import NotificationBell from '@/components/common/NotificationBell';

const OwnerLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout, loading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  if (loading) return <div className="h-screen w-screen flex items-center justify-center bg-bg text-primary font-bold">Initializing LandLink...</div>;

  const initials = (user?.name || '??').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const navItems = [
    { icon: LayoutDashboard, label: t('overview'),      path: '/dashboard' },
    { icon: FolderOpen,      label: t('projects'),      path: '/dashboard/projects' },
    { icon: ClipboardList,   label: t('bookings'),      path: '/dashboard/bookings' },
    { icon: Users,           label: t('brokers'),       path: '/dashboard/brokers' },
    { icon: FileText,        label: t('documents'),     path: '/dashboard/documents' },
    { icon: BarChart2,       label: t('analytics'),     path: '/dashboard/analytics' },
    { icon: Bell,            label: t('notifications'), path: '/dashboard/notifications' },
    { icon: Settings,        label: t('settings'),      path: '/dashboard/settings' },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-card">
      {/* Logo Section */}
      <div className="flex items-center justify-between px-6 py-6 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary/20">
            <MapPin size={18} className="text-white" />
          </div>
          {(!collapsed || mobileOpen) && (
            <span className="font-black text-text text-lg tracking-tight">LandLink</span>
          )}
        </div>
        {!mobileOpen && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex w-7 h-7 items-center justify-center text-muted hover:text-primary hover:bg-primary-light rounded-lg transition-all"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        )}
        {mobileOpen && (
          <button onClick={() => setMobileOpen(false)} className="lg:hidden text-muted p-1">
            <X size={20} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto custom-scrollbar">
        {navItems.map(({ icon: Icon, label, path }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/dashboard'}
            className={({ isActive }) => `
              flex items-center gap-3 px-4 py-3 rounded-xl text-[14px] font-bold
              transition-all duration-200 group
              ${isActive
                ? 'bg-primary text-white shadow-md shadow-primary/25'
                : 'text-muted hover:bg-bg hover:text-text'
              }
            `}
          >
            <Icon size={20} className={`flex-shrink-0 ${collapsed && !mobileOpen ? 'mx-auto' : ''}`} />
            {(!collapsed || mobileOpen) && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User profile bottom */}
      <div className="border-t border-border/50 p-4">
        <div className={`flex items-center gap-3 p-2 rounded-2xl bg-bg/50 ${collapsed && !mobileOpen ? 'justify-center' : ''}`}>
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0 border border-primary/10">
            <span className="text-primary text-sm font-black">{initials}</span>
          </div>
          {(!collapsed || mobileOpen) && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-text truncate">{user?.name}</p>
              <p className="text-[10px] text-muted font-bold uppercase tracking-wider">Owner</p>
            </div>
          )}
          {(!collapsed || mobileOpen) && (
            <button 
              onClick={() => { logout(); navigate('/login'); }}
              className="p-2 text-muted hover:text-red hover:bg-red-light rounded-lg transition-all"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-bg overflow-hidden font-sans">
      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Desktop Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 lg:static flex-shrink-0 border-r border-border/50 transition-all duration-300 ease-in-out
        ${mobileOpen ? 'translate-x-0 w-full sm:w-[280px]' : '-translate-x-full lg:translate-x-0'}
        ${collapsed ? 'lg:w-[88px]' : 'lg:w-[260px]'}
      `}>
        <SidebarContent />
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-bg relative">
        {/* Header */}
        <header className="h-[72px] bg-card/80 backdrop-blur-md border-b border-border/50 flex items-center justify-between px-6 lg:px-10 flex-shrink-0 z-30 transition-all">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 -ml-2 text-muted hover:text-text hover:bg-bg rounded-lg transition-all"
            >
              <Menu size={20} />
            </button>
            <div className="hidden sm:block">
              <h2 className="text-sm font-bold text-text/60 uppercase tracking-widest">{t('welcome')}</h2>
              <p className="text-lg font-black text-text -mt-1 leading-none">
                Hello, <span className="text-primary">{user?.name}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 lg:gap-6">
            <NotificationBell />
            <div className="flex items-center gap-3 pl-4 lg:pl-6 border-l border-border/50">
              <div className="hidden sm:block text-right">
                <p className="text-[13px] font-black text-text leading-tight">{user?.name}</p>
                <p className="text-[11px] text-primary font-bold uppercase tracking-tight">{user?.plan || 'Free'} Plan</p>
              </div>
              <div className="w-10 h-10 ring-2 ring-primary/10 rounded-full overflow-hidden flex-shrink-0 shadow-inner bg-bg flex items-center justify-center border border-border/40 hover:ring-primary/30 transition-all cursor-pointer">
                {user?.avatar ? (
                  <img src={`${import.meta.env.VITE_API_URL || ''}${user.avatar}`} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-primary text-xs font-black">{initials}</span>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Scrollable Area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-6 lg:p-10 scroll-smooth custom-scrollbar bg-bg/30">
          <div className="max-w-[1600px] mx-auto w-full animate-in fade-in duration-500">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default OwnerLayout;
