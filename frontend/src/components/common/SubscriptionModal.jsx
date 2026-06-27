import { useState } from 'react'
import { X, Check, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { subscriptionApi } from '@/services/api'
import { useAuth } from '@/context/AuthContext'
import { toast } from 'react-hot-toast'

const PLANS = [
  { key: 'free', name: 'Basic', price: '₹0', features: ['3 projects', '3 brokers per project', '1GB storage', 'Plot map'] },
  { key: 'pro', name: 'Pro', price: '₹799/mo', features: ['Unlimited projects', 'Unlimited brokers', 'Commission tracking', '10GB vault', 'Analytics'], highlight: true },
  { key: 'agency', name: 'Enterprise', price: '₹2,499/mo', features: ['Everything in Pro', 'Team accounts', '50GB storage', 'Priority support'] },
]

export default function SubscriptionModal({ open, onClose }) {
  const { user, refreshUser } = useAuth()
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [success, setSuccess] = useState(false)
  const [form, setForm] = useState({ cardNumber: '', expiry: '', cvv: '', name: '' })

  if (!open) return null

  const handlePay = async (e) => {
    e.preventDefault()
    if (!selectedPlan) return toast.error('Select a plan first')
    setProcessing(true)
    await new Promise((r) => setTimeout(r, 2000))
    try {
      await subscriptionApi.devUpgrade(selectedPlan)
      await refreshUser()
      setSuccess(true)
      toast.success('Subscription Updated Successfully!')
      setTimeout(() => { setSuccess(false); onClose(); }, 1500)
    } catch {
      toast.error('Failed to update subscription')
    } finally {
      setProcessing(false)
    }
  }

  const current = PLANS.find((p) => p.key === (user?.plan || 'free')) || PLANS[0]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-3xl glass-card p-6 md:p-8 animate-scale-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-text">Manage Subscription</h2>
            <p className="text-sm text-muted mt-1">Current plan: <span className="text-accent font-semibold capitalize">{current.name}</span></p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-border/20 text-muted"><X size={20} /></button>
        </div>

        {success ? (
          <div className="py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-4">
              <Check size={32} className="text-accent" />
            </div>
            <p className="text-xl font-bold text-text">Subscription Updated Successfully!</p>
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-3 gap-4 mb-8">
              {PLANS.map((plan) => (
                <button
                  key={plan.key}
                  type="button"
                  onClick={() => setSelectedPlan(plan.key)}
                  className={cn(
                    'text-left p-5 rounded-2xl border transition-all card-hover',
                    selectedPlan === plan.key ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'border-border/50 bg-bg/30',
                    plan.highlight && 'md:-mt-2 md:mb-2'
                  )}
                >
                  <p className="font-bold text-text">{plan.name}</p>
                  <p className="text-2xl font-black text-primary my-2">{plan.price}</p>
                  <ul className="space-y-1">
                    {plan.features.map((f) => (
                      <li key={f} className="text-xs text-muted flex items-center gap-1"><Check size={12} className="text-accent" /> {f}</li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>

            {selectedPlan && (
              <form onSubmit={handlePay} className="space-y-4 border-t border-border/40 pt-6">
                <p className="text-sm font-semibold text-text flex items-center gap-2"><CreditCard size={16} /> Demo Payment</p>
                <div className="grid md:grid-cols-2 gap-4">
                  <Input label="Card Number" placeholder="4242 4242 4242 4242" value={form.cardNumber} onChange={(e) => setForm({ ...form, cardNumber: e.target.value })} required />
                  <Input label="Name on Card" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                  <Input label="Expiry" placeholder="MM/YY" value={form.expiry} onChange={(e) => setForm({ ...form, expiry: e.target.value })} required />
                  <Input label="CVV" placeholder="123" value={form.cvv} onChange={(e) => setForm({ ...form, cvv: e.target.value })} required />
                </div>
                <Button type="submit" disabled={processing} className="w-full h-12">
                  {processing ? 'Payment Processing...' : 'Select Plan & Pay'}
                </Button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}
