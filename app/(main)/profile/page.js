'use client';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getSupabase } from '@/lib/supabase';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Camera, Plus, X, Save, Share2, Zap, Youtube, Instagram, Linkedin, Github, Twitter, MessageCircle, Link, Bell, BellOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { registerPushNotifications } from '@/lib/pushClient';
import styles from './profile.module.css';


const SOCIAL_FIELDS = [
  { key: 'youtube',   icon: Youtube,       placeholder: 'Your YouTube profile URL' },
  { key: 'instagram', icon: Instagram,     placeholder: 'Your Instagram profile URL' },
  { key: 'linkedin',  icon: Linkedin,      placeholder: 'Your LinkedIn profile URL' },
  { key: 'github',    icon: Github,        placeholder: 'Your GitHub profile URL' },
  { key: 'twitter',   icon: Twitter,       placeholder: 'Your Twitter profile URL' },
  { key: 'whatsapp',  icon: MessageCircle, placeholder: 'Your WhatsApp number (with country code)' },
];

export default function ProfilePage() {
  const { currentUser, userProfile, refreshProfile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileRef = useRef();
  const isSetupMode = searchParams.get('setup') === '1';
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  const [customLinkTitle, setCustomLinkTitle] = useState('');
  const [customLinkUrl, setCustomLinkUrl] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [form, setForm] = useState({
    username: '', name: '', title: '', location: '', bio: '',
    preferred_exchange: '', skills: [],
    social: { youtube: '', instagram: '', linkedin: '', github: '', twitter: '', whatsapp: '' },
    custom_links: [],
  });

  // Check if notifications already granted
  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setPushEnabled(Notification.permission === 'granted');
    }
  }, []);


  useEffect(() => {
    if (!userProfile) return;
    setPhotoURL(userProfile.photo_url || '');
    setForm({
      username:          userProfile.username || '',
      name:              userProfile.name || '',
      title:             userProfile.title || '',
      location:          userProfile.location || '',
      bio:               userProfile.bio || '',
      preferred_exchange: userProfile.preferred_exchange || '',
      skills:            userProfile.skills || [],
      social:            userProfile.social || {},
      custom_links:      userProfile.custom_links || [],
    });
  }, [userProfile]);

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));
  const setSocial = (k, v) => setForm(p => ({ ...p, social: { ...p.social, [k]: v } }));
  const addSkill = () => { const s = newSkill.trim(); if (!s || form.skills.includes(s)) { setNewSkill(''); return; } set('skills', [...form.skills, s]); setNewSkill(''); };
  const removeSkill = sk => set('skills', form.skills.filter(s => s !== sk));
  const addLink = () => { if (!customLinkTitle.trim() || !customLinkUrl.trim()) return; set('custom_links', [...form.custom_links, { title: customLinkTitle.trim(), url: customLinkUrl.trim() }]); setCustomLinkTitle(''); setCustomLinkUrl(''); };
  const removeLink = i => set('custom_links', form.custom_links.filter((_, idx) => idx !== i));

  const handlePhoto = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploading(true);
    try {
      const sb = getSupabase();
      const path = `${currentUser.id}/avatar`;
      await sb.storage.from('avatars').upload(path, file, { upsert: true });
      const { data } = sb.storage.from('avatars').getPublicUrl(path);
      const publicUrl = data.publicUrl + '?t=' + Date.now();
      await sb.from('users').update({ photo_url: publicUrl }).eq('id', currentUser.id);
      setPhotoURL(publicUrl);
      await refreshProfile();
      toast.success('Photo updated!');
    } catch (e) { toast.error('Upload failed: ' + e.message); }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Name is required');
    if (!form.username.trim()) return toast.error('Username is required');
    if (!form.title.trim()) return toast.error('Title is required');
    if (!form.location.trim()) return toast.error('Location is required');
    if (!form.bio.trim()) return toast.error('About you is required');
    if (!form.preferred_exchange.trim()) return toast.error('Preferred exchange is required');
    if (!form.skills.length) return toast.error('Add at least one skill');
    setSaving(true);
    try {
      const sb = getSupabase();
      await sb.from('users').update({ ...form, photo_url: photoURL }).eq('id', currentUser.id);
      await refreshProfile();
      toast.success('Profile saved! ✅');
      if (isSetupMode) router.replace('/chat');
    } catch (e) { toast.error(e.message); }
    setSaving(false);
  };

  const shareProfile = async () => {
    const url = `${window.location.origin}/u/${form.username || currentUser?.id}`;
    const shareData = {
      title: `${form.name || 'My'} Profile — SkillConnect`,
      text: 'Check out my profile on SkillConnect! Connect with me 🚀',
      url,
    };
    // On mobile (iOS Safari, Chrome Android etc.) this opens native share sheet
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return; // done!
      } catch (e) {
        if (e.name === 'AbortError') return; // user cancelled — don't show error
      }
    } else if (navigator.share) {
      // Older implementation - just try without canShare check
      try {
        await navigator.share({ url });
        return;
      } catch (e) {
        if (e.name === 'AbortError') return;
      }
    }
    // Fallback for desktop browsers that don't support Web Share API
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Profile link copied to clipboard! 🔗');
    } catch {
      toast.error('Could not share profile');
    }
  };

  const enablePushNotifications = async () => {
    setPushLoading(true);
    const ok = await registerPushNotifications(currentUser.id);
    if (ok) { setPushEnabled(true); toast.success('Push notifications enabled! 🔔'); }
    else { toast.error('Could not enable notifications. Check browser settings.'); }
    setPushLoading(false);
  };


  const initials = n => n?.split(' ').map(c => c[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.headerTitle}>{isSetupMode ? 'Complete Your Profile' : 'Your Profile'}</h2>
            {isSetupMode && (
              <p className={styles.hint} style={{ marginTop: 6 }}>
                Fill these details once to continue. Later you can update anything from profile.
              </p>
            )}
          </div>
          {!isSetupMode && <button className="btn btn-secondary btn-sm" onClick={shareProfile}><Share2 size={13} /> Share Profile</button>}
        </div>

        {/* Photo */}
        <div className={styles.photoSection}>
          <div className={styles.photoLabel}>Profile Picture</div>
          <div className={styles.photoWrap}>
            <div className={styles.avatarRing}>
              {photoURL ? <Image src={photoURL} alt="Avatar" width={90} height={90} className="avatar" style={{ width: 90, height: 90 }} />
                : <div className="avatar-placeholder" style={{ width: 90, height: 90, fontSize: 28 }}>{initials(form.name)}</div>}
              {uploading && <div className={styles.uploadOverlay}><div className="spinner" style={{ width: 20, height: 20 }} /></div>}
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
          <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Camera size={14} /> {uploading ? 'Uploading...' : 'Change Photo'}
          </button>
        </div>

        {/* Username */}
        <div className={styles.section}>
          <div className="input-group">
            <label className={styles.label}>Username (for sharing)</label>
            <div className={styles.usernameWrap}>
              <span className={styles.atSign}>@</span>
              <input className={`input ${styles.usernameInput}`} placeholder="yourname"
                value={form.username} onChange={e => set('username', e.target.value.toLowerCase().replace(/\s/g, ''))} />
            </div>
            {form.username && <div className={styles.usernameHint}>Profile: <span>{typeof window !== 'undefined' ? window.location.origin : ''}/u/{form.username}</span></div>}
          </div>
        </div>

        {/* Name + Title */}
        <div className={styles.section}>
          <div className={styles.row}>
            <div className="input-group" style={{ flex: 1 }}>
              <label className={styles.label}>Full Name *</label>
              <input className="input" placeholder="Your full name" value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div className="input-group" style={{ flex: 1 }}>
              <label className={styles.label}>Title / Profession</label>
              <input className="input" placeholder="e.g. UI Designer" value={form.title} onChange={e => set('title', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Location */}
        <div className={styles.section}>
          <div className="input-group">
            <label className={styles.label}>Location</label>
            <input className="input" placeholder="City, State or Region" value={form.location} onChange={e => set('location', e.target.value)} />
          </div>
        </div>

        {/* Bio */}
        <div className={styles.section}>
          <div className="input-group">
            <label className={styles.label}>About You</label>
            <textarea className="input" rows={4}
              placeholder="Tell others about yourself, what you're passionate about, and how you like to help..."
              value={form.bio} onChange={e => set('bio', e.target.value)} />
          </div>
        </div>

        {/* Skills */}
        <div className={styles.section}>
          <label className={styles.label}>Skills &amp; Interests</label>
          <div className={styles.skillInput}>
            <input className="input" placeholder="Add a skill or interest" value={newSkill}
              onChange={e => setNewSkill(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
              style={{ flex: 1 }} />
            <button className="btn btn-primary btn-icon" onClick={addSkill}><Plus size={16} /></button>
          </div>
          {form.skills.length > 0 && (
            <div className={styles.skillTags}>
              {form.skills.map(sk => (
                <span key={sk} className="skill-tag"><Zap size={10} /> {sk}<button onClick={() => removeSkill(sk)}><X size={12} /></button></span>
              ))}
            </div>
          )}
        </div>

        {/* Preferred Exchange */}
        <div className={styles.section}>
          <div className="input-group">
            <label className={styles.label}>Preferred Exchange</label>
            <input className="input" placeholder="e.g., Free, Coffee/meal, Skill trade, $20/hour"
              value={form.preferred_exchange} onChange={e => set('preferred_exchange', e.target.value)} />
          </div>
        </div>

        {/* Social */}
        <div className={styles.section}>
          <label className={styles.label}>Social Media &amp; Contact</label>
          <div className={styles.socialList}>
            {SOCIAL_FIELDS.map(({ key, icon: Icon, placeholder }) => (
              <div key={key} className={styles.socialRow}>
                <div className={styles.socialIcon}><Icon size={16} /></div>
                <input className={`input ${styles.socialInput}`} placeholder={placeholder}
                  value={form.social[key] || ''} onChange={e => setSocial(key, e.target.value)} />
              </div>
            ))}
          </div>
        </div>

        {/* Custom Links */}
        <div className={styles.section}>
          <label className={styles.label}>Custom Links</label>
          <div className={styles.customLinkRow}>
            <input className="input" placeholder="Link title" value={customLinkTitle}
              onChange={e => setCustomLinkTitle(e.target.value)} style={{ flex: 1 }} />
            <input className="input" placeholder="URL" value={customLinkUrl}
              onChange={e => setCustomLinkUrl(e.target.value)} style={{ flex: 1.5 }} />
            <button className="btn btn-primary btn-icon" onClick={addLink}><Plus size={16} /></button>
          </div>
          {form.custom_links.length > 0 && (
            <div className={styles.customLinks}>
              {form.custom_links.map((link, i) => (
                <div key={i} className={styles.customLinkItem}>
                  <Link size={13} />
                  <span className={styles.customLinkTitle}>{link.title}</span>
                  <span className={styles.customLinkUrl}>{link.url}</span>
                  <button onClick={() => removeLink(i)} className={styles.removeBtn}><X size={13} /></button>
                </div>
              ))}
            </div>
          )}
          <p className={styles.hint}>Add custom links to showcase your work, portfolio, or other relevant pages</p>
        </div>

        <motion.button className={`btn btn-primary ${styles.saveBtn}`}
          onClick={handleSave} disabled={saving} whileTap={{ scale: 0.98 }}>
          {saving ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Saving...</> : <><Save size={16} /> {isSetupMode ? 'Complete Setup' : 'Save Profile'}</>}
        </motion.button>
      </div>
    </div>
  );
}
