import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { bookingsApi } from '@/services/api'
import { formatCurrency } from '@/utils/formatCurrency'
import { 
  ClipboardList, CheckCircle2, XCircle, Clock, 
  Search, Filter, ExternalLink, User, Building2
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { PlotStatusBadge } from '@/components/PlotStatusBadge'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

export default function Bookings() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    fetchBookings()
  }, [])

  const fetchBookings = async () => {
    try {
      setLoading(true)
      const { data } = await bookingsApi.list()
      setBookings(data.bookings)
    } catch (err) {
      toast.error('Failed to load bookings')
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (id, action) => {
    try {
      if (action === 'approve') await bookingsApi.approve(id)
      else if (action === 'reject') await bookingsApi.reject(id)
      else if (action === 'complete') await bookingsApi.complete(id)
      toast.success(`Booking ${action}ed`)
      setBookings((prev) =>
        prev.map((b) => {
          if (b._id !== id) return b
          if (action === 'approve') return { ...b, status: 'approved' }
          if (action === 'reject') return { ...b, status: 'rejected' }
          return { ...b, status: 'completed' }
        }).filter((b) => b.status !== 'rejected')
      )
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed')
    }
  }

  const filteredBookings = bookings.filter(b => 
    filter === 'all' || b.status === filter
  )

  const stats = {
    pending: bookings.filter(b => b.status === 'pending').length,
    approved: bookings.filter(b => b.status === 'approved').length,
    completed: bookings.filter(b => b.status === 'completed').length,
  }

  return (
    <div className="space-y-8 pb-12 transition-all duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-text tracking-tight">Booking Management</h1>
          <p className="text-sm text-muted font-medium mt-1">Track and manage plot bookings across all your projects</p>
        </div>
        <div className="flex items-center gap-2 p-1 bg-card border border-border rounded-xl shadow-sm">
          {['all', 'pending', 'approved', 'completed'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-4 py-2 text-xs font-bold rounded-lg capitalize transition-all",
                filter === f 
                  ? "bg-primary text-white shadow-md" 
                  : "text-muted hover:text-text hover:bg-bg"
              )}
            >
              {f} {stats[f] !== undefined && `(${stats[f]})`}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-card rounded-2xl animate-pulse border border-border" />)}
        </div>
      ) : filteredBookings.length === 0 ? (
        <Card className="p-24 text-center border-border/60 border-dashed border-2 bg-card/30">
          <div className="w-20 h-20 bg-bg rounded-full flex items-center justify-center mx-auto mb-6 border border-border">
            <ClipboardList className="w-10 h-10 text-muted" />
          </div>
          <h3 className="text-xl font-bold text-text">No bookings found</h3>
          <p className="text-muted mt-2">Bookings will appear here once brokers start requesting them.</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredBookings.map((b) => (
            <Card key={b._id} className="border-border/60 shadow-sm hover:shadow-card-hover transition-all bg-card overflow-hidden">
              <div className="flex flex-col lg:flex-row items-center p-6 gap-6">
                {/* Project & Plot Info */}
                <div className="flex-1 min-w-0 w-full">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-black text-primary px-2 py-0.5 bg-primary-light rounded uppercase">Plot {b.plotId?.plotNumber}</span>
                    <Link to={`/dashboard/projects/${b.projectId?._id}`} className="text-sm font-bold text-text hover:text-primary transition-colors flex items-center gap-1">
                      <Building2 size={14} className="text-muted" /> {b.projectId?.name}
                    </Link>
                  </div>
                  <h3 className="text-xl font-bold text-text truncate">{b.customerName}</h3>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted font-bold">
                    <span className="flex items-center gap-1.5"><User size={14} /> Broker: {b.brokerId?.name}</span>
                    <span>·</span>
                    <span>{new Date(b.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Financials */}
                <div className="w-full lg:w-48">
                   <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Total Amount</p>
                   <p className="text-xl font-black text-text">{formatCurrency(b.totalAmount)}</p>
                   <p className="text-[10px] font-bold text-emerald mt-0.5">Comm: {formatCurrency(b.commissionAmount)}</p>
                </div>

                {/* Status & Actions */}
                <div className="flex items-center gap-4 w-full lg:w-auto justify-between lg:justify-end border-t lg:border-t-0 pt-4 lg:pt-0">
                  <PlotStatusBadge status={b.status === 'completed' ? 'sold' : b.status} />
                  
                  <div className="flex items-center gap-2">
                    {b.status === 'pending' && (
                      <>
                        <Button size="sm" onClick={() => handleAction(b._id, 'approve')} className="h-9 px-4 font-bold shadow-sm">Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => handleAction(b._id, 'reject')} className="h-9 px-4 font-bold border-red/20 text-red hover:bg-red-light">Reject</Button>
                      </>
                    )}
                    {b.status === 'approved' && (
                      <Button size="sm" onClick={() => handleAction(b._id, 'complete')} className="h-9 px-6 font-bold bg-primary hover:bg-primary-dark shadow-sm">Complete Sale</Button>
                    )}
                    <Link to={`/dashboard/projects/${b.projectId?._id}`} className="p-2 text-muted hover:text-primary transition-colors">
                      <ExternalLink size={18} />
                    </Link>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
