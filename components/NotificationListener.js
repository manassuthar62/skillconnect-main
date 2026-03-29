'use client';
import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getSupabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

export default function NotificationListener() {
  const { currentUser } = useAuth();
  const seenIds = useRef(new Set());
  const toastMap = useRef({});   // notif_id → toast_id
  const fromUidToNotifId = useRef({}); // from_uid → notif_id

  useEffect(() => {
    if (!currentUser) return;
    const sb = getSupabase();

    const channel = sb.channel(`notif-listener-${currentUser.id}`)
      // 🔔 New notification inserted → show toast
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${currentUser.id}`,
      }, (payload) => {
        const n = payload.new;
        if (seenIds.current.has(n.id)) return;
        seenIds.current.add(n.id);

        if (n.type === 'connection_request') {
          const toastId = toast(`🤝 ${n.from_name || 'Someone'} wants to connect with you!`, {
            duration: 6000, icon: '🔔',
          });
          toastMap.current[n.id] = toastId;
          fromUidToNotifId.current[n.from_uid] = n.id;
        } else if (n.type === 'connection_accepted') {
          toast.success(`✅ ${n.from_name || 'Someone'} accepted your request!`, { duration: 5000 });
        } else if (n.type === 'message') {
          toast(`💬 New message from ${n.from_name || 'Someone'}`, { duration: 4000 });
        }
      })
      // ✅ Broadcast: sender cancelled their request → dismiss toast immediately
      // Uses Supabase Broadcast (no RLS / REPLICA IDENTITY needed)
      .on('broadcast', { event: 'cancel_request' }, ({ payload }) => {
        const { from_uid } = payload || {};
        if (!from_uid) return;

        const notifId = fromUidToNotifId.current[from_uid];
        if (notifId) {
          if (toastMap.current[notifId]) {
            toast.dismiss(toastMap.current[notifId]);
            delete toastMap.current[notifId];
          }
          seenIds.current.delete(notifId);
          delete fromUidToNotifId.current[from_uid];
        }
      })
      .subscribe();

    return () => sb.removeChannel(channel);
  }, [currentUser]);

  return null;
}
