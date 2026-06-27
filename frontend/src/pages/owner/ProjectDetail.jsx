import { useEffect, useState, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { UserPlus, Trash2, Edit2, ChevronLeft, MapPin, BarChart2, Users, ClipboardList } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import InteractivePlotMap from '@/components/PlotMap/InteractivePlotMap'
import LayoutViewer from '@/components/PlotMap/LayoutViewer'
import { PlotConfigForm } from '@/components/PlotMap/PlotConfigForm'
import { StatsBar } from '@/components/StatsBar'
import { PlotStatusBadge } from '@/components/PlotStatusBadge'
import { projectsApi, plotsApi, bookingsApi, documentsApi, settingsApi } from '@/services/api'
import { useSocket } from '@/context/SocketContext'
import { formatCurrency } from '@/utils/formatCurrency'
import { Map as MapIcon } from 'lucide-react'

const TABS = ['map', 'layout', 'configure', 'bookings', 'brokers', 'documents', 'analytics']

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const socketCtx = useSocket()
  const socket = socketCtx?.socket
  const joinProject = socketCtx?.joinProject
  const leaveProject = socketCtx?.leaveProject

  const [tab, setTab] = useState('map')
  const [project, setProject] = useState(null)
  const [plots, setPlots] = useState([])
  const [stats, setStats] = useState({ total: 0, available: 0, booked: 0, sold: 0, onHold: 0 })
  const [bookings, setBookings] = useState([])
  const [documents, setDocuments] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [brokerForm, setBrokerForm] = useState({ name: '', email: '', phone: '', commissionPercent: '2' })
  const [selectedPlot, setSelectedPlot] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [extractedPlots, setExtractedPlots] = useState(null)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [pricePerCent, setPricePerCent] = useState(10000)
  const [extractionCols, setExtractionCols] = useState(7)
  const [pendingLayoutFile, setPendingLayoutFile] = useState(null)

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

  const loadBookings = useCallback(() => {
    return bookingsApi.list({ projectId: id })
      .then(({ data }) => setBookings(data.bookings || []))
      .catch(() => toast.error('Failed to load bookings'))
  }, [id])

  const loadDocs = useCallback(() => {
    const apiUrl = import.meta.env.VITE_API_URL || ''
    return documentsApi.list(id)
      .then(({ data }) => {
        const docs = (data.documents || []).map(d => ({
          ...d,
          fileUrl: d.fileUrl?.startsWith('http') ? d.fileUrl : `${apiUrl}${d.fileUrl}`
        }))
        setDocuments(docs)
      })
      .catch(() => toast.error('Failed to load documents'))
  }, [id])

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const { data } = await projectsApi.get(id)
      setProject(data.project)
      if (data.project?.pricePerCent) {
        setPricePerCent(data.project.pricePerCent)
      }
      const plotRes = await plotsApi.list(id)
      setPlots(plotRes.data.plots || [])
      setStats(plotRes.data.stats || { total: 0, available: 0, booked: 0, sold: 0, onHold: 0 })
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load project')
      setProject(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!id) return
    joinProject?.(id)
    return () => leaveProject?.(id)
  }, [id, joinProject, leaveProject])

  useEffect(() => {
    if (!socket) return
    const onPlotChange = ({ plot }) => {
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
    const onNewBooking = () => loadBookings()
    socket.on('plot:status_changed', onPlotChange)
    socket.on('booking:new_request', onNewBooking)
    return () => {
      socket.off('plot:status_changed', onPlotChange)
      socket.off('booking:new_request', onNewBooking)
    }
  }, [socket, loadBookings])

  useEffect(() => {
    if (tab === 'bookings') loadBookings()
    if (tab === 'documents') loadDocs()
    if (tab === 'analytics') {
      projectsApi.analytics(id).then(({ data }) => setAnalytics(data)).catch(() => setAnalytics(null))
    }
  }, [tab, id, loadBookings, loadDocs, plots])

  const triggerExtraction = async () => {
    if (!pendingLayoutFile) {
      toast.error('Select a plot table file first.')
      return
    }
    setIsExtracting(true)
    setExtractedPlots(null)
    setShowPreviewModal(true)
    try {
      let priceCent = 10000
      try {
        const { data: settingsData } = await settingsApi.getSettings()
        const priceVal = settingsData.settings?.pricePerCent ?? settingsData.settings?.find?.((s) => s.key === 'pricePerCent')?.value
        if (priceVal != null) priceCent = parseFloat(priceVal)
      } catch (err) {
        console.error('Failed to load settings:', err)
      }
      setPricePerCent(priceCent)

      const { data } = await projectsApi.extractTable(id, pendingLayoutFile)
      if (data && Array.isArray(data.plots)) {
        setExtractedPlots(data.plots)
        toast.success(`Successfully extracted ${data.plots.length} plots from PDF!`)
      } else {
        toast.error('No table data could be extracted from PDF.')
        setShowPreviewModal(false)
      }
    } catch (err) {
      console.error('Extraction Error:', err)
      toast.error(err.response?.data?.message || 'Failed to extract plots from PDF. Make sure pdfplumber is installed on backend.')
      setShowPreviewModal(false)
    } finally {
      setIsExtracting(false)
    }
  }

  const handleConfirmExtraction = async () => {
    if (!extractedPlots || extractedPlots.length === 0) return
    setIsExtracting(true)
    try {
      await projectsApi.generatePlots(id, {
        plots: extractedPlots,
        columns: extractionCols,
      })
      toast.success('Successfully generated grid map layout from extracted table data!')
      await load()
      setShowPreviewModal(false)
      setTab('map')
    } catch (err) {
      console.error('Generation Error:', err)
      toast.error(err.response?.data?.message || 'Failed to generate grid map layout.')
    } finally {
      setIsExtracting(false)
    }
  }

  const handleAutoDetectAndGenerateGrid = async (layoutFile = null) => {
    const fileToAnalyze = layoutFile || pendingLayoutFile
    if (!fileToAnalyze) {
      toast.error('Upload a plot table image or PDF in Configure Plots first.')
      return
    }
    setIsExtracting(true)
    const toastId = toast.loading('Running OCR on your selected file...')
    try {
      const formData = new FormData()
      formData.append('image', fileToAnalyze)
      const response = await projectsApi.analyzeLayout(id, formData)
      const result = response.data || response
      setPendingLayoutFile(null)
      if (result?.plots?.length > 0) {
        toast.success(`Detected ${result.plots.length} plots from your image.`, { id: toastId })
        await load()
        setTab('map')
        return
      }
      toast.error('No plots detected in the selected file.', { id: toastId })
    } catch (err) {
      console.error('Auto-Detect Error:', err)
      toast.error(err.response?.data?.message || 'Failed to analyze plot table.', { id: toastId })
    } finally {
      setIsExtracting(false)
    }
  }

  const handleAnalysisComplete = async (result) => {
    const payload = result?.data || result
    if (payload && Array.isArray(payload.plots) && payload.plots.length > 0) {
      setPendingLayoutFile(null)
      const reviewCount = payload.needsReviewCount || payload.plots.filter((p) => p.needsReview).length
      if (reviewCount > 0) {
        toast.success(`Detected ${payload.plots.length} plots (${reviewCount} need review).`)
      } else {
        toast.success(`Detected ${payload.plots.length} plots from your image.`)
      }
      await load()
      setTab('map')
    } else {
      toast.error('No plots could be detected in the uploaded layout image.')
    }
  }

  const inviteBroker = async (e) => {
    e.preventDefault()
    if (!brokerForm.email.trim()) { toast.error('Email address is required'); return }
    try {
      await projectsApi.inviteBroker(id, {
        name: brokerForm.name,
        email: brokerForm.email,
        phone: brokerForm.phone,
        commissionPercent: Number(brokerForm.commissionPercent)
      })
      await load()
      toast.success('Broker invited successfully!')
      setBrokerForm({ name: '', email: '', phone: '', commissionPercent: '2' })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to invite broker')
    }
  }

  const handleBookingAction = async (bookingId, action) => {
    try {
      if (action === 'reject') {
        await bookingsApi.reject(bookingId, '')
      } else if (action === 'approve') {
        await bookingsApi.approve(bookingId)
      } else {
        await bookingsApi.complete(bookingId)
      }
      toast.success(`Booking ${action}d successfully`)
      setBookings((prev) =>
        prev.map((b) => {
          if (b._id !== bookingId) return b
          if (action === 'approve') return { ...b, status: 'approved' }
          if (action === 'reject') return { ...b, status: 'rejected' }
          return { ...b, status: 'completed' }
        }).filter((b) => b.status !== 'rejected')
      )
      if (action === 'complete') {
        const booking = bookings.find((b) => b._id === bookingId)
        if (booking?.plotId?._id) {
          updatePlotLocally(booking.plotId._id, { status: 'sold' })
        }
      } else if (action === 'reject') {
        const booking = bookings.find((b) => b._id === bookingId)
        if (booking?.plotId?._id) {
          updatePlotLocally(booking.plotId._id, { status: 'available' })
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed')
    }
  }

  const handleDeleteProject = async () => {
    if (!window.confirm(`Are you sure you want to delete "${project.name}"? This cannot be undone.`)) return
    try {
      await projectsApi.delete(id)
      toast.success('Project deleted successfully')
      navigate('/dashboard/projects')
    } catch (err) {
      toast.error('Failed to delete project')
    }
  }

  const getBrokerUserId = (b) => {
    const u = b.userId
    if (!u) return null
    return typeof u === 'object' ? u._id : u
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--card)' }} />
        <div className="h-64 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--card)' }} />
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="text-center py-16">
        <p className="text-muted mb-4">{error || 'Project not found'}</p>
        <Link to="/dashboard/projects">
          <Button variant="outline">Back to Projects</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12 transition-all duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link to="/dashboard/projects" className="text-sm font-bold text-primary hover:underline flex items-center gap-1">
            <ChevronLeft size={16} /> Back to Projects
          </Link>
          <h1 className="text-3xl font-bold text-text mt-2">{project.name}</h1>
          <p className="text-sm text-muted font-medium flex items-center gap-1.5">
            <MapPin size={14} className="text-primary" /> {project.location?.district}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => setTab('configure')}
            className="h-11 w-11 flex items-center justify-center text-muted hover:text-primary hover:bg-primary-light rounded-xl transition-colors border border-border/40 hover:border-primary/20 shadow-sm"
            title="Configure Project"
          >
            <Edit2 className="w-5 h-5" />
          </button>
          <button 
            type="button"
            onClick={handleDeleteProject}
            className="h-11 w-11 flex items-center justify-center text-muted hover:text-red hover:bg-red-light rounded-xl transition-colors border border-border/40 hover:border-red/20 shadow-sm"
            title="Delete Project"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          <button 
            type="button"
            onClick={() => setTab('layout')}
            className={cn(
              "h-11 px-5 flex items-center gap-2 text-sm font-semibold rounded-xl transition-colors border shadow-sm",
              tab === 'layout'
                ? "text-white bg-primary border-primary"
                : "text-muted bg-card border-border/40 hover:text-primary hover:border-primary/20"
            )}
          >
            Blueprint Layout
          </button>
        </div>
      </div>

      <div className="p-1 bg-card border border-border/60 rounded-2xl shadow-sm">
        <StatsBar stats={stats} />
      </div>

      <div className="flex items-center gap-2 p-1 bg-bg border border-border rounded-xl w-fit overflow-x-auto max-w-full">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "px-5 py-2.5 text-xs font-bold rounded-lg capitalize whitespace-nowrap transition-colors",
              tab === t
                ? "bg-primary text-white shadow-sm border border-primary"
                : "text-muted hover:text-text hover:bg-card/50 border border-transparent"
            )}
          >
            {t === 'configure' ? 'Configure Plots' : t}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'map' && (
          <div className="space-y-6">
            {plots.length > 0 ? (
              <div className="glass-card p-4 overflow-hidden">
                <h3 className="text-lg font-bold text-text mb-4">Interactive Plot Map</h3>
                <InteractivePlotMap
                  plots={plots}
                  pricePerCent={project?.pricePerCent || pricePerCent}
                  gridCols={project?.gridCols}
                  userRole="owner"
                  onStatusChange={async (plotId, newStatus) => {
                    try {
                      await projectsApi.updatePlotStatus(id, plotId, newStatus)
                      updatePlotLocally(plotId, { status: newStatus })
                    } catch (err) {
                      toast.error(err.response?.data?.message || 'Failed to update plot status')
                    }
                  }}
                />
              </div>
            ) : (
              <div className="glass-card p-8 text-center text-muted">
                <p className="mb-2">No plots configured yet.</p>
                <p className="text-sm">Use <button type="button" className="text-primary font-semibold hover:underline" onClick={() => setTab('configure')}>Configure Plots</button> to upload a plot table for OCR extraction.</p>
              </div>
            )}
          </div>
        )}

        {tab === 'layout' && (
          <LayoutViewer
            projectId={id}
            layoutImageUrl={project?.layoutImageUrl}
            layoutUpdatedAt={project?.layoutUpdatedAt}
            onUpdated={(url) => setProject((p) => ({ ...p, layoutImageUrl: url }))}
            onDeleted={() => load()}
            canEdit
          />
        )}

        {tab === 'configure' && (
          <div className="bg-card border border-border/60 rounded-3xl p-6 shadow-sm">
            <div className="max-w-2xl">
              <PlotConfigForm
                projectId={id}
                existingPlotCount={plots.length}
                onGenerated={() => load()}
                onExtractStart={triggerExtraction}
                onAutoDetectGrid={handleAutoDetectAndGenerateGrid}
                onAnalysisComplete={handleAnalysisComplete}
                isExtracting={isExtracting}
                pendingLayoutFile={pendingLayoutFile}
                onPendingFileChange={setPendingLayoutFile}
              />
            </div>
          </div>
        )}

        {tab === 'bookings' && (
          <Card className="border-border/60 shadow-sm overflow-hidden">
            <CardContent className="p-0 divide-y divide-border/50">
              {bookings.length === 0 ? (
                <div className="py-24 text-center">
                  <div className="w-16 h-16 bg-bg rounded-full flex items-center justify-center mx-auto mb-4 border border-border">
                    <ClipboardList className="w-8 h-8 text-muted" />
                  </div>
                  <h3 className="text-lg font-bold text-text">No bookings yet</h3>
                  <p className="text-sm text-muted mt-1">Once brokers request bookings, they will appear here.</p>
                </div>
              ) : (
                bookings.map((b) => (
                  <div key={b._id} className="flex flex-wrap items-center justify-between gap-6 p-6 hover:bg-bg/40 transition-colors">
                    <div className="space-y-1">
                      <p className="font-bold text-text text-lg">Plot {b.plotId?.plotNumber} · {b.customerName}</p>
                      <div className="flex items-center gap-3 text-sm text-muted font-medium">
                        <span className="text-primary font-bold">{formatCurrency(b.totalAmount)}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1"><Users size={14} /> {b.brokerId?.name || 'Broker'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <PlotStatusBadge status={b.status === 'completed' ? 'sold' : 'booked'} />
                      {b.status === 'pending' && (
                        <div className="flex items-center gap-2">
                          <Button size="sm" onClick={() => handleBookingAction(b._id, 'approve')} className="h-9 px-4 font-bold">Approve</Button>
                          <Button size="sm" variant="outline" onClick={() => handleBookingAction(b._id, 'reject')} className="h-9 px-4 font-bold border-red/20 text-red hover:bg-red-light">Reject</Button>
                        </div>
                      )}
                      {b.status === 'approved' && (
                        <Button size="sm" onClick={() => handleBookingAction(b._id, 'complete')} className="h-9 px-6 font-bold bg-primary hover:bg-primary-dark">Mark as Sold</Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}

        {tab === 'brokers' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-1 border-border/60 shadow-sm h-fit">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold text-text mb-1">Invite Broker</h3>
                <p className="text-xs text-muted mb-6">Brokers will be able to view plots and request bookings.</p>
                <form onSubmit={inviteBroker} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text/70 uppercase tracking-wider pl-1">Broker Name</label>
                    <Input placeholder="Enter broker name" value={brokerForm.name} onChange={(e) => setBrokerForm({ ...brokerForm, name: e.target.value })} className="h-11 border-border/60 bg-bg/50" required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text/70 uppercase tracking-wider pl-1">Email Address</label>
                    <Input type="email" placeholder="broker@example.com" value={brokerForm.email} onChange={(e) => setBrokerForm({ ...brokerForm, email: e.target.value })} className="h-11 border-border/60 bg-bg/50" required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text/70 uppercase tracking-wider pl-1">Phone Number</label>
                    <Input type="tel" placeholder="9876543210" value={brokerForm.phone} onChange={(e) => setBrokerForm({ ...brokerForm, phone: e.target.value })} className="h-11 border-border/60 bg-bg/50" required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text/70 uppercase tracking-wider pl-1">Commission (%)</label>
                    <Input type="number" placeholder="2" value={brokerForm.commissionPercent} onChange={(e) => setBrokerForm({ ...brokerForm, commissionPercent: e.target.value })} className="h-11 border-border/60 bg-bg/50" />
                  </div>
                  <Button type="submit" className="w-full h-11 font-bold gap-2 shadow-sm">
                    <UserPlus size={18} /> Send Invitation
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div className="lg:col-span-2 space-y-4">
              <h3 className="text-lg font-bold text-text pl-1">Active Brokers</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(project.brokers || []).filter((b) => b.status !== 'revoked').map((b, i) => (
                  <Card key={b._id || i} className="p-5 border-border/60 shadow-sm hover:shadow-card-hover transition-all bg-card flex items-center justify-between group">
                    <div className="space-y-1.5">
                      <p className="font-black text-text text-lg leading-tight group-hover:text-primary transition-colors">
                        {b.userId?.name || 'Broker'}
                      </p>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-muted flex items-center gap-1">
                          <span className="opacity-70">✉️</span> {b.userId?.email || b.userId?.phone}
                        </span>
                        <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                          {b.commissionPercent}% COMM
                        </span>
                        <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider",
                          b.status === 'active' ? 'bg-emerald/10 text-emerald' : 'bg-amber/10 text-amber')}>
                          {b.status}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        const brokerId = getBrokerUserId(b)
                        if (brokerId && window.confirm('Revoke access for this broker?')) {
                          await projectsApi.revokeBroker(id, brokerId)
                          load()
                        }
                      }}
                      className="p-2 text-muted hover:text-red hover:bg-red-light rounded-lg transition-all"
                    >
                      <Trash2 className="w-4.5 h-4.5" />
                    </button>
                  </Card>
                ))}
                {(project.brokers || []).filter((b) => b.status !== 'revoked').length === 0 && (
                  <div className="col-span-2 py-12 text-center bg-bg/30 rounded-2xl border border-dashed border-border">
                    <p className="text-sm text-muted">No brokers invited to this project yet.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'documents' && (
          <div className="space-y-6">
            <Card className="border-border/60 shadow-sm overflow-hidden">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold text-text mb-1">Project Documents</h3>
                <p className="text-xs text-muted mb-8">Manage legal documents, approvals, and layout maps.</p>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault()
                    const fd = new FormData(e.target)
                    try {
                      await documentsApi.upload(id, fd)
                      loadDocs()
                      e.target.reset()
                      toast.success('Document uploaded')
                    } catch (err) {
                      console.error('Document upload error:', err.response?.data)
                      toast.error(err.response?.data?.error || err.response?.data?.message || 'Upload failed')
                    }
                  }}
                  className="flex flex-wrap gap-4 items-end"
                >
                  <div className="space-y-1.5 flex-1 min-w-[200px]">
                    <label className="text-xs font-bold text-text/70 uppercase tracking-wider">File</label>
                    <div className="h-11 px-3 border border-border border-dashed rounded-xl bg-bg/30 flex items-center gap-2 cursor-pointer hover:bg-bg transition-colors">
                      <input type="file" name="file" required className="text-[11px] font-medium flex-1 cursor-pointer" />
                    </div>
                  </div>
                  <div className="space-y-1.5 flex-1 min-w-[200px]">
                    <label className="text-xs font-bold text-text/70 uppercase tracking-wider">Label</label>
                    <Input name="name" placeholder="Document Name" className="h-11 border-border/60 bg-bg/50" />
                  </div>
                  <div className="space-y-1.5 flex-1 min-w-[150px]">
                    <label className="text-xs font-bold text-text/70 uppercase tracking-wider">Category</label>
                    <select name="type" className="h-11 w-full px-3 bg-bg/50 border border-border/60 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20">
                      {['legal', 'plans', 'approvals', 'marketing', 'other'].map((t) => (
                        <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <Button type="submit" className="h-11 px-8 font-bold">Upload</Button>
                </form>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents.map((d) => (
                <Card key={d._id} className="p-4 border-border/60 shadow-sm bg-card flex items-center justify-between group">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-text truncate max-w-[150px]">{d.name}</p>
                    <p className="text-[10px] text-muted font-bold uppercase tracking-wider">{d.type}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={async () => {
                        if (!window.confirm('Delete this document?')) return
                        try {
                          await documentsApi.delete(d._id)
                          loadDocs()
                          toast.success('Document deleted')
                        } catch {
                          toast.error('Failed to delete')
                        }
                      }}
                      className="h-9 w-9 flex items-center justify-center rounded-lg text-muted hover:text-red hover:bg-red-light transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={14} />
                    </button>
                    <a href={d.fileUrl} target="_blank" rel="noreferrer"
                      className="h-9 px-4 rounded-lg bg-bg text-primary text-xs font-bold flex items-center justify-center hover:bg-primary hover:text-white transition-all border border-border/60 group-hover:border-primary/20">
                      View
                    </a>
                  </div>
                </Card>
              ))}
              {documents.length === 0 && (
                <div className="col-span-3 py-16 text-center">
                  <p className="text-sm text-muted">No documents uploaded yet.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'analytics' && (
          <div className="space-y-6">
            {analytics ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <Card className="p-6 border-transparent bg-primary-light/40 dark:bg-primary-dark/20 shadow-sm">
                    <p className="text-xs font-bold text-primary-dark/70 uppercase tracking-wider mb-2">Total Revenue</p>
                    <p className="text-3xl font-bold text-primary-dark">{formatCurrency(analytics.revenue)}</p>
                  </Card>
                  <Card className="p-6 border-transparent bg-amber-light/40 dark:bg-amber-light/5 shadow-sm">
                    <p className="text-xs font-bold text-amber/70 uppercase tracking-wider mb-2">Commissions</p>
                    <p className="text-3xl font-bold text-amber">{formatCurrency(analytics.commissions)}</p>
                  </Card>
                  <Card className="p-6 border-transparent bg-emerald-light/40 dark:bg-emerald-light/5 shadow-sm">
                    <p className="text-xs font-bold text-emerald/70 uppercase tracking-wider mb-2">Net Profit</p>
                    <p className="text-3xl font-bold text-emerald">{formatCurrency(analytics.netRevenue)}</p>
                  </Card>
                </div>

                {/* Visual Placeholder for Charts */}
                <Card className="p-8 border-border/60 shadow-sm">
                  <div className="flex items-center justify-between mb-8">
                    <h4 className="font-bold text-text">Sales Performance</h4>
                    <span className="text-xs text-muted font-medium">Last 12 Months</span>
                  </div>
                  <div className="h-64 w-full bg-bg/50 rounded-2xl flex items-center justify-center border border-dashed border-border">
                    <p className="text-sm text-muted flex items-center gap-2">
                      <BarChart2 size={16} /> Advanced charts coming soon to Pro Dashboard
                    </p>
                  </div>
                </Card>
              </div>
            ) : (
              <Card className="p-24 text-center border-border/60 border-dashed border-2 bg-card/30">
                <div className="w-20 h-20 bg-bg rounded-full flex items-center justify-center mx-auto mb-6 border border-border">
                  <BarChart2 className="w-10 h-10 text-muted" />
                </div>
                <h3 className="text-xl font-bold text-text">Advanced Analytics</h3>
                <p className="text-muted mt-2 max-w-sm mx-auto">This project doesn't have enough sales data for deep analytics yet. Complete a few sales to unlock the dashboard.</p>
                <div className="mt-8 flex justify-center gap-3">
                  <Button variant="outline" className="font-bold px-8">Upgrade Plan</Button>
                  <Button className="font-bold px-8" onClick={() => setTab('map')}>View Map</Button>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>

      {selectedPlot && (
        <div className="fixed bottom-6 right-6 w-80 shadow-2xl z-50 animate-in slide-in-from-bottom-4 duration-300">
          <Card className="bg-card border-primary/20 overflow-hidden">
            <div className="h-1 bg-primary w-full" />
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold text-muted uppercase tracking-widest">Plot Number</p>
                  <h4 className="text-2xl font-bold text-text mt-1">{selectedPlot.plotNumber}</h4>
                </div>
                <PlotStatusBadge status={selectedPlot.status} />
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4 text-left">
                <div>
                  <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Dimensions</p>
                  <p className="text-sm font-bold text-text">{selectedPlot.width || '—'} × {selectedPlot.length || '—'} ft</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Area</p>
                  <p className="text-sm font-bold text-text">{selectedPlot.areaSqft} sqft</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Cent</p>
                  <p className="text-sm font-bold text-primary">{selectedPlot.cent || '—'} Cent</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Facing</p>
                  <p className="text-sm font-bold text-text">{selectedPlot.facing || '—'}</p>
                </div>
                <div className="col-span-2 border-t border-border/40 pt-3">
                  <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Total Price</p>
                  <p className="text-lg font-black text-emerald-500">{formatCurrency(selectedPlot.price)}</p>
                </div>
              </div>
              <div className="mt-8">
                <Button variant="outline" className="w-full font-bold h-10 gap-2 border-border/60" onClick={() => setSelectedPlot(null)}>
                  Close Details
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-4xl bg-card border border-border/80 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border/40 bg-bg/50">
              <div>
                <h3 className="text-xl font-black text-text">
                  {project?.pdfUrl ? 'PDF Table Extraction Preview' : 'Image OCR Table Extraction Preview'}
                </h3>
                <p className="text-xs text-muted font-semibold uppercase tracking-wider mt-1">
                  {project?.pdfUrl ? 'Python Table Parsing Pipeline' : 'Tesseract.js OCR Translation Pipeline'}
                </p>
              </div>
              <button 
                onClick={() => setShowPreviewModal(false)}
                className="h-10 w-10 flex items-center justify-center rounded-xl bg-bg border border-border/60 hover:bg-red-light hover:text-red transition-all"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {isExtracting && !extractedPlots ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-6 text-center">
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-pulse"></div>
                    <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                  </div>
                  <div className="space-y-2 max-w-sm">
                    <h4 className="font-bold text-lg text-text">
                      {project?.pdfUrl ? 'Analyzing PDF Document...' : 'Scanning Layout Image Table...'}
                    </h4>
                    <p className="text-sm text-muted">
                      {project?.pdfUrl 
                        ? 'Spawning backend Python parser utilizing pdfplumber to accurately extract clean tabular structure...'
                        : 'Running PaddleOCR row parser to extract plot numbers and cents from your table image...'}
                    </p>
                    <div className="text-xs text-primary font-bold bg-primary/10 py-1 px-3 rounded-full inline-block animate-pulse">
                      Calculating prices dynamically at ₹{pricePerCent.toLocaleString()} per Cent
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-primary/5 border border-primary/10">
                    <div className="space-y-1">
                      <h4 className="font-bold text-text">Table Extracted Successfully!</h4>
                      <p className="text-xs text-muted">
                        We successfully parsed and structured <strong>{extractedPlots?.length} plots</strong>. Customize the columns to layout the interactive grid map perfectly.
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-black uppercase tracking-wider text-muted">Grid Columns</label>
                      <Input
                        type="number"
                        min="1"
                        max="24"
                        value={extractionCols}
                        onChange={(e) => setExtractionCols(parseInt(e.target.value) || 7)}
                        className="w-20 h-10 text-center font-bold border-border/60 bg-card"
                      />
                    </div>
                  </div>

                  {/* Table */}
                  <div className="border border-border/60 rounded-2xl overflow-hidden shadow-inner bg-bg/25">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-bg border-b border-border/40 text-[10px] font-black uppercase tracking-wider text-muted select-none">
                            <th className="px-6 py-4">Plot Number</th>
                            <th className="px-6 py-4">Width</th>
                            <th className="px-6 py-4">Length</th>
                            <th className="px-6 py-4">Area</th>
                            <th className="px-6 py-4">Cent</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Calculated Price</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30 text-sm font-medium text-text">
                          {extractedPlots?.map((plot, i) => {
                            const plotNum = plot.plotNumber || plot.plot_number || plot.PlotNo || i + 1
                            const cent = parseFloat(plot.cents ?? plot.cent ?? plot.Cent ?? 0) || 0
                            const areaSqft = plot.areaSqFeet ?? plot.area ?? plot.areaSqft ?? (cent ? cent * 435.6 : null)
                            const price = cent * pricePerCent
                            const needsReview = plot.needsReview === true
                            return (
                              <tr key={i} className={`hover:bg-primary/5 transition-colors ${needsReview ? 'bg-amber-50/60' : ''}`}>
                                <td className="px-6 py-3.5 font-bold text-primary">Plot {plotNum}</td>
                                <td className="px-6 py-3.5">{plot.widthMeters ?? plot.width ?? plot.Width ?? '—'}</td>
                                <td className="px-6 py-3.5">{plot.lengthMeters ?? plot.length ?? plot.Length ?? '—'}</td>
                                <td className="px-6 py-3.5">{areaSqft ? `${Number(areaSqft).toFixed(0)} sqft` : '—'}</td>
                                <td className="px-6 py-3.5 font-bold">{cent || '—'} Cents</td>
                                <td className="px-6 py-3.5">
                                  {needsReview ? (
                                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-1 rounded-full">Needs review</span>
                                  ) : (
                                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">OK</span>
                                  )}
                                </td>
                                <td className="px-6 py-3.5 text-right font-black text-emerald-500">₹{price.toLocaleString()}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-border/40 bg-bg/50 flex items-center justify-between gap-4">
              <div className="text-xs text-muted font-bold">
                * Prices calculated dynamically using Cent × Global Price setting.
              </div>
              <div className="flex items-center gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => setShowPreviewModal(false)}
                  className="font-bold h-11 px-6 border-border/60"
                  disabled={isExtracting}
                >
                  Cancel
                </Button>
                {extractedPlots && (
                  <Button 
                    onClick={handleConfirmExtraction}
                    className="font-bold h-11 px-8 shadow-md"
                    disabled={isExtracting}
                  >
                    {isExtracting ? 'Generating Grid...' : 'Confirm & Create Grid Map'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>

  )
}
