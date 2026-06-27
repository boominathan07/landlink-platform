import { useEffect, useState } from 'react'
import { bookingsApi } from '@/services/api'
import { PlotStatusBadge } from '@/components/PlotStatusBadge'

const fmtDate = (d) => (d ? new Date(d).toLocaleString('en-IN') : '—')

function plotMetric(plot, ...keys) {
  if (!plot) return '—'
  for (const k of keys) {
    if (plot[k] != null && plot[k] !== '') return plot[k]
  }
  return '—'
}

export default function BrokerBookings() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    bookingsApi.list()
      .then(({ data }) => setBookings(data.bookings || []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6 page-enter">
      <div>
        <h1 className="page-title text-text">My Bookings</h1>
        <p className="text-sm text-muted mt-1">All bookings you have created across assigned projects.</p>
      </div>

      {loading ? (
        <div className="animate-pulse h-48 rounded-xl bg-card border border-border" />
      ) : bookings.length === 0 ? (
        <div className="glass-card p-10 text-center text-muted text-sm">No bookings yet.</div>
      ) : (
        <div className="glass-card overflow-hidden border border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="border-b border-border bg-bg/60 text-left">
                  <th className="px-4 py-3 font-semibold text-muted">Project</th>
                  <th className="px-4 py-3 font-semibold text-muted">Plot</th>
                  <th className="px-4 py-3 font-semibold text-muted">Width</th>
                  <th className="px-4 py-3 font-semibold text-muted">Length</th>
                  <th className="px-4 py-3 font-semibold text-muted">Cent</th>
                  <th className="px-4 py-3 font-semibold text-muted">Status</th>
                  <th className="px-4 py-3 font-semibold text-muted">Client</th>
                  <th className="px-4 py-3 font-semibold text-muted">Booking Date</th>
                  <th className="px-4 py-3 font-semibold text-muted">Hold Expiry</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => {
                  const plot = b.plotId
                  return (
                    <tr key={b._id} className="border-b border-border/50 hover:bg-bg/40">
                      <td className="px-4 py-3 font-medium text-text">{b.projectId?.name || '—'}</td>
                      <td className="px-4 py-3">{plotMetric(plot, 'plotNumber')}</td>
                      <td className="px-4 py-3">{plotMetric(plot, 'width', 'widthMeters')}</td>
                      <td className="px-4 py-3">{plotMetric(plot, 'length', 'lengthMeters')}</td>
                      <td className="px-4 py-3">{plotMetric(plot, 'cent', 'cents')}</td>
                      <td className="px-4 py-3">
                        <PlotStatusBadge status={b.status === 'completed' ? 'sold' : b.status === 'pending' ? 'booked' : plot?.status || b.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-text">{b.customerName || '—'}</div>
                        <div className="text-xs text-muted">{b.customerPhone || ''}</div>
                      </td>
                      <td className="px-4 py-3 text-muted whitespace-nowrap">{fmtDate(b.createdAt)}</td>
                      <td className="px-4 py-3 text-muted whitespace-nowrap">{fmtDate(plot?.holdExpiry)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
