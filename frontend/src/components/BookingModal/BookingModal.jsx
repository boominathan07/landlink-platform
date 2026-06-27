import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { PlotStatusBadge } from '../PlotStatusBadge'
import { formatCurrency } from '@/utils/formatCurrency'
import { bookingsApi, plotsApi } from '@/services/api'

export function BookingModal({ plot, projectId, open, onClose, onSuccess }) {
  const [mode, setMode] = useState(null)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    advanceAmount: '',
    totalAmount: plot?.price?.toString() || '',
    paymentMode: 'cash',
    notes: '',
  })

  if (!open || !plot) return null

  const handleHold = async () => {
    setLoading(true)
    try {
      await plotsApi.hold(plot._id)
      onSuccess?.(plot._id, { status: 'hold' })
      onClose()
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to hold plot')
    } finally {
      setLoading(false)
    }
  }

  const handleBook = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await bookingsApi.create({
        projectId,
        plotId: plot._id,
        ...form,
        advanceAmount: Number(form.advanceAmount) || 0,
        totalAmount: Number(form.totalAmount) || plot.price,
      })
      onSuccess?.(plot._id, { status: 'booked' })
      onClose()
    } catch (err) {
      alert(err.response?.data?.message || 'Booking failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-md bg-card rounded-xl shadow-xl max-h-[90vh] overflow-y-auto border border-border">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold">Plot {plot.plotNumber}</h2>
            <PlotStatusBadge status={plot.status} className="mt-1" />
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-bg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted">Dimensions</p>
              <p className="font-medium">{plot.width || '—'} × {plot.length || '—'} ft</p>
            </div>
            <div>
              <p className="text-muted">Area</p>
              <p className="font-medium">{plot.areaSqft} sqft</p>
            </div>
            <div>
              <p className="text-muted">Cent</p>
              <p className="font-medium text-primary">{plot.cent || '—'} Cent</p>
            </div>
            <div>
              <p className="text-muted">Facing</p>
              <p className="font-medium">{plot.facing || '—'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-muted">Price</p>
              <p className="font-semibold text-lg">{formatCurrency(plot.price)}</p>
            </div>
          </div>

          {!mode && (
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={handleHold} disabled={loading}>
                Hold 24hrs
              </Button>
              <Button className="flex-1" onClick={() => setMode('book')} disabled={loading}>
                Book Now
              </Button>
            </div>
          )}

          {mode === 'book' && (
            <form onSubmit={handleBook} className="space-y-3">
              <Input
                label="Customer Name"
                required
                value={form.customerName}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              />
              <Input
                label="Customer Phone"
                value={form.customerPhone}
                onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
              />
              <Input
                label="Address"
                value={form.customerAddress}
                onChange={(e) => setForm({ ...form, customerAddress: e.target.value })}
              />
              <Input
                label="Advance Amount (₹)"
                type="number"
                value={form.advanceAmount}
                onChange={(e) => setForm({ ...form, advanceAmount: e.target.value })}
              />
              <Input
                label="Total Amount (₹)"
                type="number"
                required
                value={form.totalAmount}
                onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
              />
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Payment Mode</label>
                <select
                  className="w-full h-10 rounded-[10px] border border-border bg-bg text-text px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={form.paymentMode}
                  onChange={(e) => setForm({ ...form, paymentMode: e.target.value })}
                >
                  <option value="cash" className="bg-card text-text">Cash</option>
                  <option value="cheque" className="bg-card text-text">Cheque</option>
                  <option value="bank_transfer" className="bg-card text-text">Bank Transfer</option>
                  <option value="upi" className="bg-card text-text">UPI</option>
                </select>
              </div>
              <Input
                label="Notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setMode(null)}>
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? 'Submitting...' : 'Submit Booking'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

