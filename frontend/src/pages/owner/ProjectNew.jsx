import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { projectsApi } from '@/services/api'

export default function ProjectNew() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    district: '',
    address: '',
    totalArea: '',
    pricePerSqft: '',
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await projectsApi.create({
        name: form.name,
        location: { district: form.district, address: form.address },
        totalArea: Number(form.totalArea) || 0,
        pricePerSqft: Number(form.pricePerSqft) || 0,
      })
      navigate(`/dashboard/projects/${data.project._id}`)
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create project')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Create Project</h1>
        <p className="text-sm text-muted mt-1">Add your land layout project</p>
      </div>
      <Card>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Project Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="District" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} />
            <Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <Input label="Total Area (sqft)" type="number" value={form.totalArea} onChange={(e) => setForm({ ...form, totalArea: e.target.value })} />
            <Input label="Price per sqft (₹)" type="number" value={form.pricePerSqft} onChange={(e) => setForm({ ...form, pricePerSqft: e.target.value })} />
            <Button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create Project'}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
