import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FolderOpen, Grid, CheckCircle, TrendingUp, Plus, MapPin, Clock, BarChart3, AlertCircle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/context/LanguageContext'
import { projectsApi, bookingsApi } from '@/services/api'
import toast from 'react-hot-toast'

const GRADIENTS = ['kpi-gradient-1', 'kpi-gradient-2', 'kpi-gradient-3', 'kpi-gradient-4']

const Overview = () => {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [projects, setProjects] = useState([])
  const [pendingBookings, setPendingBookings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try {
      const [projResult, bookingsResult] = await Promise.allSettled([
        projectsApi.list(),
        bookingsApi.list({ status: 'pending' }),
      ])
      if (projResult.status === 'fulfilled') {
        setProjects(projResult.value.data.projects || [])
      } else {
        toast.error(projResult.reason?.response?.data?.message || 'Failed to load projects')
      }
      if (bookingsResult.status === 'fulfilled') {
        setPendingBookings((bookingsResult.value.data.bookings || []).filter((b) => b.status === 'pending'))
      } else if (projResult.status === 'fulfilled') {
        toast.error(bookingsResult.reason?.response?.data?.message || 'Failed to load bookings')
      }
      if (projResult.status === 'rejected' && bookingsResult.status === 'rejected') {
        toast.error('Failed to load dashboard')
      }
    } finally {
      setLoading(false)
    }
  }

  const totalPlots = projects.reduce((s, p) => s + (p.stats?.total || 0), 0)
  const totalSold = projects.reduce((s, p) => s + (p.stats?.sold || 0), 0)
  const totalBooked = projects.reduce((s, p) => s + (p.stats?.booked || 0), 0)

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return t('morning')
    if (h < 18) return t('afternoon')
    return t('evening')
  }

  const stats = [
    { label: 'Projects', value: projects.length, icon: FolderOpen },
    { label: 'Plots', value: totalPlots, icon: Grid },
    { label: 'Sold', value: totalSold, icon: CheckCircle },
    { label: 'Bookings', value: totalBooked, icon: TrendingUp },
  ]

  return (
    <div className="space-y-8 pb-8 page-enter min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title text-text">
            {greeting()}, <span className="text-primary">{user?.name?.split(' ')[0] || 'User'}</span>
          </h1>
          <p className="text-sm text-muted mt-1">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Link to="/dashboard/projects/new" className="btn-primary inline-flex items-center gap-2 justify-center text-sm">
          <Plus size={16} /> New Project
        </Link>
      </div>

      {pendingBookings.length > 0 && (
        <div className="glass-card flex items-center justify-between gap-4 px-5 py-4 border-warning/30">
          <div className="flex items-center gap-3">
            <AlertCircle size={18} className="text-warning" />
            <p className="text-sm font-semibold text-warning">
              {pendingBookings.length} booking{pendingBookings.length > 1 ? 's' : ''} waiting for approval
            </p>
          </div>
          <Link to="/dashboard/bookings" className="text-sm font-bold text-warning hover:underline">Review Now →</Link>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 rounded-2xl animate-pulse bg-card" />)
          : stats.map((s, i) => (
            <div key={s.label} className={`${GRADIENTS[i]} p-5 rounded-2xl text-white card-hover animate-in stagger-${i + 1}`} style={{ animationDelay: `${i * 100}ms`, opacity: 0 }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-xl bg-white/20"><s.icon size={20} /></div>
                <p className="text-xs font-bold uppercase tracking-wider opacity-80">{s.label}</p>
              </div>
              <p className="text-3xl font-black">{s.value}</p>
            </div>
          ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title text-text">Recent Projects</h2>
            <Link to="/dashboard/projects" className="text-sm font-bold text-primary hover:underline">View all →</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {!loading && projects.slice(0, 4).map((project, i) => (
              <Link key={project._id} to={`/dashboard/projects/${project._id}`}
                className="glass-card p-5 card-hover animate-in block" style={{ animationDelay: `${i * 100}ms`, opacity: 0 }}>
                <h3 className="font-bold text-text truncate">{project.name}</h3>
                <p className="text-xs text-muted flex items-center gap-1 mt-1"><MapPin size={10} /> {project.location?.district || 'No location'}</p>
                <div className="flex gap-2 mt-4 flex-wrap">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/20 text-accent font-bold">{project.stats?.available || 0} avail</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/20 text-warning font-bold">{project.stats?.booked || 0} booked</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-danger/20 text-danger font-bold">{project.stats?.sold || 0} sold</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="section-title text-text">Recent Activity</h2>
          <div className="glass-card overflow-hidden">
            {pendingBookings.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted"><Clock size={32} className="mx-auto mb-3 opacity-20" />No pending activity</div>
            ) : (
              pendingBookings.slice(0, 6).map((b) => (
                <Link key={b._id} to="/dashboard/bookings" className="flex gap-3 px-4 py-4 border-b border-border/30 hover:bg-primary/5 transition-colors">
                  <div className="w-2 h-2 rounded-full mt-2 bg-warning" />
                  <div>
                    <p className="text-sm font-bold text-text">Booking — Plot {b.plotId?.plotNumber}</p>
                    <p className="text-xs text-muted mt-1">{new Date(b.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
          <Link to="/dashboard/analytics" className="block glass-card p-5 gradient-primary text-white card-hover">
            <BarChart3 size={24} className="mb-3 opacity-80" />
            <p className="text-sm font-bold">View Analytics</p>
            <p className="text-xs opacity-70 mt-1">Revenue, bookings & broker performance</p>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Overview
