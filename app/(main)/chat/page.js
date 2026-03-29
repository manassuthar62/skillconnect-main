'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getSupabase } from '@/lib/supabase';
import { MessageCircle, UserPlus } from 'lucide-react';
import { motion } from 'framer-motion';
import UserAvatar from '@/components/UserAvatar';
import styles from './chat.module.css';

const getChatId = (a, b) => [a, b].sort().join('_');

export default function ChatPage() {
  const { currentUser } = useAuth();
  const [connections, setConnections] = useState([]);
  const [chatMeta,    setChatMeta]    = useState({}); // chatId → { lastMsg, unread }
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      const sb = getSupabase();

      // Get all accepted connections (both directions)
      const [{ data: sent }, { data: recv }] = await Promise.all([
        sb.from('connection_requests').select('to_uid').eq('from_uid', currentUser.id).eq('status', 'accepted'),
        sb.from('connection_requests').select('from_uid').eq('to_uid', currentUser.id).eq('status', 'accepted'),
      ]);
      const ids = [...(sent || []).map(r => r.to_uid), ...(recv || []).map(r => r.from_uid)];
      if (!ids.length) { setLoading(false); return; }

      const { data: users } = await sb.from('users').select('*').in('id', ids);
      setConnections(users || []);

      // For each connection, get last message + unread count
      const metaEntries = await Promise.all(
        ids.map(async uid => {
          const chatId = getChatId(currentUser.id, uid);
          const [{ data: lastMsgs }, { count: unread }] = await Promise.all([
            sb.from('messages').select('text, created_at, sender_id').eq('chat_id', chatId)
              .order('created_at', { ascending: false }).limit(1),
            sb.from('messages').select('id', { count: 'exact' })
              .eq('chat_id', chatId).eq('sender_id', uid).eq('read', false),
          ]);
          return [chatId, { lastMsg: lastMsgs?.[0] || null, unread: unread || 0 }];
        })
      );
      setChatMeta(Object.fromEntries(metaEntries));
      setLoading(false);
    })();
  }, [currentUser]);

  // Real-time: new message → update last message + unread count
  useEffect(() => {
    if (!currentUser || connections.length === 0) return;
    const sb = getSupabase();
    const ch = sb.channel('chat-list-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new;
          setChatMeta(prev => {
            if (!prev[msg.chat_id]) return prev;
            return {
              ...prev,
              [msg.chat_id]: {
                lastMsg: msg,
                unread: msg.sender_id !== currentUser.id
                  ? (prev[msg.chat_id]?.unread || 0) + 1
                  : prev[msg.chat_id]?.unread || 0,
              }
            };
          });
        })
      .subscribe();
    return () => sb.removeChannel(ch);
  }, [currentUser, connections]);

  const fmtTime  = ts => {
    if (!ts) return '';
    const d = new Date(ts), now = new Date();
    if (d.toDateString() === now.toDateString())
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const yest = new Date(now); yest.setDate(now.getDate() - 1);
    if (d.toDateString() === yest.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  };

  return (
    <div className="page" style={{ background: 'var(--surface)' }}>
      <div className="wa-header">
        <div className="wa-header-title">Chats</div>
        <div className="wa-header-actions">
          <button className="wa-icon-btn" onClick={() => router.push('/discover')} title="New chat">
            <UserPlus size={20} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="empty-state"><div className="spinner" /></div>
      ) : connections.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><MessageCircle size={28} /></div>
          <h3>No chats yet</h3>
          <p>Go to Discover to connect with people</p>
          <button className="btn btn-primary btn-sm" onClick={() => router.push('/discover')}>
            <UserPlus size={14} /> Find People
          </button>
        </div>
      ) : (
        <div className="wa-list">
          {connections
            .sort((a, b) => {
              const ta = chatMeta[getChatId(currentUser?.id, a.id)]?.lastMsg?.created_at || '';
              const tb = chatMeta[getChatId(currentUser?.id, b.id)]?.lastMsg?.created_at || '';
              return tb.localeCompare(ta);
            })
            .map((user, i) => {
              const cid    = getChatId(currentUser?.id, user.id);
              const meta   = chatMeta[cid] || {};
              const unread = meta.unread || 0;
              const last   = meta.lastMsg;
              const isMine = last?.sender_id === currentUser?.id;

              return (
                <motion.div key={user.id} className="wa-list-item"
                  onClick={() => {
                    // Clear unread count when opening chat
                    setChatMeta(p => ({ ...p, [cid]: { ...p[cid], unread: 0 } }));
                    router.push(`/chat/${user.id}`);
                  }}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}>

                  <div style={{ position: 'relative' }}>
                    <UserAvatar user={user} size={50} className="avatar" />
                    <div className="status-dot online" style={{ position: 'absolute', bottom: 1, right: 1, border: '2px solid var(--surface)' }} />
                  </div>

                  <div className="wa-list-item-info">
                    <div className="wa-list-item-top">
                      <span className="wa-list-item-name">{user.name}</span>
                      {last && <span style={{ fontSize: 11, color: unread > 0 ? 'var(--accent)' : 'var(--t3)' }}>
                        {fmtTime(last.created_at)}
                      </span>}
                    </div>
                    <div className="wa-list-item-bottom">
                      <span className="wa-list-item-preview" style={{ color: unread > 0 ? 'var(--t1)' : 'var(--t3)', fontWeight: unread > 0 ? 500 : 400 }}>
                        {isMine ? '✓ ' : ''}{last?.text || 'Tap to chat'}
                      </span>
                      {unread > 0 && (
                        <span style={{
                          background: 'var(--accent)', color: '#000',
                          borderRadius: 999, minWidth: 20, height: 20,
                          fontSize: 11, fontWeight: 700, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          padding: '0 5px',
                        }}>{unread}</span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
        </div>
      )}
    </div>
  );
}
