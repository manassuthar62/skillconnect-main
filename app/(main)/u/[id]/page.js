'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getSupabase } from '@/lib/supabase';
import { sendPushNotification } from '@/lib/pushClient';
import UserAvatar from '@/components/UserAvatar';
import { ArrowLeft, MapPin, Youtube, Instagram, Linkedin, Github, Twitter, MessageCircle, Link as LinkIcon, Clock, UserPlus, UserX, MessageSquare, Zap, ShieldCheck, Trophy, ExternalLink, Dna } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PublicProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const { currentUser, refreshProfile } = useAuth();
  
  const [profile, setProfile] = useState(null);
  const [portfolio, setPortfolio] = useState([]);
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

      // Fetch Portfolio and other data...

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

      // Fetch Portfolio
      const { data: portData } = await sb.from('portfolio_items').select('*').eq('user_id', targetUser.id).order('created_at', { ascending: false });
      if (portData) setPortfolio(portData);

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
      // Clean up any existing notifications of this type from me to this person
      await sb.from('notifications').delete()
        .eq('user_id', profile.id).eq('from_uid', currentUser.id)
        .eq('type', 'connection_request');
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
      <div className="page-header" style={{ position: 'sticky', top: 0, zIndex: 60, background: 'var(--surface)', borderBottom: '1px solid var(--b1)' }}>
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
            
            {/* Trust Score & Availability Row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
              {/* Trust Badge */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', borderRadius: 99, fontSize: 12, fontWeight: 700, border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                <ShieldCheck size={14} />
                {(profile.trust_score || 95)}% Safe Client
              </div>

              {/* Instant Work Mode Badge */}
              {profile.is_available && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', borderRadius: 99, fontSize: 12, fontWeight: 700, border: '1px solid rgba(37, 99, 235, 0.2)' }}>
                  <Zap size={14} fill="currentColor" />
                  Instant Work Mode ON
                </div>
              )}
            </div>

            {profile.username && <div style={{ color: 'var(--accent)', fontWeight: 510, fontSize: 15, marginTop: 10 }}>@{profile.username}</div>}
            {profile.title && <div style={{ color: 'var(--t2)', fontSize: 15, marginTop: 4 }}>{profile.title}</div>}
            {profile.location && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, color: 'var(--t3)', fontSize: 13, marginTop: 4 }}><MapPin size={13} /> {profile.location}</div>}
          </div>
        </div>

        {/* AI Skill DNA Section */}
        {profile.skill_dna?.type && (
          <div style={{ 
            background: 'linear-gradient(145deg, rgba(37, 99, 235, 0.08), rgba(139, 92, 246, 0.05))',
            border: '1px solid rgba(37, 99, 235, 0.15)',
            borderRadius: 24,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 20
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, background: 'var(--accent)', color: '#fff', borderRadius: 10, display: 'flex', alignItems: 'center', justifyCenter: 'center', flexShrink: 0, paddingLeft: 10 }}>
                <Dna size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 1 }}>AI Skill DNA</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)' }}>{profile.skill_dna.type}</div>
              </div>
              <div style={{ padding: '4px 8px', background: 'rgba(0,0,0,0.05)', borderRadius: 6, fontSize: 12, fontWeight: 700, border: '1px solid var(--b1)', fontFamily: 'monospace' }}>
                {profile.skill_dna.dna_string}
              </div>
            </div>

            <div className="dna-stats" style={{ display: 'flex', gap: 1, background: 'var(--b1)', borderRadius: 12, overflow: 'hidden' }}>
               <div style={{ flex: 1, background: 'rgba(255,255,255,0.4)', padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>{profile.skill_dna.learning_speed}%</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Learning Speed</div>
               </div>
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.4)', padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>{profile.skill_dna.strengths?.length || 0}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Core Strengths</div>
                </div>
                <div style={{ flex: 1, background: 'rgba(251, 191, 36, 0.1)', padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#fbbf24' }}>{profile.skill_dna.income_booster || '↑ 1.5x'}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Income Booster</div>
                </div>
            </div>

            <div className="dna-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
               <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t2)', marginBottom: 8 }}>Top Talents</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {profile.skill_dna.strengths?.map(s => <span key={s} style={{ background: '#fff', border: '1px solid var(--b1)', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{s}</span>)}
                  </div>
               </div>
               <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t2)', marginBottom: 8 }}>Hidden Potential</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {profile.skill_dna.hidden_talents?.map(s => <span key={s} style={{ background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.2)', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, color: '#8b5cf6' }}>{s}</span>)}
                  </div>
               </div>
            </div>
          </div>
        )}

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

        {/* Portfolio / Proof of Work Sections */}
        {portfolio.length > 0 && (
          <div>
             <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 12, paddingLeft: 4 }}>Proof of Work (Portfolio)</div>
             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                {portfolio.map(item => (
                  <div key={item.id} style={{ background: 'var(--surface)', border: '1px solid var(--b1)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Trophy size={16} color="#f59e0b" />
                      <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--t1)' }}>{item.title}</span>
                    </div>
                    {item.result_metric && (
                      <div style={{ alignSelf: 'flex-start', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, letterSpacing: '0.4px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                        {item.result_metric}
                      </div>
                    )}
                    {item.media_url && (
                      <div style={{ width: '100%', height: 160, borderRadius: 12, overflow: 'hidden', background: '#000', border: '1px solid var(--b1)' }}>
                        <img src={item.media_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    )}
                    <p style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.5 }}>{item.description}</p>
                    {item.media_url && (
                      <a href={item.media_url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
                        <ExternalLink size={12} /> View Full Work
                      </a>
                    )}
                  </div>
                ))}
             </div>
          </div>
        )}

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
              
              {profile.custom_links?.map((link, i) => (
                <SocialBtn key={i} icon={LinkIcon} url={link.url} label={link.title} />
              ))}
            </div>
          </div>
        )}

      </div>
      <style jsx>{`
        @media (max-width: 600px) {
          .dna-stats { 
            flex-direction: column; 
            gap: 1px !important; 
          }
          .dna-grid { 
            grid-template-columns: 1fr !important;
            gap: 20px !important;
          }
          .page-header {
            padding-top: env(safe-area-inset-top);
          }
        }
      `}</style>
    </div>
  );
}
