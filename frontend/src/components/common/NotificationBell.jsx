import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { notificationsApi } from '../../services/api';
import { useSocket } from '../../context/SocketContext';

const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef();
  const { socket } = useSocket() || {};

  useEffect(() => {
    fetchNotifications();
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on('notification:new', (notif) => {
      setNotifications(prev => [notif, ...prev]);
      setUnread(prev => prev + 1);
    });
    return () => socket.off('notification:new');
  }, [socket]);

  const fetchNotifications = async () => {
    try {
      const { data } = await notificationsApi.list();
      setNotifications(data.notifications || []);
      setUnread((data.notifications || []).filter(n => !n.read).length);
    } catch (err) {}
  };

  const markRead = async (id) => {
    try {
      await notificationsApi.markRead(id);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
      setUnread(prev => Math.max(0, prev - 1));
    } catch (err) {}
  };

  const markAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnread(0);
    } catch (err) {}
  };

  const typeColors = {
    booking_request: '#BA7517',
    booking_approved: '#1D9E75',
    booking_rejected: '#A32D2D',
    commission_earned: '#1D9E75',
    broker_joined: '#185FA5',
    document_uploaded: '#534AB7',
    hold_expired: '#5F5E5A',
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative w-10 h-10 flex items-center justify-center rounded-xl hover:bg-primary/10 transition-colors"
      >
        <Bell size={18} className="text-muted" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-accent text-bg text-[9px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-80 glass-card z-50 animate-scale-in overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
            <h3 className="text-sm font-bold text-text">Notifications</h3>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-accent font-semibold hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted">All caught up!</div>
            ) : (
              notifications.slice(0, 10).map((notif) => (
                <div
                  key={notif._id}
                  onClick={() => !notif.read && markRead(notif._id)}
                  className={`flex gap-3 px-4 py-3 border-b border-border/20 hover:bg-primary/5 cursor-pointer transition-colors ${!notif.read ? 'bg-primary/5' : ''}`}
                >
                  <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: typeColors[notif.type] || 'var(--primary)' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-text leading-snug">{notif.title}</p>
                    <p className="text-xs text-muted mt-0.5 leading-snug">{notif.message}</p>
                    <p className="text-[10px] text-muted/60 mt-1">
                      {new Date(notif.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {!notif.read && <div className="w-1.5 h-1.5 bg-accent rounded-full mt-1.5 flex-shrink-0" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
export default NotificationBell;
