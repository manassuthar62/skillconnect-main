'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getSupabase } from '@/lib/supabase';
import Image from 'next/image';
import { Users, Plus, Heart, MessageCircle, Send, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import styles from './community.module.css';

const fmt = ts => {
  if (!ts) return 'Just now';
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
  return `${Math.floor(diff/86400000)}d ago`;
};

export default function CommunityPage() {
  const { currentUser, userProfile } = useAuth();
  const [posts,    setPosts]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [creating, setCreating] = useState(false);
  const [newPost,  setNewPost]  = useState('');
  const [newPostUrl, setNewPostUrl] = useState('');
  const [newPostType, setNewPostType] = useState('text'); // text, image
  const [submitting, setSubmitting] = useState(false);
  const [commentInputs,    setCommentInputs]    = useState({});
  const [expandedComments, setExpandedComments] = useState({});
  const [comments, setComments] = useState({}); // postId → comments[]

  const fetchPosts = async () => {
    const sb = getSupabase();
    const { data } = await sb.from('posts').select('*').order('created_at', { ascending: false });
    setPosts(data || []);
    setLoading(false);
  };

  const fetchComments = async (postId) => {
    const sb = getSupabase();
    const { data } = await sb.from('comments')
      .select('*, users:author_id(name, photo_url)')
      .eq('post_id', postId).order('created_at', { ascending: true });
    setComments(p => ({ ...p, [postId]: data || [] }));
  };

  useEffect(() => {
    fetchPosts();
    // Realtime new posts
    const sb = getSupabase();
    const ch = sb.channel('posts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' },
        payload => setPosts(p => [payload.new, ...p]))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts' },
        payload => setPosts(p => p.map(post => post.id === payload.new.id ? payload.new : post)))
      .subscribe();
    return () => sb.removeChannel(ch);
  }, []);

  const submitPost = async () => {
    if (!newPost.trim()) return;
    setSubmitting(true);
    try {
      const sb = getSupabase();
      await sb.from('posts').insert({
        author_id: currentUser.id,
        author_name: userProfile?.name || 'Someone',
        author_photo: userProfile?.photo_url || '',
        content: newPost.trim(),
        likes: [],
        type: newPostType,
        link_url: newPostUrl.trim(),
        is_boosted: newPost.length > 100 && newPost.toLowerCase().includes('portfolio'), // Simple simulated AI boost
      });
      setNewPost(''); setNewPostUrl(''); setNewPostType('text'); setCreating(false); toast.success('Post shared! 🎉');
    } catch { toast.error('Failed to post'); }
    setSubmitting(false);
  };

  const toggleLike = async (post) => {
    const sb = getSupabase();
    const liked = post.likes?.includes(currentUser.id);
    const newLikes = liked
      ? post.likes.filter(id => id !== currentUser.id)
      : [...(post.likes || []), currentUser.id];
    await sb.from('posts').update({ likes: newLikes }).eq('id', post.id);
    setPosts(p => p.map(pp => pp.id === post.id ? { ...pp, likes: newLikes } : pp));
  };

  const addComment = async (postId) => {
    const text = commentInputs[postId]?.trim();
    if (!text) return;
    const sb = getSupabase();
    await sb.from('comments').insert({ post_id: postId, author_id: currentUser.id, text });
    setCommentInputs(p => ({ ...p, [postId]: '' }));
    fetchComments(postId);
  };

  const toggleComments = (postId) => {
    setExpandedComments(p => ({ ...p, [postId]: !p[postId] }));
    if (!comments[postId]) fetchComments(postId);
  };

  const initials = n => n?.split(' ').map(c => c[0]).join('').slice(0,2).toUpperCase() || '?';

  return (
    <div className={styles.page}>
      <div className="wa-header">
        <div className="wa-header-title">Community</div>
        <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
          <Plus size={14} /> Post
        </button>
      </div>

      <AnimatePresence>
        {creating && (
          <motion.div className={styles.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className={styles.modal} initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92 }}>
              <div className={styles.modalHeader}>
                <span style={{ fontWeight: 700 }}>Create Post</span>
                <button className="wa-icon-btn" onClick={() => setCreating(false)}><X size={18} /></button>
              </div>
              <div className={styles.modalBody}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  {userProfile?.photo_url
                    ? <Image src={userProfile.photo_url} alt="" width={40} height={40} className="avatar" />
                    : <div className="avatar-placeholder" style={{ width: 40, height: 40, fontSize: 14 }}>{initials(userProfile?.name)}</div>}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <textarea className={styles.textarea} placeholder="Share something with the community..."
                      value={newPost} onChange={e => setNewPost(e.target.value)} autoFocus rows={4} />
                    
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <select className="input" style={{ width: 'auto', padding: '6px 12px', fontSize: 13 }}
                        value={newPostType} onChange={e => setNewPostType(e.target.value)}>
                        <option value="text">Just Text</option>
                        <option value="image">Image URL</option>
                      </select>
                      {newPostType === 'image' && (
                        <input className="input" placeholder="Paste image URL here..." 
                          value={newPostUrl} onChange={e => setNewPostUrl(e.target.value)}
                          style={{ flex: 1, padding: '8px 12px', fontSize: 13 }} />
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <span style={{ fontSize: 12, color: 'var(--t3)' }}>{newPost.length}/500</span>
                <button className="btn btn-primary btn-sm" onClick={submitPost} disabled={!newPost.trim() || submitting}>
                  {submitting ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <><Send size={14} /> Share</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? <div className="empty-state"><div className="spinner" /></div>
      : posts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Users size={28} /></div>
          <h3>No posts yet</h3><p>Be the first to share something!</p>
        </div>
      ) : (
        <div className={styles.feed}>
          {posts.map((post, i) => {
            const liked = post.likes?.includes(currentUser?.id);
            const showCmt = expandedComments[post.id];
            const postComments = comments[post.id] || [];
            return (
              <motion.div key={post.id} className={`card ${styles.post}`}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <div className={styles.postHeader}>
                  {post.author_photo
                    ? <Image src={post.author_photo} alt="" width={42} height={42} className="avatar" />
                    : <div className="avatar-placeholder" style={{ width: 42, height: 42, fontSize: 14 }}>{initials(post.author_name || userProfile?.name)}</div>}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{post.author_name || 'User'}</div>
                      {post.is_boosted && <span className={styles.boostedBadge}><Sparkles size={10} /> AI Boosted</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--t3)' }}>{fmt(post.created_at)}</div>
                  </div>
                </div>
                <p className={styles.postContent}>{post.content}</p>
                {post.type === 'image' && post.link_url && (
                  <div className={styles.postMedia}>
                    <img src={post.link_url} alt="Portfolio" />
                  </div>
                )}
                <div className={styles.postActions}>
                  <button className={`btn btn-ghost btn-sm ${liked ? styles.liked : ''}`} onClick={() => toggleLike(post)}>
                    <Heart size={16} fill={liked ? '#ef4444' : 'none'} color={liked ? '#ef4444' : 'currentColor'} />
                    {post.likes?.length || 0}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => toggleComments(post.id)}>
                    <MessageCircle size={16} /> Comments
                  </button>
                </div>
                <AnimatePresence>
                  {showCmt && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                      {postComments.length > 0 && (
                        <div className={styles.comments}>
                          {postComments.map(c => (
                            <div key={c.id} className={styles.comment}>
                              <div className="avatar-placeholder" style={{ width: 28, height: 28, fontSize: 10 }}>
                                {initials(c.users?.name)}
                              </div>
                              <div className={styles.commentBubble}>
                                <span style={{ fontWeight: 600, fontSize: 12 }}>{c.users?.name} </span>
                                <span style={{ fontSize: 13 }}>{c.text}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className={styles.commentInput}>
                        <input className="input" placeholder="Write a comment..."
                          value={commentInputs[post.id] || ''}
                          onChange={e => setCommentInputs(p => ({ ...p, [post.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') addComment(post.id); }}
                          style={{ borderRadius: 99 }} />
                        <button className="btn btn-primary btn-icon btn-sm" onClick={() => addComment(post.id)}><Send size={14} /></button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
