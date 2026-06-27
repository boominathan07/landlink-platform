import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { projectsApi } from '@/services/api'
import { Card } from '@/components/ui/card'
import { StatsBar } from '@/components/StatsBar'

export default function BrokerProjects() {
  const [projects, setProjects] = useState([])

  useEffect(() => {
    projectsApi.list().then(({ data }) => setProjects(data.projects))
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="page-title text-text">My Projects</h1>
      <p className="text-sm text-muted">Projects assigned to you after accepting invitations.</p>
      <div className="space-y-4">
        {projects.map((p) => (
          <Link key={p._id} to={`/broker/projects/${p._id}`}>
            <Card className="p-5 hover:border-primary/40 transition-colors">
              <h2 className="font-semibold">{p.name}</h2>
              <p className="text-sm text-muted">{p.location?.district}</p>
              <div className="mt-4"><StatsBar stats={p.stats} /></div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
