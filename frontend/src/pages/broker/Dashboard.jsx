import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { projectsApi, bookingsApi, analyticsApi } from '@/services/api'
import { formatCurrency } from '@/utils/formatCurrency'
import { FolderKanban, Users, IndianRupee, Calendar, Activity, TrendingUp } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

function AnimatedNumber({ value }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const target = Number(value) || 0
    const steps = 30
    let step = 0
    const timer = setInterval(() => {
      step += 1
      setDisplay(Math.round((target * step) / steps))
      if (step >= steps) clearInterval(timer)
    }, 25)
    return () => clearInterval(timer)
  }, [value])
  return <span>{display}</span>
}

export default function BrokerDashboard() {
  const [projects, setProjects] = useState([])
  const [bookings, setBookings] = useState([])
  const [earnings, setEarnings] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.allSettled([
      projectsApi.list(),
      bookingsApi.list(),
    ]).then(([p, b]) => {
      if (p.status === 'fulfilled') {
        setProjects(p.value.data.projects || [])
      } else {
        setError(p.reason?.response?.data?.message || 'Failed to load dashboard')
      }
      if (b.status === 'fulfilled') {
        setBookings(b.value.data.bookings || [])
      } else if (p.status === 'fulfilled') {
        setError(b.reason?.response?.data?.message || 'Failed to load bookings')
      }
    })
  }, [])

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('landlink_user') || '{}')
    if (user._id) {
      analyticsApi.broker(user._id).then(({ data }) => setEarnings(data.data)).catch(() => {})
    }
  }, [])

  const pendingFollowUps = bookings.filter((b) => b.status === 'approved' || b.status === 'pending')
  const leads = bookings.length

  const kpis = [
    { label: 'Assigned Projects', value: projects.length, icon: FolderKanban, gradient: 'kpi-gradient-1' },
    { label: 'Total Leads', value: leads, icon: Users, gradient: 'kpi-gradient-2' },
    { label: 'This Month', value: earnings?.monthEarned || 0, icon: TrendingUp, gradient: 'kpi-gradient-3', format: 'currency' },
    { label: 'Total Earned', value: earnings?.totalEarned || 0, icon: IndianRupee, gradient: 'kpi-gradient-4', format: 'currency' },
  ]

  return (
    <div className="space-y-8 page-enter pb-8 min-w-0">
      <div>
        <h1 className="page-title text-text">Dashboard</h1>
        <p className="text-muted text-sm mt-1">Your projects, leads, and commission at a glance</p>
      </div>

      {error && (
        <div className="rounded-xl border border-danger/30 bg-red-light/40 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k, i) => (
          <div key={k.label} className={`${k.gradient} p-6 rounded-2xl text-white card-hover animate-in`} style={{ animationDelay: `${i * 100}ms`, opacity: 0 }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-xl bg-white/20"><k.icon size={18} /></div>
              <p className="text-xs font-bold uppercase tracking-wider opacity-80">{k.label}</p>
            </div>
            <p className="text-2xl font-black">
              {k.format === 'currency' ? formatCurrency(k.value) : <AnimatedNumber value={k.value} />}
            </p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card p-6">
          <h2 className="section-title text-text mb-4">Assigned Projects</h2>
          <div className="space-y-3">
            {projects.map((p) => (
              <Link key={p._id} to={`/broker/projects/${p._id}`} className="block p-4 rounded-xl border border-border/40 hover:border-primary/40 card-hover transition-all">
                <p className="font-bold text-text">{p.name}</p>
                <p className="text-sm text-muted">{p.stats?.available ?? 0} plots available · {p.stats?.sold ?? 0} sold</p>
              </Link>
            ))}
            {projects.length === 0 && <p className="text-muted text-sm">No projects assigned yet.</p>}
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card p-6">
            <h2 className="section-title text-text mb-4 flex items-center gap-2"><Calendar size={18} /> Follow-ups</h2>
            {pendingFollowUps.slice(0, 5).map((b) => (
              <div key={b._id} className="py-3 border-b border-border/30 last:border-0">
                <p className="text-sm font-semibold text-text">Plot {b.plotId?.plotNumber}</p>
                <p className="text-xs text-muted capitalize">{b.status}</p>
              </div>
            ))}
            {pendingFollowUps.length === 0 && <p className="text-sm text-muted">No upcoming follow-ups</p>}
          </div>

          <div className="glass-card p-6">
            <h2 className="section-title text-text mb-4 flex items-center gap-2"><Activity size={18} /> Recent Activity</h2>
            {bookings.slice(0, 5).map((b) => (
              <div key={b._id} className="py-2 text-sm text-muted border-b border-border/20 last:border-0">
                {b.customerName} — Plot {b.plotId?.plotNumber}
              </div>
            ))}
          </div>
        </div>
      </div>

      {earnings?.monthlyEarnings?.length > 0 && (
        <div className="glass-card p-6">
          <h2 className="section-title text-text mb-4">Monthly Earnings</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={earnings.monthlyEarnings}>
                <XAxis dataKey="month" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12 }} />
                <Bar dataKey="earnings" fill="var(--primary)" radius={[8, 8, 0, 0]} animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
