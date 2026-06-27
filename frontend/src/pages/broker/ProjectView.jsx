import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import InteractivePlotMap from '@/components/PlotMap/InteractivePlotMap'
import LayoutViewer from '@/components/PlotMap/LayoutViewer'
import { BookingModal } from '@/components/BookingModal/BookingModal'
import { StatsBar } from '@/components/StatsBar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { projectsApi, plotsApi, documentsApi } from '@/services/api'
import { useSocket } from '@/context/SocketContext'
import { cn } from '@/lib/utils'

const BROKER_TABS = ['map', 'layout', 'documents']

export default function ProjectView() {
  const { id } = useParams()
  const socketCtx = useSocket()
  const socket = socketCtx?.socket
  const joinProject = socketCtx?.joinProject
  const leaveProject = socketCtx?.leaveProject

  const [project, setProject] = useState(null)
  const [plots, setPlots] = useState([])
  const [stats, setStats] = useState({ total: 0, available: 0, booked: 0, sold: 0, onHold: 0 })
  const [documents, setDocuments] = useState([])
  const [tab, setTab] = useState('map')
  const [selectedPlot, setSelectedPlot] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const updatePlotLocally = useCallback((plotId, patch) => {
    setPlots((prev) => {
      const next = prev.map((p) => (String(p._id) === String(plotId) ? { ...p, ...patch } : p))
      setStats({
        total: next.length,
        available: next.filter((p) => p.status === 'available').length,
        booked: next.filter((p) => p.status === 'booked').length,
        sold: next.filter((p) => p.status === 'sold').length,
        onHold: next.filter((p) => p.status === 'hold').length,
      })
      return next
    })
  }, [])

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const { data } = await projectsApi.get(id)
      setProject(data.project)
      const plotRes = await plotsApi.list(id)
      setPlots(plotRes.data.plots || [])
      setStats(plotRes.data.stats || { total: 0, available: 0, booked: 0, sold: 0, onHold: 0 })
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load project')
    } finally {
      setLoading(false)
    }
  }, [id])

  const loadDocs = useCallback(() => {
    if (!id) return
    const apiUrl = import.meta.env.VITE_API_URL || ''
    documentsApi.list(id)
      .then(({ data }) => {
        const docs = (data.documents || []).map((d) => ({
          ...d,
          fileUrl: d.fileUrl?.startsWith('http') ? d.fileUrl : `${apiUrl}${d.fileUrl}`,
        }))
        setDocuments(docs)
      })
      .catch(() => setDocuments([]))
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (tab === 'documents') loadDocs()
  }, [tab, loadDocs])

  useEffect(() => {
    if (!id) return
    joinProject?.(id)
    return () => leaveProject?.(id)
  }, [id, joinProject, leaveProject])

  useEffect(() => {
    if (!socket) return
    const handler = ({ plot }) => {
      setPlots((prev) => {
        const next = prev.map((p) => (String(p._id) === String(plot._id) ? plot : p))
        setStats({
          total: next.length,
          available: next.filter((p) => p.status === 'available').length,
          booked: next.filter((p) => p.status === 'booked').length,
          sold: next.filter((p) => p.status === 'sold').length,
          onHold: next.filter((p) => p.status === 'hold').length,
        })
        return next
      })
    }
    socket.on('plot:status_changed', handler)
    return () => socket.off('plot:status_changed', handler)
  }, [socket])

  const openBooking = (plot) => {
    setSelectedPlot(plot)
    setModalOpen(true)
  }

  if (loading) return <div className="animate-pulse h-64 rounded-xl bg-card border border-border" />

  if (error || !project) {
    return (
      <div className="text-center py-16">
        <p className="text-muted mb-4">{error || 'Project not found'}</p>
        <Link to="/broker/projects"><Button variant="outline">Back to Projects</Button></Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 page-enter">
      <Link to="/broker/projects" className="text-sm text-muted hover:text-primary">← Projects</Link>
      <div>
        <h1 className="page-title text-text">{project.name}</h1>
        <p className="text-sm text-muted mt-1">{project.location?.district}</p>
      </div>

      <StatsBar stats={stats} />

      <div className="flex items-center gap-2 p-1 bg-bg border border-border rounded-xl w-fit overflow-x-auto max-w-full">
        {BROKER_TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'px-5 py-2.5 text-xs font-bold rounded-lg capitalize whitespace-nowrap transition-colors',
              tab === t
                ? 'bg-primary text-white shadow-sm border border-primary'
                : 'text-muted hover:text-text hover:bg-card/50 border border-transparent'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'map' && (
        plots.length > 0 ? (
          <div className="glass-card p-4 overflow-hidden">
            <InteractivePlotMap
              plots={plots}
              pricePerCent={project?.pricePerCent}
              gridCols={project?.gridCols}
              userRole="broker"
              onBookPlot={openBooking}
              onPlotChange={(plot) => {
                if (plot?._id) updatePlotLocally(plot._id, plot)
              }}
            />
          </div>
        ) : (
          <div className="glass-card p-8 text-center text-muted text-sm">No plots configured for this project yet.</div>
        )
      )}

      {tab === 'layout' && (
        <LayoutViewer
          projectId={id}
          layoutImageUrl={project?.layoutImageUrl}
          layoutUpdatedAt={project?.layoutUpdatedAt}
          canEdit={false}
        />
      )}

      {tab === 'documents' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold text-text">Project Documents</h3>
            <p className="text-xs text-muted mt-1">View-only access — download or preview files shared by the owner.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map((d) => (
              <Card key={d._id} className="p-4 border-border/60 shadow-sm bg-card flex items-center justify-between">
                <div className="space-y-1 min-w-0">
                  <p className="text-sm font-bold text-text truncate">{d.name}</p>
                  <p className="text-[10px] text-muted font-bold uppercase tracking-wider">{d.type}</p>
                </div>
                <a
                  href={d.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="h-9 px-4 rounded-lg bg-bg text-primary text-xs font-bold flex items-center justify-center hover:bg-primary hover:text-white transition-colors border border-border/60 shrink-0 ml-3"
                >
                  View
                </a>
              </Card>
            ))}
            {documents.length === 0 && (
              <div className="col-span-full py-16 text-center text-sm text-muted">No documents shared for this project yet.</div>
            )}
          </div>
        </div>
      )}

      <BookingModal
        plot={selectedPlot}
        projectId={id}
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSelectedPlot(null) }}
        onSuccess={(plotId, patch) => {
          if (plotId) updatePlotLocally(plotId, patch || { status: 'booked' })
          setModalOpen(false)
          setSelectedPlot(null)
        }}
      />
    </div>
  )
}

