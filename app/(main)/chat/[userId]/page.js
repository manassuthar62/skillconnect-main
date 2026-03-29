'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useCall } from '@/context/CallContext';
import { getSupabase } from '@/lib/supabase';
import { sendPushNotification } from '@/lib/pushClient';
import UserAvatar from '@/components/UserAvatar';
import { 
  ArrowLeft, Send, Phone, Video, MoreVertical, Search as SearchIcon, X,
  Info, CheckSquare, BellOff, Timer, Lock, Heart, FileText, XCircle, ThumbsDown, Ban, MinusCircle, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

const getChatId = (a, b) => [a, b].sort().join('_');
const fmt = (ts) => ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
const fmtDate = (ts) => {
  if (!ts) return 'Today';
  const d = new Date(ts), today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yest = new Date(today); yest.setDate(today.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { day: 'numeric', month: 'long' });
};

// Double tick SVG — grey or blue
const Ticks = ({ read }) => (
  <svg width="16" height="11" viewBox="0 0 16 11" style={{ marginLeft: 2, flexShrink: 0 }}>
    <path d="M1 5.5L4.5 9 13.5 1" stroke={read ? '#4fc3f7' : '#aaa'} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5 9l4.5-8" stroke={read ? '#4fc3f7' : '#aaa'} strokeWidth="1.8" fill="none" strokeLinecap="round"/>
  </svg>
);

export default function ChatRoomPage() {
  const { userId } = useParams();
  const { currentUser } = useAuth();
  const { startCall } = useCall();
  const [messages,  setMessages]  = useState([]);
  const [text,      setText]      = useState('');
  const [otherUser, setOtherUser] = useState(null);
  const [sending,   setSending]   = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMenu,  setShowMenu]  = useState(false);
  const [isOtherOnline, setIsOtherOnline] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const bottomRef = useRef(null);
  const menuRef   = useRef(null);
  const typingTimeoutRef = useRef(null);
  const typingChannelRef = useRef(null);
  const onlineTimeoutRef = useRef(null);
  const heartbeatRef = useRef(null);
  const router    = useRouter();
  const chatId    = getChatId(currentUser?.id, userId);
  const publicProfileHref = `/u/${otherUser?.username || userId}`;

  useEffect(() => {
    if (!userId) return;
    getSupabase().from('users').select('*').eq('id', userId).single()
      .then(({ data }) => setOtherUser(data));
  }, [userId]);

  // Handle clicking outside to close menu
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const sb = getSupabase();

    // Fetch existing messages
    sb.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true })
      .then(({ data }) => {
        setMessages(data || []);
        setTimeout(() => bottomRef.current?.scrollIntoView(), 80);
      });

    // Mark all unread messages from other user as read
    sb.from('messages').update({ read: true })
      .eq('chat_id', chatId).eq('sender_id', userId).eq('read', false)
      .then(({ error }) => { if (error) console.error('Error marking read:', error); });

    // Real-time: new messages
    const ch = sb.channel(`chat:${chatId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `chat_id=eq.${chatId}`,
      }, payload => {
        const msg = payload.new;
        setMessages(p => [...p, msg]);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        // If message is from other user, mark it as read immediately
        if (msg.sender_id !== currentUser.id) {
          sb.from('messages').update({ read: true }).eq('id', msg.id)
            .then(({ error }) => { if (error) console.error('Error marking realtime read:', error); });
        }
      })
      // Real-time: message read status updates (so sender sees blue ticks)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'messages',
        filter: `chat_id=eq.${chatId}`,
      }, payload => {
        setMessages(p => p.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m));
      })
      .subscribe();

    return () => sb.removeChannel(ch);
  }, [chatId, currentUser, userId]);

  useEffect(() => {
    if (!currentUser || !userId) return;
    const sb = getSupabase();
    const presenceChannel = sb.channel(`chat-presence:${chatId}`);

    typingChannelRef.current = presenceChannel;

    presenceChannel
      .on('broadcast', { event: 'presence_ping' }, ({ payload }) => {
        if (payload?.from !== userId) return;
        setIsOtherOnline(true);
        if (onlineTimeoutRef.current) clearTimeout(onlineTimeoutRef.current);
        onlineTimeoutRef.current = setTimeout(() => setIsOtherOnline(false), 15000);
      })
      .on('broadcast', { event: 'typing_state' }, ({ payload }) => {
        if (payload?.from !== userId) return;
        setIsOtherTyping(Boolean(payload?.typing));
        if (payload?.typing) {
          setIsOtherOnline(true);
          if (onlineTimeoutRef.current) clearTimeout(onlineTimeoutRef.current);
          onlineTimeoutRef.current = setTimeout(() => setIsOtherOnline(false), 15000);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const ping = () => {
            presenceChannel.send({
              type: 'broadcast',
              event: 'presence_ping',
              payload: { from: currentUser.id, at: new Date().toISOString() },
            });
          };

          ping();
          heartbeatRef.current = setInterval(ping, 5000);
        }
      });

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (onlineTimeoutRef.current) clearTimeout(onlineTimeoutRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      typingChannelRef.current = null;
      setIsOtherOnline(false);
      setIsOtherTyping(false);
      sb.removeChannel(presenceChannel);
    };
  }, [chatId, currentUser, userId]);

  const updateTypingState = async (typing) => {
    if (!typingChannelRef.current) return;
    try {
      await typingChannelRef.current.send({
        type: 'broadcast',
        event: 'typing_state',
        payload: {
          from: currentUser?.id,
          typing,
          at: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Typing presence error:', error);
    }
  };

  const handleTextChange = (value) => {
    setText(value);
    updateTypingState(Boolean(value.trim()));

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      updateTypingState(false);
    }, 1200);
  };

  const sendMessage = async (e) => {
    e?.preventDefault();
    if (!text.trim() || sending) return;
    const msg = text.trim(); setText('');
    updateTypingState(false);
    setSending(true);
    const sb = getSupabase();
    await sb.from('chats').upsert({
      id: chatId, participants: [currentUser.id, userId],
      last_message: msg, last_message_time: new Date().toISOString(),
    });
    await sb.from('messages').insert({ chat_id: chatId, sender_id: currentUser.id, text: msg, read: false });
    setSending(false);
    
    // Trigger Background Notification for the other user
    sendPushNotification({
      targetUserId: userId,
      title: currentUser?.user_metadata?.name || 'New Message',
      body: msg,
      url: `/chat/${currentUser.id}`,
      icon: currentUser?.user_metadata?.avatar_url || '/icon-192.png'
    });

    // Auto-scroll after sending
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const handleNotImplemented = () => { 
    toast('This feature will be available shortly.', { icon: '🚧' }); 
    setShowMenu(false); 
  };

  const handleClearChat = async () => {
    if (!confirm('Are you sure you want to clear all messages? This cannot be undone locally.')) return;
    setMessages([]);
    setShowMenu(false);
    await getSupabase().from('messages').delete().eq('chat_id', chatId);
    toast.success('Chat cleared');
  };

  const handleDeleteChat = async () => {
    if (!confirm('Delete this entire chat?')) return;
    setShowMenu(false);
    await getSupabase().from('chats').delete().eq('id', chatId);
    router.push('/chat');
  };

  const filteredMessages = messages.filter(m => m.text.toLowerCase().includes(searchQuery.toLowerCase()));

  let lastDate = null;

  return (
    <div className="wa-chat-page">
      <div className="wa-chat-header">
        <button className="wa-icon-btn" onClick={() => router.push('/chat')}><ArrowLeft size={20} /></button>
        <div style={{ position: 'relative' }}>
          <UserAvatar user={otherUser} size={40} className="avatar" alt={otherUser?.name || ''} />
          <div
            className={`status-dot ${isOtherOnline ? 'online' : ''}`}
            style={{ position: 'absolute', bottom: 0, right: 0, border: '2px solid var(--header)' }}
          />
        </div>
        <div className="wa-chat-header-info" onClick={() => router.push(publicProfileHref)} style={{ cursor: 'pointer' }}>
          <div className="wa-chat-header-name">{otherUser?.name || 'Loading...'}</div>
          <div className="wa-chat-header-status">{isOtherTyping ? 'typing...' : isOtherOnline ? 'online' : 'offline'}</div>
        </div>
        <div style={{ display: 'flex', gap: 2, alignItems: 'center', position: 'relative' }}>
          <button className="wa-icon-btn" onClick={() => startCall('video', userId)}><Video size={20} /></button>
          <button className="wa-icon-btn" onClick={() => startCall('audio', userId)}><Phone size={20} /></button>
          <button className="wa-icon-btn" onClick={() => { setIsSearching(!isSearching); if(isSearching) setSearchQuery(''); }}>
            <SearchIcon size={20} color={isSearching ? 'var(--accent)' : 'var(--t2)'} />
          </button>
          <div ref={menuRef}>
            <button className="wa-icon-btn" onClick={() => setShowMenu(!showMenu)}><MoreVertical size={20} /></button>
            <AnimatePresence>
              {showMenu && (
                <motion.div 
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  style={{
                    position: 'absolute', top: 48, right: 0,
                    background: '#1c2b33', border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: 8, width: 230, zIndex: 50,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)', overflow: 'hidden',
                    display: 'flex', flexDirection: 'column', padding: '8px 0'
                  }}
                >
                  <button className="menu-item" onClick={() => router.push(publicProfileHref)}>
                    <Info size={14} fontWeight={300} /> Contact info
                  </button>
                  <button className="menu-item" onClick={handleNotImplemented}>
                    <CheckSquare size={14} fontWeight={300} /> Select messages
                  </button>
                  <button className="menu-item" onClick={handleNotImplemented}>
                    <BellOff size={14} fontWeight={300} /> Mute notifications
                  </button>
                  <button className="menu-item" onClick={handleNotImplemented}>
                    <Timer size={14} fontWeight={300} /> Disappearing messages
                  </button>
                  <button className="menu-item" onClick={handleNotImplemented}>
                    <Lock size={14} fontWeight={300} /> Lock chat
                  </button>
                  
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />
                  
                  <button className="menu-item" onClick={handleNotImplemented}>
                    <Heart size={14} fontWeight={300} /> Add to favourites
                  </button>
                  <button className="menu-item" onClick={handleNotImplemented}>
                    <FileText size={14} fontWeight={300} /> Add to list
                  </button>
                  <button className="menu-item" onClick={() => router.push('/chat')}>
                    <XCircle size={14} fontWeight={300} /> Close chat
                  </button>
                  
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />
                  
                  <button className="menu-item" onClick={handleNotImplemented}>
                    <ThumbsDown size={14} fontWeight={300} /> Report
                  </button>
                  <button className="menu-item" onClick={handleNotImplemented}>
                    <Ban size={14} fontWeight={300} /> Block
                  </button>
                  <button className="menu-item" onClick={handleClearChat}>
                    <MinusCircle size={14} fontWeight={300} /> Clear chat
                  </button>
                  <button className="menu-item danger" onClick={handleDeleteChat}>
                    <Trash2 size={14} fontWeight={300} /> Delete chat
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isSearching && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            style={{ padding: '8px 16px', background: 'var(--surface)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-2)', borderRadius: 20, padding: '0 12px' }}>
              <SearchIcon size={16} color="var(--t3)" />
              <input 
                autoFocus
                type="text" 
                placeholder="Search this chat..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--t1)', padding: '10px 8px', outline: 'none', fontSize: 14 }}
              />
              {searchQuery && <button onClick={() => setSearchQuery('')} className="wa-icon-btn" style={{ padding: 4 }}><X size={16}/></button>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="wa-chat-messages">
        {filteredMessages.length === 0 && !isSearching && (
          <div className="empty-state">
            <div style={{ fontSize: 40 }}>👋</div>
            <h3>Say hi!</h3><p>Start the conversation</p>
          </div>
        )}
        {filteredMessages.length === 0 && isSearching && (
          <div className="empty-state" style={{ marginTop: 40 }}>
            <SearchIcon size={32} color="var(--t3)" style={{ marginBottom: 12 }} />
            <p>No messages found for &quot;{searchQuery}&quot;</p>
          </div>
        )}
        {filteredMessages.map((msg) => {
          const isMine  = msg.sender_id === currentUser?.id;
          const label   = fmtDate(msg.created_at);
          const showDate = label !== lastDate; lastDate = label;
          return (
            <div key={msg.id}>
              {showDate && <div className="wa-date-sep"><span>{label}</span></div>}
              <div className={`wa-bubble-row ${isMine ? 'out' : 'in'}`}>
                <motion.div className={`wa-bubble ${isMine ? 'out' : 'in'}`}
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.15 }}>
                  <div className="wa-bubble-text">{msg.text}</div>
                  <div className="wa-bubble-meta">
                    <span className="wa-bubble-time">{fmt(msg.created_at)}</span>
                    {isMine && <Ticks read={msg.read} />}
                  </div>
                </motion.div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="wa-chat-input-area">
        <textarea className="wa-chat-input" rows={1} placeholder="Message"
          value={text}
          onChange={e => handleTextChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
        />
        <motion.button className="wa-send-btn" onClick={sendMessage}
          disabled={!text.trim() || sending} whileTap={{ scale: 0.9 }}>
          {sending ? <span className="spinner" style={{ width: 18, height: 18 }} /> : <Send size={20} />}
        </motion.button>
      </div>
    </div>
  );
}
