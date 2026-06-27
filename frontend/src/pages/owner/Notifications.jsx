import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { notificationsApi, projectsApi } from '@/services/api'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'
import { Check, Trash2, Bell, CheckCheck, Trash, BellOff, Info } from 'lucide-react'
import { toast } from 'react-hot-toast'

const formatRelativeTime = (date) => {
  const now = new Date();
  const d = new Date(date);
  const diff = now - d;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 7) return d.toLocaleDateString();
  if (days > 1) return `${days} days ago`;
  if (days === 1) return 'yesterday';
  if (hours > 1) return `${hours} hours ago`;
  if (hours === 1) return '1 hour ago';
  if (minutes > 1) return `${minutes} minutes ago`;
  if (minutes === 1) return '1 minute ago';
  return 'just now';
};

export default function NotificationsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState(null)

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const { data } = await notificationsApi.list()
      setNotifications(data.notifications || [])
    } catch {
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifications()
  }, [])

  const markAllRead = async () => {
    try {
      await notificationsApi.markAllRead()
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      toast.success('All notifications marked as read.')
    } catch {
      toast.error('Failed to mark all as read.')
    }
  }

  const clearAll = async () => {
    if (!window.confirm('Delete all notifications?')) return
    try {
      await notificationsApi.clearAll()
      setNotifications([])
      toast.success('Notifications cleared.')
    } catch {
      toast.error('Failed to clear notifications.')
    }
  }

  const markRead = async (id) => {
    try {
      await notificationsApi.markRead(id)
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n))
    } catch {
      toast.error('Failed to update notification.')
    }
  }

  const deleteNotif = async (id) => {
    try {
      await notificationsApi.delete(id)
      setNotifications(prev => prev.filter(n => n._id !== id))
    } catch {
      toast.error('Failed to delete notification.')
    }
  }

  const handleAcceptInvite = async (projectId, notifId) => {
    setActingId(notifId)
    try {
      await projectsApi.acceptInvitation(projectId)
      await markRead(notifId)
      toast.success('Invitation accepted!')
      navigate('/broker/projects')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to accept')
    } finally {
      setActingId(null)
    }
  }

  const handleDeclineInvite = async (projectId, notifId) => {
    if (!window.confirm('Decline this invitation?')) return
    setActingId(notifId)
    try {
      await projectsApi.declineInvitation(projectId)
      await markRead(notifId)
      setNotifications(prev => prev.filter(n => n._id !== notifId))
      toast.success('Invitation declined.')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to decline')
    } finally {
      setActingId(null)
    }
  }

  const filteredNotifs = notifications.filter(n => {
    if (filter === 'unread') return !n.read
    if (filter === 'read') return n.read
    return true
  })

  return (
    <div className="w-full space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title text-text">Notifications</h1>
          <p className="text-sm text-muted mt-1 flex items-center gap-2"><Bell size={14} className="text-primary" /> Activity and alerts</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button variant="outline" onClick={markAllRead} disabled={!notifications.some(n => !n.read)} className="gap-2">
            <CheckCheck size={16} /> Mark all read
          </Button>
          <Button variant="outline" onClick={clearAll} disabled={notifications.length === 0} className="gap-2 text-red border-red/30 hover:bg-red-light">
            <Trash size={16} /> Clear all
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 p-1 bg-card border border-border rounded-xl w-fit">
        {['all', 'unread', 'read'].map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              'px-4 py-2 text-xs font-semibold rounded-lg capitalize transition-all',
              filter === f ? 'bg-primary text-white' : 'text-muted hover:text-text hover:bg-bg/60'
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 text-center"><div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : filteredNotifs.length === 0 ? (
        <Card className="p-12 text-center">
          <BellOff className="w-10 h-10 text-muted/30 mx-auto mb-4" />
          <p className="text-muted text-sm">No {filter !== 'all' ? filter : ''} notifications.</p>
        </Card>
      ) : (
        <div className="space-y-3 w-full">
          {filteredNotifs.map((n) => {
            const projectId = n.data?.projectId
            const isInvite = n.type === 'broker_invited' && user?.role === 'broker' && projectId

            return (
              <Card
                key={n._id}
                className={cn('p-4 md:p-5 transition-colors', !n.read && 'border-primary/30 bg-primary/[0.03]')}
              >
                <div className="flex flex-col sm:flex-row gap-4 sm:items-start">
                  <div className={cn(
                    'shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border',
                    !n.read ? 'bg-primary/10 text-primary border-primary/20' : 'bg-bg text-muted border-border'
                  )}>
                    <Bell size={18} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h4 className={cn('font-semibold text-text', !n.read && 'text-text')}>{n.title}</h4>
                      {!n.read && <span className="text-[10px] font-bold uppercase tracking-wide text-primary bg-primary/10 px-2 py-0.5 rounded-full">New</span>}
                    </div>
                    <p className="text-sm text-muted leading-relaxed break-words">{n.message}</p>
                    <p className="text-xs text-muted mt-2 flex items-center gap-1.5 whitespace-nowrap">
                      <Info size={12} /> {formatRelativeTime(n.createdAt)}
                    </p>

                    {isInvite && (
                      <div className="flex flex-wrap gap-2 mt-4">
                        <Button size="sm" disabled={actingId === n._id} onClick={() => handleAcceptInvite(projectId, n._id)} className="gap-1">
                          <Check size={14} /> Accept
                        </Button>
                        <Button size="sm" variant="outline" disabled={actingId === n._id} onClick={() => handleDeclineInvite(projectId, n._id)} className="gap-1">
                          Decline
                        </Button>
                        <Link to={`/broker/invitations/${projectId}`} className="text-xs text-primary font-medium self-center hover:underline">
                          View details
                        </Link>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 sm:ml-auto">
                    {!n.read && (
                      <button type="button" onClick={() => markRead(n._id)} className="p-2 rounded-lg text-primary hover:bg-primary/10 border border-border" title="Mark read">
                        <Check size={16} />
                      </button>
                    )}
                    <button type="button" onClick={() => deleteNotif(n._id)} className="p-2 rounded-lg text-muted hover:text-red hover:bg-red-light border border-border" title="Delete">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
