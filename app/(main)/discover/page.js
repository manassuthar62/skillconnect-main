'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getSupabase } from '@/lib/supabase';
import { sendPushNotification } from '@/lib/pushClient';
import { Search, MapPin, X, UserCheck, MessageSquare, Clock, UserX, Zap, Sparkles, Lightbulb, ChevronUp, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import UserAvatar from '@/components/UserAvatar';
import styles from './discover.module.css';

const POPULAR_SKILLS = [
  'Cooking', 'Language Learning', 'Guitar', 'Photography', 'Gardening',
  'Coding', 'Writing', 'Math Help', 'Career Advice', 'Home Repair', 'Fitness', 'Art & Crafts',
];

export default function DiscoverPage() {
  const { currentUser, userProfile, refreshProfile } = useAuth();
  const router = useRouter();
  const [users,      setUsers]     = useState([]);
  // Persist search across tab switches using sessionStorage
  const [search,     setSearch]    = useState(() => {
    if (typeof window !== 'undefined') return sessionStorage.getItem('discover_search') || '';
    return '';
  });
  const [location,   setLocation]  = useState(() => {
    if (typeof window !== 'undefined') return sessionStorage.getItem('discover_location') || '';
    return '';
  });
  const [loading,    setLoading]   = useState(true);
  const [busy,       setBusy]      = useState({});
  const [aiMode,     setAiMode]    = useState(false);
  const [aiResults,  setAiResults] = useState([]);
  const [aiInsights, setAiInsights] = useState(null);
  const [isInsightsOpen, setIsInsightsOpen] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [statusMap,  setStatusMap] = useState({});
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Save search/location to sessionStorage on change
  const handleSearchChange = (val) => { setSearch(val); sessionStorage.setItem('discover_search', val); };
  const handleLocationChange = (val) => { setLocation(val); sessionStorage.setItem('discover_location', val); };


  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      const sb = getSupabase();
      const [{ data: allUsers }, { data: sentReqs }, { data: recvReqs }] = await Promise.all([
        sb.from('users').select('*').neq('id', currentUser.id),
        sb.from('connection_requests').select('*').eq('from_uid', currentUser.id),
        sb.from('connection_requests').select('*').eq('to_uid', currentUser.id).eq('status', 'accepted'),
      ]);

      const map = {};
      (sentReqs || []).forEach(r => {
        if (r.status === 'accepted') map[r.to_uid] = 'connected';
        else if (r.status === 'pending') map[r.to_uid] = 'pending';
        // rejected → don't set → shows Connect again
      });
      (recvReqs || []).forEach(r => {
        map[r.from_uid] = 'connected';
      });

      setUsers(allUsers || []);
      setStatusMap(map);
      setLoading(false);

      // 🔴 Real-time: listen for status changes on MY sent requests
      const ch = sb.channel('my-conn-requests')
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'connection_requests',
          filter: `from_uid=eq.${currentUser.id}`,
        }, payload => {
          const { to_uid, status } = payload.new;
          setStatusMap(p => ({
            ...p,
            [to_uid]: status === 'accepted' ? 'connected'
                    : status === 'pending'  ? 'pending'
                    : null, // rejected/deleted → Connect again
          }));
        })
        .on('postgres_changes', {
          event: 'DELETE', schema: 'public', table: 'connection_requests',
          filter: `from_uid=eq.${currentUser.id}`,
        }, payload => {
          setStatusMap(p => ({ ...p, [payload.old.to_uid]: null }));
        })
        .subscribe();

      return () => sb.removeChannel(ch);
    })();
  }, [currentUser]);

  const filtered = users.filter(u => {
    const s = search.toLowerCase(), l = location.toLowerCase();
    const ok1 = !s || u.name?.toLowerCase().includes(s) || u.skills?.some(sk => sk.toLowerCase().includes(s)) || u.bio?.toLowerCase().includes(s) || u.title?.toLowerCase().includes(s);
    const ok2 = !l || u.location?.toLowerCase().includes(l);
    return ok1 && ok2;
  });

  const handleSearch = async () => {
    if (!aiMode) return;
    if (!search && !location) {
      toast.error('Please enter a skill or location to search.');
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ search, location })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to fetch AI suggestions');
      
      setAiResults(data.profiles || []);
      setAiInsights(data.insights || null);
      if(!data.insights) setIsInsightsOpen(false); // Close if none returned
      else setIsInsightsOpen(true); // Open when new search is made
      
      toast.success(`Found ${data.profiles?.length || 0} online profiles!`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const sendRequest = async (targetUser) => {
    if (busy[targetUser.id]) return;
    setBusy(p => ({ ...p, [targetUser.id]: true }));
    try {
      const sb = getSupabase();
      const { error: requestError } = await sb.from('connection_requests').insert({
        from_uid: currentUser.id, to_uid: targetUser.id, status: 'pending',
      });
      if (requestError) throw requestError;
      setStatusMap(p => ({ ...p, [targetUser.id]: 'pending' }));
      toast.success(`Request sent to ${targetUser.name}! `);
      const { error: notifError } = await sb.from('notifications').insert({
        user_id: targetUser.id, type: 'connection_request',
        from_uid: currentUser.id, from_name: userProfile?.name || '',
        from_photo: userProfile?.photo_url || '', read: false,
      });
      sendPushNotification({
        targetUserId: targetUser.id,
        title: '🤝 New Connection Request!',
        body: `${userProfile?.name || 'Someone'} wants to connect with you`,
        url: '/notifications',
      });
    } catch { toast.error('Could not send request.'); }
    setBusy(p => ({ ...p, [targetUser.id]: false }));
  };
  const cancelRequest = async (targetUser) => {
    if (busy[targetUser.id]) return;
    setBusy(p => ({ ...p, [targetUser.id]: true }));
    try {
      const sb = getSupabase();
      await sb.from('connection_requests')
        .delete()
        .eq('from_uid', currentUser.id)
        .eq('to_uid', targetUser.id);
      await sb.from('notifications')
        .delete()
        .eq('user_id', targetUser.id)
        .eq('from_uid', currentUser.id)
        .eq('type', 'connection_request');

      // ✅ Broadcast cancellation to receiver's channel (instant, no RLS issue)
      const broadcastCh = sb.channel(`notifs-page-${targetUser.id}`);
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

      setStatusMap(p => ({ ...p, [targetUser.id]: null }));
      toast.success('Request cancelled');
    } catch { toast.error('Could not cancel request.'); }
    setBusy(p => ({ ...p, [targetUser.id]: false }));
  };


  const disconnect = async (targetUser) => {
    if (busy[targetUser.id]) return;
    setBusy(p => ({ ...p, [targetUser.id]: true }));
    try {
      const sb = getSupabase();
      // Remove connection requests both ways
      await sb.from('connection_requests').delete()
        .or(`and(from_uid.eq.${currentUser.id},to_uid.eq.${targetUser.id}),and(from_uid.eq.${targetUser.id},to_uid.eq.${currentUser.id})`);
      // Remove from connections arrays
      const myConns   = (userProfile?.connections || []).filter(id => id !== targetUser.id);
      const theirConns = (targetUser.connections  || []).filter(id => id !== currentUser.id);
      await sb.from('users').update({ connections: myConns    }).eq('id', currentUser.id);
      await sb.from('users').update({ connections: theirConns }).eq('id', targetUser.id);
      await refreshProfile();
      setStatusMap(p => ({ ...p, [targetUser.id]: null }));
      toast.success(`Disconnected from ${targetUser.name}`);
    } catch { toast.error('Could not disconnect.'); }
    setBusy(p => ({ ...p, [targetUser.id]: false }));
  };

  const initials = n => n?.split(' ').map(c => c[0]).join('').slice(0,2).toUpperCase() || '?';

  const ConnectBtn = ({ user }) => {
    const status = statusMap[user.id];
    const isLoading = busy[user.id];

    if (status === 'connected') return (
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <button className={styles.newMessageBtn}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          onClick={(e) => { e.stopPropagation(); router.push(`/chat/${user.id}`); }}
        >
          <MessageSquare size={14} /> Message
        </button>
        <button className={styles.newDisconnectBtn}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          onClick={(e) => { e.stopPropagation(); disconnect(user); }} disabled={isLoading}>
          {isLoading ? <span className="spinner" style={{ width: 14, height: 14, borderColor: '#991b1b', borderRightColor: 'transparent' }} />
            : <><UserX size={14} /> Disconnect</>}
        </button>
      </div>
    );

    if (status === 'pending') return (
      <button className={styles.newConnectBtn}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--surface-2)', color: 'var(--t2)' }}
        onClick={(e) => { e.stopPropagation(); cancelRequest(user); }} disabled={isLoading}
        title="Click to cancel request">
        {isLoading ? <span className="spinner" style={{ width: 14, height: 14, borderColor: 'var(--t2)', borderRightColor: 'transparent' }} />
          : <><Clock size={14} /> Request Sent (Cancel?)</>}
      </button>
    );

    return (
      <button className={styles.newConnectBtn}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        onClick={(e) => { e.stopPropagation(); sendRequest(user); }} disabled={isLoading}>
        {isLoading ? <span className="spinner" style={{ width: 14, height: 14, borderColor: '#000', borderRightColor: 'transparent' }} />
          : 'Connect'}
      </button>
    );
  };


  return (
    <div className={styles.page}>
      <div className={styles.searchHeader}>
        <h2 className={styles.searchTitle}>Search People</h2>
        <div className={styles.searchRow}>
          <div className={styles.searchField}>
            <Search size={15} className={styles.searchIcon} />
            <input className={styles.searchInput} placeholder="Search skills, interests, or help needed..."
              value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} />
            {search && <button className={styles.clearBtn} onClick={() => { setSearch(''); setAiResults([]); setAiInsights(null); }}><X size={13} /></button>}
          </div>
          <div className={styles.locationField}>
            <MapPin size={14} className={styles.searchIcon} />
            <input className={styles.searchInput} placeholder="Location (optional)"
              value={location} onChange={e => setLocation(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} />
          </div>
          <button 
            className="btn btn-primary" 
            style={{ borderRadius: 8, padding: '9px 20px', fontWeight: 600, opacity: isSearching ? 0.7 : 1 }}
            onClick={handleSearch}
            disabled={isSearching}
          >
            {isSearching ? <span className="spinner" style={{ width: 16, height: 16, borderColor: '#fff', borderRightColor: 'transparent', display: 'inline-block' }}/> : 'Search'}
          </button>
          <button
            className={styles.filterToggleBtn}
            onClick={() => setIsFilterOpen(prev => !prev)}
          >
            <SlidersHorizontal size={15} />
            <span>Filters</span>
            {isFilterOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          <div className={styles.aiToggle}>
            <button className={`${styles.toggle}${aiMode ? ` ${styles.toggleOn}` : ''}`}
              onClick={() => { setAiMode(p => !p); toast.success(aiMode ? 'AI off' : 'AI Suggestions on ✨'); }}>
              <span className={styles.toggleThumb} />
            </button>
            <span className={styles.aiLabel}><Sparkles size={13} /> AI Suggestions</span>
          </div>
        </div>
        {isFilterOpen && <div className={styles.filterBar}>
          <div className={styles.filterHeader}>
            <div className={styles.filterTitleWrap}>
              <span className={styles.filterIcon}><SlidersHorizontal size={14} /></span>
              <div>
                <div className={styles.filterTitle}>Quick Filters</div>
                <div className={styles.filterHint}>Tap a skill to instantly refine results</div>
              </div>
            </div>
            {search && (
              <button
                className={styles.clearFilterBtn}
                onClick={() => setSearch('')}
              >
                Clear
              </button>
            )}
          </div>

          <div className={styles.chips}>
            {POPULAR_SKILLS.map(sk => (
              <button
                key={sk}
                className={`${styles.chip}${search === sk ? ` ${styles.chipActive}` : ''}`}
                onClick={() => setSearch(search === sk ? '' : sk)}
              >
                {sk}
              </button>
            ))}
          </div>
        </div>}
      </div>

      <div className={styles.resultsHeader}>
        <span className={styles.resultsTitle}>Discover People</span>
        <span className={styles.resultsCount}>{loading ? '...' : `${filtered.length} result${filtered.length !== 1 ? 's' : ''}`}</span>
      </div>

      {loading ? <div className="empty-state"><div className="spinner" /></div>
      : (filtered.length === 0) ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Search size={26} /></div>
          <h3>No users found</h3><p>Try a different skill or name</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {/* Local Users Rendering */}
          {filtered.map((user, i) => (
            <motion.div key={user.id} className={styles.newCard}
              style={{ cursor: 'pointer' }}
              onClick={() => router.push(`/u/${user.username || user.id}`)}
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              
              <div className={styles.cardHeader}>
                <UserAvatar user={user} size={50} className={styles.newAvatar} alt={user.name} />
                
                <div className={styles.cardHeaderText} style={{ flexDirection: 'row', gap: 12 }}>
                  
                  {/* Center Column: Name, Title, Skills, Rating */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div className={styles.newName}>{user.name}</div>
                    {user.title && <div className={styles.newTitle}>{user.title}</div>}
                    
                    {user.skills?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                        {user.skills.slice(0, 3).map(sk => (
                          <span key={sk} className={styles.newSkillTag} onClick={(e) => { e.stopPropagation(); setSearch(sk); }}>{sk}</span>
                        ))}
                        {user.skills.length > 3 && <span className={styles.newMoreSkills}>+{user.skills.length - 3} more</span>}
                      </div>
                    )}

                    {user.bio && (
                      <div className={styles.newBio} style={{ paddingLeft: 0, marginTop: 4 }}>
                        {user.bio.length > 100 ? user.bio.substring(0, 100) + '...' : user.bio}
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#9ca3af', fontSize: 13, marginTop: 4 }}>
                      <div style={{ display: 'flex' }}>
                        <span style={{ color: '#d1d5db' }}>★</span>
                        <span style={{ color: '#d1d5db' }}>★</span>
                        <span style={{ color: '#d1d5db' }}>★</span>
                        <span style={{ color: '#d1d5db' }}>★</span>
                        <span style={{ color: '#d1d5db' }}>★</span>
                      </div>
                      (0)
                    </div>
                  </div>

                  {/* Right Column: Registered, Location, Preferred Exchange */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                    <div className={styles.registeredBadge}>
                      <UserCheck size={12} strokeWidth={2.5} /> Registered
                    </div>
                    {user.location && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--t3)' }}>
                        <MapPin size={11} /> {user.location}
                      </div>
                    )}
                    {user.preferred_exchange && (
                      <div style={{ background: 'rgba(22, 163, 74, 0.15)', color: '#16a34a', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, marginTop: 4 }}>
                        {user.preferred_exchange}
                      </div>
                    )}
                  </div>

                </div>
              </div>

              <div style={{ marginTop: 2 }}>
                <ConnectBtn user={user} />
              </div>

            </motion.div>
          ))}
        </div>

      )}
      {/* AI Searching Indicator */}
      {isSearching && (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--t2)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div className="spinner" style={{ width: 24, height: 24, borderColor: '#3b82f6', borderRightColor: 'transparent' }} />
          <span style={{ fontSize: 14, fontWeight: 500 }}>Generating AI Insights...</span>
        </div>
      )}

      {/* AI Insights Section */}
      {aiMode && aiInsights && (aiInsights.advice || (aiInsights.relatedSearches && aiInsights.relatedSearches.length > 0)) && (
        <div className={styles.insightsContainer} style={{ opacity: isSearching ? 0.5 : 1, transition: 'opacity 0.2s', pointerEvents: isSearching ? 'none' : 'auto' }}>
          <div className={styles.insightsHeader} onClick={() => setIsInsightsOpen(!isInsightsOpen)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Lightbulb size={20} color="#3b82f6" />
              <span style={{ fontWeight: 600, color: 'var(--t1)', fontSize: 15, background: 'var(--accent)', color: '#fff', padding: '2px 6px', borderRadius: 4 }}>AI Insights</span>
            </div>
            {isInsightsOpen ? <ChevronUp size={18} color="var(--t2)" /> : <ChevronDown size={18} color="var(--t2)" />}
          </div>
          {isInsightsOpen && (
            <div className={styles.insightsBody}>
              {aiInsights?.advice && <p className={styles.insightsAdvice}>{aiInsights.advice}</p>}
              {aiInsights?.relatedSearches?.length > 0 && (
                <div style={{ marginTop: aiInsights.advice ? 12 : 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', marginBottom: 8 }}>Related searches:</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {aiInsights.relatedSearches.map(rs => (
                      <button 
                        key={rs} 
                        className={styles.insightChip} 
                        onClick={() => { 
                          setSearch(rs); 
                          setTimeout(() => {
                            document.querySelector('button.btn-primary').click();
                          }, 100);
                        }}
                      >
                        {rs}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Profiles inside Insights -> MOVED OUT */}
            </div>
          )}
        </div>
      )}

      {/* AI Profiles Output */}
      {aiMode && aiResults.length > 0 && (
        <div style={{ marginTop: 24, padding: '0 16px 20px', opacity: isSearching ? 0.5 : 1, transition: 'opacity 0.2s', pointerEvents: isSearching ? 'none' : 'auto' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--t1)', marginBottom: 16 }}>Suggested profiles:</div>
          <div className={styles.grid} style={{ padding: 0 }}>
            {aiResults.map((profile, i) => (
              <motion.div key={profile.id} className={styles.newCard} style={{ background: 'var(--surface-2)' }}
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                
                <div className={styles.cardHeader}>
                  <div className={styles.newAvatarPlaceholder} style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: '#fff' }}>
                    {initials(profile.name)}
                  </div>
                  
                  <div className={styles.cardHeaderText} style={{ flexDirection: 'row', gap: 12 }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div className={styles.newName} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {profile.name} <Sparkles size={14} color="#a855f7" />
                      </div>
                      {profile.title && <div className={styles.newTitle}>{profile.title}</div>}
                      
                      {profile.skills?.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                          {profile.skills.slice(0, 3).map(sk => (
                            <span key={sk} className={styles.newSkillTag} style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', borderColor: 'rgba(168, 85, 247, 0.2)' }}>{sk}</span>
                          ))}
                        </div>
                      )}

                      {profile.bio && (
                        <div className={styles.newBio} style={{ paddingLeft: 0, marginTop: 4 }}>
                          {profile.bio.length > 100 ? profile.bio.substring(0, 100) + '...' : profile.bio}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                      <div className={styles.registeredBadge} style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' }}>
                        <Zap size={12} strokeWidth={2.5} /> Profile
                      </div>
                      {profile.location && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--t3)' }}>
                          <MapPin size={11} /> {profile.location}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 2 }}>
                  <a 
                    href={profile.link.startsWith('http') ? profile.link : `https://${profile.link}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={styles.newConnectBtn}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none', background: 'linear-gradient(135deg, #a855f7, #ec4899)', border: 'none', color: '#fff' }}
                  >
                    View Profile Online
                  </a>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
