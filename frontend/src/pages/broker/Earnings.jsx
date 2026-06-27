import { useEffect, useState } from 'react'
import { bookingsApi } from '@/services/api'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/utils/formatCurrency'

export default function Earnings() {
  const [bookings, setBookings] = useState([])

  useEffect(() => {
    bookingsApi.list({ status: 'completed' }).then(({ data }) => setBookings(data.bookings))
  }, [])

  const total = bookings.reduce((s, b) => s + (b.commissionAmount || 0), 0)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Earnings</h1>
      <Card className="p-6 bg-accent-light">
        <p className="text-sm text-accent">Total Commission Earned</p>
        <p className="text-4xl font-semibold text-accent mt-1">{formatCurrency(total)}</p>
      </Card>
      <Card>
        <CardContent className="space-y-3">
          {bookings.map((b) => (
            <div key={b._id} className="flex justify-between py-3 border-b border-border/50">
              <span className="text-sm">Plot {b.plotId?.plotNumber} · {b.projectId?.name}</span>
              <span className="font-medium text-sm">{formatCurrency(b.commissionAmount)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
