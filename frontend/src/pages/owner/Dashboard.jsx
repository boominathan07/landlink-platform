import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, FolderKanban } from 'lucide-react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { projectsApi, bookingsApi } from '@/services/api'
import { formatCurrency } from '@/utils/formatCurrency'
import { PlotStatusBadge } from '@/components/PlotStatusBadge'

export default function OwnerDashboard() {
  const [projects, setProjects] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      projectsApi.list(),
      bookingsApi.list({ status: 'pending' }),
    ])
      .then(([p, b]) => {
        setProjects(p.data.projects)
        setBookings(b.data.bookings.slice(0, 5))
      })
      .finally(() => setLoading(false))
  }, [])

  const totalPlots = projects.reduce((s, p) => s + (p.stats?.total || 0), 0)
  const available = projects.reduce((s, p) => s + (p.stats?.available || 0), 0)

  if (loading) {
    return <div className="animate-pulse space-y-4"><div className="h-32 bg-white rounded-xl" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-muted text-sm mt-1">Overview of your land projects</p>
        </div>
        <Link to="/dashboard/projects/new">
          <Button><Plus className="w-4 h-4" /> New Project</Button>
        </Link>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="p-5">
          <p className="text-sm text-muted">Projects</p>
          <p className="text-3xl font-semibold mt-1">{projects.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Total Plots</p>
          <p className="text-3xl font-semibold mt-1">{totalPlots}</p>
        </Card>
        <Card className="p-5 bg-primary-light">
          <p className="text-sm text-primary-dark">Available</p>
          <p className="text-3xl font-semibold mt-1 text-primary-dark">{available}</p>
        </Card>
      </div>

      {bookings.length > 0 && (
        <Card>
          <CardContent>
            <CardTitle className="mb-4">Pending Approvals</CardTitle>
            <div className="space-y-3">
              {bookings.map((b) => (
                <div key={b._id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div>
                    <p className="font-medium text-sm">Plot {b.plotId?.plotNumber}</p>
                    <p className="text-xs text-muted">{b.customerName} · {formatCurrency(b.totalAmount)}</p>
                  </div>
                  <PlotStatusBadge status="booked" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <CardTitle>Your Projects</CardTitle>
            <Link to="/dashboard/projects" className="text-sm text-primary">View all</Link>
          </div>
          {projects.length === 0 ? (
            <div className="text-center py-12">
              <FolderKanban className="w-12 h-12 text-muted mx-auto mb-3 opacity-50" />
              <p className="text-muted mb-4">No projects yet</p>
              <Link to="/dashboard/projects/new"><Button>Create your first project</Button></Link>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {projects.map((p) => (
                <Link
                  key={p._id}
                  to={`/dashboard/projects/${p._id}`}
                  className="block p-4 rounded-[10px] border border-border hover:border-primary/50 transition-colors"
                >
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted mt-1">{p.location?.district}</p>
                  <p className="text-sm mt-2 text-primary-dark">{p.stats?.available ?? 0} plots available</p>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
