'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getSupabase } from '@/lib/supabase';
import { sendPushNotification } from '@/lib/pushClient';
import UserAvatar from '@/components/UserAvatar';
import { ArrowLeft, MapPin, Youtube, Instagram, Linkedin, Github, Twitter, MessageCircle, Link as LinkIcon, Clock, UserPlus, UserX, MessageSquare, Zap } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PublicProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const { currentUser, refreshProfile } = useAuth();
  
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null); // 'connected' | 'pending' | null
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const sb = getSupabase();
      
      // Fetch user by username or ID
      const { data: users } = await sb.from('users').select('*')
        .or(`id.eq.${id},username.eq.${id}`);
      
      const targetUser = users?.[0];
      if (!targetUser) {
        setLoading(false);
        return;
      }
      setProfile(targetUser);

      // Fetch connection status if logged in
      if (currentUser && currentUser.id !== targetUser.id) {
        const [{ data: sentReqs }, { data: recvReqs }] = await Promise.all([
          sb.from('connection_requests').select('*').eq('from_uid', currentUser.id).eq('to_uid', targetUser.id),
          sb.from('connection_requests').select('*').eq('to_uid', currentUser.id).eq('from_uid', targetUser.id).eq('status', 'accepted'),
        ]);

        let currentStatus = null;
        if (recvReqs?.length > 0) currentStatus = 'connected';
        else if (sentReqs?.length > 0) {
          const r = sentReqs[0];
          if (r.status === 'accepted') currentStatus = 'connected';
          else if (r.status === 'pending') currentStatus = 'pending';
        }
        setStatus(currentStatus);
      }
      setLoading(false);
    })();
  }, [id, currentUser]);

  // ---------------- CONNECTION ACTIONS ----------------
  const sendRequest = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const sb = getSupabase();
      await sb.from('connection_requests').insert({
        from_uid: currentUser.id, to_uid: profile.id, status: 'pending',
      });
      // Clean up any old cancelled notification from me to this person
      await sb.from('notifications').delete()
        .eq('user_id', profile.id).eq('from_uid', currentUser.id)
        .eq('type', 'connection_request').eq('status', 'cancelled');
      await sb.from('notifications').insert({
        user_id: profile.id, type: 'connection_request',
        from_uid: currentUser.id, from_name: currentUser.name || 'Someone',
        from_photo: currentUser.photo_url || '', read: false,
      });
      sendPushNotification({
        targetUserId: profile.id,
        title: '🤝 New Connection Request!',
        body: `${currentUser.name || 'Someone'} wants to connect with you`,
        url: '/notifications',
      });
      setStatus('pending');
      toast.success(`Request sent to ${profile.name}!`);
    } catch { toast.error('Could not send request.'); }
    setBusy(false);
  };

  const cancelRequest = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const sb = getSupabase();
      await sb.from('connection_requests').delete()
        .eq('from_uid', currentUser.id).eq('to_uid', profile.id);
      await sb.from('notifications').delete()
        .eq('user_id', profile.id).eq('from_uid', currentUser.id)
        .eq('type', 'connection_request');

      // ✅ Broadcast cancellation to receiver's channel (instant, no RLS issue)
      const broadcastCh = sb.channel(`notifs-page-${profile.id}`);
      broadcastCh.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          broadcastCh.send({
            type: 'broadcast',
            event: 'cancel_request',
            payload: { from_uid: currentUser.id },
          });
          setTimeout(() => sb.removeChannel(broadcastCh), 1500);
        }
      });

      setStatus(null);
      toast.success('Request cancelled');
    } catch { toast.error('Could not cancel request.'); }
    setBusy(false);
  };


  const disconnect = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const sb = getSupabase();
      await sb.from('connection_requests').delete()
        .or(`and(from_uid.eq.${currentUser.id},to_uid.eq.${profile.id}),and(from_uid.eq.${profile.id},to_uid.eq.${currentUser.id})`);
      
      // We don't have userProfile connections array directly here, so we skip modifying it.
      // The array isn't heavily relied upon anymore except for auth context cache.
      setStatus(null);
      toast.success(`Disconnected from ${profile.name}`);
    } catch { toast.error('Could not disconnect.'); }
    setBusy(false);
  };
  // ----------------------------------------------------

  const SocialBtn = ({ icon: Icon, url, label }) => {
    if (!url) return null;
    let validUrl = url;
    if (!url.startsWith('http') && !url.startsWith('https://')) {
      if (label === 'WhatsApp') validUrl = `https://wa.me/${url.replace(/[^0-9]/g, '')}`;
      else validUrl = `https://${url}`;
    }
    return (
      <a href={validUrl} target="_blank" rel="noreferrer" 
         style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--surface-2)', borderRadius: 12, border: '1px solid var(--b1)', color: 'var(--t1)', textDecoration: 'none', transition: 'background 0.2s' }}>
        <Icon size={18} color="var(--accent)" />
        <span style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
      </a>
    );
  };

  if (loading) return <div className="page" style={{ justifyContent: 'center', alignItems: 'center' }}><div className="spinner" /></div>;
  if (!profile) return (
    <div className="page" style={{ padding: 20, textAlign: 'center' }}>
      <button className="wa-icon-btn" onClick={() => router.back()} style={{ marginBottom: 20 }}><ArrowLeft size={20} /></button>
      <h3>User not found</h3>
      <p style={{ color: 'var(--t3)' }}>The profile you are looking for does not exist.</p>
    </div>
  );

  const isMe = currentUser?.id === profile.id;

  return (
    <div className="page" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="page-header" style={{ position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="wa-icon-btn" onClick={() => router.back()}><ArrowLeft size={20} /></button>
          <div className="page-title">Profile</div>
        </div>
      </div>

      <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 100 }}>
        
        {/* Top Section */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12 }}>
          <UserAvatar
            user={profile}
            size={100}
            alt={profile.name || ''}
            style={{ borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--b1)' }}
          />
          
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--t1)' }}>{profile.name}</h2>
            {profile.username && <div style={{ color: 'var(--accent)', fontWeight: 500, fontSize: 15 }}>@{profile.username}</div>}
            {profile.title && <div style={{ color: 'var(--t2)', fontSize: 15, marginTop: 4 }}>{profile.title}</div>}
            {profile.location && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, color: 'var(--t3)', fontSize: 13, marginTop: 4 }}><MapPin size={13} /> {profile.location}</div>}
          </div>
        </div>

        {/* Action Buttons */}
        {!isMe && currentUser && (
          <div style={{ display: 'flex', gap: 10 }}>
            {status === 'connected' ? (
              <>
                <button onClick={() => router.push(`/chat/${profile.id}`)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 12, fontWeight: 600, fontSize: 15 }}>
                  <MessageSquare size={16} /> Message
                </button>
                <button onClick={disconnect} disabled={busy} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: 44, background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 12 }}>
                  {busy ? <div className="spinner" style={{ width: 16, height: 16, borderColor: '#ef4444', borderTopColor: 'transparent' }} /> : <UserX size={16} />}
                </button>
              </>
            ) : status === 'pending' ? (
              <button onClick={cancelRequest} disabled={busy} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', background: 'var(--surface-3)', border: '1px solid var(--b1)', color: 'var(--t1)', borderRadius: 12, fontWeight: 600, fontSize: 15 }}>
                {busy ? <div className="spinner" style={{ width: 16, height: 16 }} /> : <><Clock size={16} /> Request Sent (Cancel?)</>}
              </button>
            ) : (
              <button onClick={sendRequest} disabled={busy} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 12, fontWeight: 600, fontSize: 15 }}>
                {busy ? <div className="spinner" style={{ width: 16, height: 16, borderColor: '#000', borderTopColor: 'transparent' }} /> : <><UserPlus size={16} /> Connect</>}
              </button>
            )}
          </div>
        )}

        {/* About Details */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--b1)', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {profile.bio && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 8 }}>About</div>
              <p style={{ fontSize: 15, color: 'var(--t1)', lineHeight: 1.6 }}>{profile.bio}</p>
            </div>
          )}

          {profile.skills?.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 8 }}>Skills & Interests</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {profile.skills.map(sk => (
                  <span key={sk} style={{ background: 'var(--surface-2)', color: 'var(--t2)', padding: '6px 14px', borderRadius: 99, fontSize: 13, fontWeight: 500, border: '1px solid var(--b1)' }}>
                    {sk}
                  </span>
                ))}
              </div>
            </div>
          )}

          {profile.preferred_exchange && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 8 }}>Preferred Exchange</div>
              <div style={{ display: 'inline-block', background: 'var(--accent-dim)', color: 'var(--accent)', padding: '6px 12px', borderRadius: 8, fontSize: 14, fontWeight: 600 }}>
                {profile.preferred_exchange}
              </div>
            </div>
          )}
        </div>

        {/* Social Links */}
        {(profile.social?.youtube || profile.social?.instagram || profile.social?.linkedin || profile.social?.github || profile.social?.twitter || profile.social?.whatsapp || profile.custom_links?.length > 0) && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 12, paddingLeft: 4 }}>Links & Contact</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <SocialBtn icon={Youtube} url={profile.social?.youtube} label="YouTube" />
              <SocialBtn icon={Instagram} url={profile.social?.instagram} label="Instagram" />
              <SocialBtn icon={Linkedin} url={profile.social?.linkedin} label="LinkedIn" />
              <SocialBtn icon={Github} url={profile.social?.github} label="GitHub" />
              <SocialBtn icon={Twitter} url={profile.social?.twitter} label="Twitter" />
              <SocialBtn icon={MessageCircle} url={profile.social?.whatsapp} label="WhatsApp" />
              
              {profile.custom_links?.map((link, i) => (
                <SocialBtn key={i} icon={LinkIcon} url={link.url} label={link.title} />
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
