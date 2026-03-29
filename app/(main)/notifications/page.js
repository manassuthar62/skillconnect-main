'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getSupabase } from '@/lib/supabase';
import { sendPushNotification } from '@/lib/pushClient';
import Image from 'next/image';
import { Bell, Check, X, UserCheck, Clock, Send } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import styles from './notifications.module.css';

export default function NotificationsPage() {
  const { currentUser, userProfile, refreshProfile } = useAuth();
  const [incoming, setIncoming] = useState([]);   // requests I received
  const [outgoing, setOutgoing] = useState([]);   // requests I sent
  const [otherNotifs, setOtherNotifs] = useState([]); // accepted, messages etc
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({});

  useEffect(() => {
    if (!currentUser) return;
    const sb = getSupabase();
    let cleanup = () => {};

    (async () => {
      const [{ data: notifData }, { data: sent }] = await Promise.all([
        sb.from('notifications').select('*')
          .eq('user_id', currentUser.id).order('created_at', { ascending: false }),
        sb.from('connection_requests').select('*, users!connection_requests_to_uid_fkey(*)')
          .eq('from_uid', currentUser.id).order('created_at', { ascending: false }),
      ]);

      // Filter out cancelled notifications on load
      const inc = (notifData || []).filter(n =>
        n.type === 'connection_request' && n.status !== 'cancelled'
      );
      const other = (notifData || []).filter(n => n.type !== 'connection_request');
      setIncoming(inc);
      setOtherNotifs(other);
      setOutgoing(sent || []);
      setLoading(false);
    })();

    // ✅ Realtime channel — Broadcast for instant cancel + postgres_changes for other events
    const channel = sb.channel(`notifs-page-${currentUser.id}`)

      // 🗑️ Broadcast: sender cancelled → remove from UI immediately (no RLS/REPLICA IDENTITY needed)
      .on('broadcast', { event: 'cancel_request' }, ({ payload }) => {
        const { from_uid } = payload || {};
        if (from_uid) {
          setIncoming(p => p.filter(n => n.from_uid !== from_uid));
        }
      })

      // 🗑️ DB DELETE fallback (works if REPLICA IDENTITY FULL is set)
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${currentUser.id}`,
      }, (payload) => {
        const deletedId = payload.old?.id;
        if (deletedId) {
          setIncoming(p => p.filter(n => n.id !== deletedId));
          setOtherNotifs(p => p.filter(n => n.id !== deletedId));
        }
      })

      // 🔔 New notification inserted → replace duplicate from same sender
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${currentUser.id}`,
      }, (payload) => {
        const n = payload.new;
        if (n.type === 'connection_request') {
          setIncoming(p => [n, ...p.filter(x => x.from_uid !== n.from_uid)]);
        } else {
          setOtherNotifs(p => [n, ...p]);
        }
      })
      .subscribe();

    cleanup = () => sb.removeChannel(channel);
    return () => cleanup();
  }, [currentUser]);


  // Mark all as read
  useEffect(() => {
    if (!currentUser || loading) return;
    const sb = getSupabase();
    sb.from('notifications').update({ read: true }).eq('user_id', currentUser.id).eq('read', false)
      .then(({ error }) => { if (error) console.error('Failed to mark notifications read:', error); });
  }, [currentUser, loading]);

  const acceptRequest = async (notif) => {
    if (busy[notif.id]) return;
    setBusy(p => ({ ...p, [notif.id]: true }));
    try {
      const sb = getSupabase();
      await sb.from('connection_requests').update({ status: 'accepted' })
        .eq('from_uid', notif.from_uid).eq('to_uid', currentUser.id);
      const { data: them } = await sb.from('users').select('connections').eq('id', notif.from_uid).single();
      const myConns    = [...(userProfile?.connections || []), notif.from_uid];
      const theirConns = [...(them?.connections        || []), currentUser.id];
      await sb.from('users').update({ connections: myConns    }).eq('id', currentUser.id);
      await sb.from('users').update({ connections: theirConns }).eq('id', notif.from_uid);
      await sb.from('notifications').update({ status: 'accepted', read: true }).eq('id', notif.id);
      await sb.from('notifications').delete()
        .eq('user_id', notif.from_uid).eq('from_uid', currentUser.id).eq('type', 'connection_accepted');
      await sb.from('notifications').insert({
        user_id: notif.from_uid, type: 'connection_accepted',
        from_uid: currentUser.id, from_name: userProfile?.name || '',
        from_photo: userProfile?.photo_url || '', read: false,
      });
      sendPushNotification({
        targetUserId: notif.from_uid,
        title: '✅ Connection Accepted!',
        body: `${userProfile?.name || 'Someone'} accepted your request`,
        url: '/chat',
      });
      await refreshProfile();
      setIncoming(p => p.map(n => n.id === notif.id ? { ...n, status: 'accepted', read: true } : n));
      toast.success('Connection accepted! 🎉');
    } catch (e) { toast.error(e.message); }
    setBusy(p => ({ ...p, [notif.id]: false }));
  };

  const rejectRequest = async (notif) => {
    if (busy[notif.id]) return;
    setBusy(p => ({ ...p, [notif.id]: true }));
    try {
      const sb = getSupabase();
      await sb.from('connection_requests').update({ status: 'rejected' })
        .eq('from_uid', notif.from_uid).eq('to_uid', currentUser.id);
      await sb.from('notifications').update({ status: 'rejected', read: true }).eq('id', notif.id);
      setIncoming(p => p.map(n => n.id === notif.id ? { ...n, status: 'rejected', read: true } : n));
      toast.success('Request rejected');
    } catch { toast.error('Could not reject.'); }
    setBusy(p => ({ ...p, [notif.id]: false }));
  };

  const initials = n => n?.split(' ').map(c => c[0]).join('').slice(0,2).toUpperCase() || '?';
  const fmtTime  = ts => ts ? new Date(ts).toLocaleDateString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

  const StatusBadge = ({ status }) => {
    if (status === 'accepted') return <span style={{ color: '#25D366', fontSize: 12, fontWeight: 600 }}>✅ Connected</span>;
    if (status === 'rejected') return <span style={{ color: 'var(--t3)', fontSize: 12 }}>✖ Rejected</span>;
    return <span style={{ color: '#f59e0b', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={11} /> Pending</span>;
  };

  return (
    <div className={styles.page}>
      <div className="wa-header">
        <div className="wa-header-title">Alerts</div>
      </div>

      {loading ? <div className="empty-state"><div className="spinner" /></div> : (
        <div className={styles.scrollArea}>

          {/* ── Incoming Requests ── */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Bell size={16} color="var(--accent)" />
              <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--t1)' }}>
                Incoming Requests
              </span>
              <span style={{ background: 'var(--accent)', color: '#000', borderRadius: 999, fontSize: 11, fontWeight: 700, padding: '1px 7px' }}>
                {incoming.length}
              </span>
            </div>
            {incoming.length === 0
              ? <p style={{ color: 'var(--t3)', fontSize: 13 }}>No incoming requests</p>
              : incoming.map((n, i) => (
                <motion.div key={n.id} className={styles.item}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <div className={styles.avatar}>
                    {n.from_photo
                      ? <Image src={n.from_photo} alt="" width={44} height={44} className="avatar" />
                      : <div className="avatar-placeholder" style={{ width: 44, height: 44, fontSize: 15 }}>{initials(n.from_name)}</div>}
                  </div>
                  <div className={styles.info}>
                    <div className={styles.text}>
                      <span className={styles.name}>{n.from_name}</span>
                      {' wants to connect with you'}
                    </div>
                    <div className={styles.time}>{fmtTime(n.created_at)}</div>
                    {!n.status && (
                      <div className={styles.actions}>
                        <button className="btn btn-primary btn-sm" onClick={() => acceptRequest(n)} disabled={busy[n.id]}>
                          {busy[n.id] ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <><UserCheck size={13} /> Accept</>}
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => rejectRequest(n)} disabled={busy[n.id]}>
                          <X size={13} /> Reject
                        </button>
                      </div>
                    )}
                    {n.status === 'accepted' && <div className={styles.accepted}>✅ You are connected</div>}
                    {n.status === 'rejected' && <div className={styles.rejected}>✖ Rejected</div>}
                  </div>
                </motion.div>
              ))}
          </section>

          <div style={{ height: 1, background: 'var(--b1)' }} />

          {/* ── Your Sent Requests ── */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Send size={15} color="var(--accent)" />
              <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--t1)' }}>
                Your Requests
              </span>
              <span style={{ background: 'var(--surface-2)', color: 'var(--t2)', borderRadius: 999, fontSize: 11, fontWeight: 700, padding: '1px 7px', border: '1px solid var(--b1)' }}>
                {outgoing.length}
              </span>
            </div>
            {outgoing.length === 0
              ? <p style={{ color: 'var(--t3)', fontSize: 13 }}>No outgoing requests</p>
              : outgoing.map((r, i) => (
                <motion.div key={r.id} className={styles.item}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <div className={styles.avatar}>
                    {r.users?.photo_url
                      ? <Image src={r.users.photo_url} alt="" width={44} height={44} className="avatar" />
                      : <div className="avatar-placeholder" style={{ width: 44, height: 44, fontSize: 15 }}>{initials(r.users?.name)}</div>}
                  </div>
                  <div className={styles.info}>
                    <div className={styles.text}>
                      <span className={styles.name}>{r.users?.name || 'Unknown'}</span>
                    </div>
                    <div className={styles.time}>{fmtTime(r.created_at)}</div>
                    <div style={{ marginTop: 4 }}><StatusBadge status={r.status} /></div>
                  </div>
                </motion.div>
              ))}
          </section>

          {/* Other notifications (accepted messages etc) */}
          {otherNotifs.length > 0 && (
            <>
              <div style={{ height: 1, background: 'var(--b1)' }} />
              <section>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--t1)', marginBottom: 10 }}>Activity</div>
                {otherNotifs.map((n, i) => (
                  <motion.div key={n.id} className={styles.item}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}>
                    <div className={styles.avatar}>
                      {n.from_photo
                        ? <Image src={n.from_photo} alt="" width={44} height={44} className="avatar" />
                        : <div className="avatar-placeholder" style={{ width: 44, height: 44, fontSize: 15 }}>{initials(n.from_name)}</div>}
                    </div>
                    <div className={styles.info}>
                      <div className={styles.text}>
                        <span className={styles.name}>{n.from_name}</span>
                        {n.type === 'connection_accepted' ? ' accepted your connection request ✅' : ''}
                        {n.type === 'message' ? ' sent you a message 💬' : ''}
                      </div>
                      <div className={styles.time}>{fmtTime(n.created_at)}</div>
                    </div>
                  </motion.div>
                ))}
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}
