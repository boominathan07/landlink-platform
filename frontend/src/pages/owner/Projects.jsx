import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Trash2, Edit2, MapPin, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { projectsApi } from '@/services/api'
import { StatsBar } from '@/components/StatsBar'
import { toast } from 'react-hot-toast'

export default function Projects() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const fetchProjects = async () => {
    try {
      const { data } = await projectsApi.list()
      setProjects(data.projects || [])
    } catch (err) {
      toast.error('Failed to load projects')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProjects()
  }, [])

  const handleDelete = async (e, project) => {
    e.preventDefault()
    e.stopPropagation()

    if (!window.confirm(`Are you sure you want to delete "${project.name}"? This action cannot be undone.`)) {
      return
    }

    try {
      await projectsApi.delete(project._id)
      setProjects(prev => prev.filter(p => p._id !== project._id))
      toast.success('Project deleted successfully')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete project')
    }
  }

  const handleEdit = (e, projectId) => {
    e.preventDefault()
    e.stopPropagation()
    // For now, redirect to detail page or edit page if implemented
    navigate(`/dashboard/projects/${projectId}`)
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" /> Projects
          </h1>
          <p className="text-sm text-muted mt-1">Manage and track your land development layouts</p>
        </div>
        <Link to="/dashboard/projects/new">
          <Button className="shadow-sm">
            <Plus className="w-4 h-4" /> New Project
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="grid gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 bg-card rounded-xl border border-border animate-pulse" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <Card className="p-16 text-center bg-card border-dashed border-2">
          <div className="w-16 h-16 bg-bg rounded-full flex items-center justify-center mx-auto mb-4 border border-border">
            <Building2 className="w-8 h-8 text-muted" />
          </div>
          <h3 className="text-lg font-bold text-text mb-2">No projects found</h3>
          <p className="text-muted mb-8 max-w-sm mx-auto">Start by creating your first project to manage plots, bookings, and brokers.</p>
          <Link to="/dashboard/projects/new">
            <Button className="px-8 h-11 font-bold">Create Your First Project</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {projects.map((p) => (
            <div key={p._id} className="group relative block">
              <Link to={`/dashboard/projects/${p._id}`}>
                <Card className="p-6 bg-card border-border/60 hover:border-primary/40 hover:shadow-card-hover transition-all duration-300 relative overflow-hidden">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-3">
                        <h2 className="font-bold text-xl text-text group-hover:text-primary transition-colors">
                          {p.name}
                        </h2>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider
                          ${p.status === 'active' ? 'bg-primary-light text-primary-dark' : 'bg-amber-light text-amber'}`}>
                          {p.status}
                        </span>
                      </div>
                      <p className="text-sm text-muted font-medium flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-primary" />
                        {p.location?.district}{p.location?.taluk ? `, ${p.location.taluk}` : ''}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2 relative z-10">
                      <button 
                        onClick={(e) => handleEdit(e, p._id)}
                        className="p-2.5 text-muted hover:text-primary hover:bg-primary-light rounded-xl transition-all border border-transparent hover:border-primary/10"
                        title="Edit Project"
                      >
                        <Edit2 className="w-4.5 h-4.5" />
                      </button>
                      <button 
                        onClick={(e) => handleDelete(e, p)}
                        className="p-2.5 text-muted hover:text-red hover:bg-red-light rounded-xl transition-all border border-transparent hover:border-red/10"
                        title="Delete Project"
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                      </button>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-border/50">
                    <StatsBar stats={p.stats} />
                  </div>
                  
                  {/* Visual Accent */}
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-primary transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300" />
                </Card>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
