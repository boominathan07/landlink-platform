import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Calendar, User, FolderKanban, Check, X } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { projectsApi } from '@/services/api'
import { Button } from '@/components/ui/button'

export default function BrokerInvitation() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [invitation, setInvitation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)

  useEffect(() => {
    if (projectId) {
      projectsApi.getInvitation(projectId)
        .then(({ data }) => setInvitation(data.invitation))
        .catch((err) => {
          toast.error(err.response?.data?.message || 'Invitation not found')
          setInvitation(null)
        })
        .finally(() => setLoading(false))
      return
    }

    projectsApi.listPendingInvitations()
      .then(({ data }) => {
        const list = data.invitations || []
        if (list.length === 1) {
          navigate(`/broker/invitations/${list[0].projectId}`, { replace: true })
        }
      })
      .finally(() => setLoading(false))
  }, [projectId, navigate])

  const [pendingList, setPendingList] = useState([])

  useEffect(() => {
    if (!projectId) {
      projectsApi.listPendingInvitations()
        .then(({ data }) => setPendingList(data.invitations || []))
        .catch(() => setPendingList([]))
    }
  }, [projectId])

  const handleAccept = async () => {
    const id = projectId || invitation?.projectId
    if (!id) return
    setActing(true)
    try {
      await projectsApi.acceptInvitation(id)
      toast.success('Invitation accepted! Project added to your dashboard.')
      navigate('/broker/projects')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to accept invitation')
    } finally {
      setActing(false)
    }
  }

  const handleDecline = async () => {
    const id = projectId || invitation?.projectId
    if (!id) return
    if (!window.confirm('Decline this project invitation?')) return
    setActing(true)
    try {
      await projectsApi.declineInvitation(id)
      toast.success('Invitation declined.')
      navigate('/broker/notifications')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to decline invitation')
    } finally {
      setActing(false)
    }
  }

  if (loading) {
    return <div className="animate-pulse h-48 rounded-xl bg-card border border-border" />
  }

  if (!projectId) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="page-title text-text">Project Invitations</h1>
          <p className="text-sm text-muted mt-1">Review and respond to project invitations from owners.</p>
        </div>
        {pendingList.length === 0 ? (
          <div className="glass-card p-10 text-center text-muted">
            <p>No pending invitations.</p>
            <Link to="/broker" className="text-primary text-sm font-medium mt-4 inline-block">Back to dashboard</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingList.map((inv) => (
              <Link
                key={inv.projectId}
                to={`/broker/invitations/${inv.projectId}`}
                className="glass-card p-5 flex items-center justify-between gap-4 hover:border-primary/30 transition-colors"
              >
                <div>
                  <p className="font-semibold text-text">{inv.projectName}</p>
                  <p className="text-sm text-muted">From {inv.ownerName}</p>
                </div>
                <span className="text-xs text-primary font-medium">Review →</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (!invitation) {
    return (
      <div className="text-center py-16">
        <p className="text-muted mb-4">This invitation is no longer available.</p>
        <Link to="/broker/invitations"><Button variant="outline">All Invitations</Button></Link>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto space-y-6 page-enter">
      <div>
        <Link to="/broker/invitations" className="text-sm text-muted hover:text-primary">← Invitations</Link>
        <h1 className="page-title text-text mt-2">Project Invitation</h1>
        <p className="text-sm text-muted mt-1">You've been invited to broker a project on LandLink.</p>
      </div>

      <div className="glass-card p-6 md:p-8 space-y-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <FolderKanban size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Project Name</p>
            <p className="text-xl font-bold text-text mt-1">{invitation.projectName}</p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-bg border border-border flex items-center justify-center text-muted shrink-0">
            <User size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Owner Name</p>
            <p className="text-lg font-semibold text-text mt-1">{invitation.ownerName}</p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-bg border border-border flex items-center justify-center text-muted shrink-0">
            <Calendar size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Invitation Date</p>
            <p className="text-lg font-semibold text-text mt-1">
              {invitation.invitedAt ? new Date(invitation.invitedAt).toLocaleString('en-IN') : '—'}
            </p>
          </div>
        </div>

        {invitation.commissionPercent != null && (
          <p className="text-sm text-muted">Commission: <span className="text-text font-medium">{invitation.commissionPercent}%</span></p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button onClick={handleAccept} disabled={acting} className="flex-1 gap-2">
            <Check size={16} /> Accept
          </Button>
          <Button onClick={handleDecline} disabled={acting} variant="outline" className="flex-1 gap-2 text-red border-red/30 hover:bg-red-light">
            <X size={16} /> Decline
          </Button>
        </div>
      </div>
    </div>
  )
}
