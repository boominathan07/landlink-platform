import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { projectsApi } from '@/services/api'
import { 
  Users, UserPlus, Phone, Building2, Trash2, 
  Search, ShieldCheck, Mail, Star
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

export default function Brokers() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    try {
      setLoading(true)
      const { data } = await projectsApi.list()
      setProjects(data.projects || [])
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load brokers')
    } finally {
      setLoading(false)
    }
  }

  const allBrokers = projects.flatMap(p => 
    (p.brokers || []).map(b => ({ ...b, projectName: p.name, projectId: p._id }))
  ).filter(b => b.status !== 'revoked')

  const filteredBrokers = allBrokers.filter(b => 
    b.userId?.name?.toLowerCase().includes(search.toLowerCase()) ||
    b.userId?.phone?.includes(search) ||
    b.projectName.toLowerCase().includes(search.toLowerCase())
  )

  const revokeAccess = async (projectId, brokerId) => {
    if (!window.confirm('Are you sure you want to revoke this broker\'s access?')) return
    try {
      await projectsApi.revokeBroker(projectId, brokerId)
      toast.success('Access revoked')
      fetchProjects()
    } catch (err) {
      toast.error('Failed to revoke access')
    }
  }

  return (
    <div className="space-y-8 pb-12 transition-all duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-text tracking-tight">Broker Network</h1>
          <p className="text-sm text-muted font-medium mt-1">Manage all brokers across your projects and track their assignments</p>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
            <input 
              type="text" 
              placeholder="Search by name, phone or project..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-11 pl-10 pr-4 bg-card border border-border/60 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
          </div>
          <Link to="/dashboard/projects">
            <Button className="h-11 px-6 font-bold gap-2 shadow-sm">
              <UserPlus size={18} /> Invite New
            </Button>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-40 bg-card rounded-2xl animate-pulse border border-border" />)}
        </div>
      ) : filteredBrokers.length === 0 ? (
        <Card className="p-24 text-center border-border/60 border-dashed border-2 bg-card/30">
          <div className="w-20 h-20 bg-bg rounded-full flex items-center justify-center mx-auto mb-6 border border-border">
            <Users className="w-10 h-10 text-muted" />
          </div>
          <h3 className="text-xl font-bold text-text">No active brokers</h3>
          <p className="text-muted mt-2">Start by inviting brokers to your projects from the project detail pages.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBrokers.map((b, i) => (
            <Card key={i} className="p-6 border-border/60 shadow-sm hover:shadow-card-hover transition-all bg-card relative overflow-hidden group">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black text-lg shadow-sm border border-primary/5 group-hover:scale-110 transition-transform">
                    {b.userId?.name?.slice(0, 2).toUpperCase() || 'BR'}
                  </div>
                  <div>
                    <h3 className="font-bold text-text group-hover:text-primary transition-colors">{b.userId?.name || 'Pending...'}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-muted font-bold">
                      <Phone size={12} /> {b.userId?.phone}
                    </div>
                  </div>
                </div>
                <div className={cn(
                  "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                  b.status === 'active' ? "bg-emerald-light text-emerald" : "bg-amber-light text-amber"
                )}>
                  {b.status}
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-border/40">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Project</span>
                  <Link to={`/dashboard/projects/${b.projectId}`} className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                    <Building2 size={12} /> {b.projectName}
                  </Link>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Commission</span>
                  <span className="text-xs font-black text-text">{b.commissionPercent}%</span>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-2">
                <button 
                  onClick={() => revokeAccess(b.projectId, b.userId?._id || b.userId)}
                  className="flex-1 h-9 flex items-center justify-center gap-2 text-[11px] font-bold text-red bg-red-light/50 hover:bg-red hover:text-white rounded-lg transition-all"
                >
                  <Trash2 size={14} /> Revoke Access
                </button>
                <Link to={`/dashboard/projects/${b.projectId}`} className="p-2 text-muted hover:text-primary transition-colors">
                   <ShieldCheck size={18} />
                </Link>
              </div>
              
              {/* Decorative Accent */}
              <div className="absolute top-0 left-0 w-1 h-full bg-primary transform -translate-x-full group-hover:translate-x-0 transition-transform" />
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
