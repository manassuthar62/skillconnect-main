'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';
import { Zap, ZapOff, User, LogOut, Bell, Share2, Download, CheckCircle } from 'lucide-react';
import styles from './TopBar.module.css';
import { toast } from 'react-hot-toast';

export default function TopBar() {
  const { userProfile, currentUser, logout, refreshProfile } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isWorkMode, setIsWorkMode] = useState(userProfile?.is_available || false);
  const [updatingMode, setUpdatingMode] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);

    // PWA Install Prompt Logic
    if (!window.matchMedia('(display-mode: standalone)').matches) {
      const handleBeforeInstallPrompt = (e) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setIsInstallable(true);
      };
      const handleAppInstalled = () => {
        setIsInstallable(false);
        setDeferredPrompt(null);
      };
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.addEventListener('appinstalled', handleAppInstalled);
      
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('appinstalled', handleAppInstalled);
      };
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (userProfile) setIsWorkMode(userProfile.is_available || false);
  }, [userProfile]);

  const toggleWorkMode = async () => {
    setUpdatingMode(true);
    const newMode = !isWorkMode;
    try {
      const sb = getSupabase();
      const { error } = await sb.from('users').update({ is_available: newMode }).eq('id', currentUser.id);
      if (error) throw error;
      setIsWorkMode(newMode);
      await refreshProfile();
      toast.success(newMode ? 'Instant Work Mode ON! 🚀' : 'Work Mode OFF.');
    } catch (e) {
      toast.error('Failed to update mode');
    }
    setUpdatingMode(false);
  };

  const getSupabase = () => {
    const { getSupabase: getSb } = require('@/lib/supabase');
    return getSb();
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') toast.success('App installed successfully! 🎉');
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  const handleLogout = async () => {
    setIsMenuOpen(false);
    await logout();
    router.push('/auth');
  };

  const initials = (name) =>
    name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';

  // Show logo on home/chat, show back title on inner pages
  const isHome = pathname === '/chat' || pathname === '/discover' ||
    pathname === '/community' || pathname === '/notifications' || pathname === '/profile';

  return (
    <header className={styles.header}>
      {/* Left — Logo */}
      <Link href="/chat" className={styles.logoLink}>
        <div className={styles.logoIcon}>
          <Zap size={15} fill="#2563eb" color="#2563eb" />
        </div>
        <span className={styles.logoText}>SkillConnect</span>
      </Link>

      {/* Right — Actions */}
      <div className={styles.actions}>
        
        {/* PWA Install Button */}
        {isInstallable && (
          <button className={styles.installBtn} onClick={handleInstallClick} title="Install App">
            <Download size={18} />
          </button>
        )}

        {/* Instant Work Toggle */}
        <button 
          className={`${styles.workToggle} ${isWorkMode ? styles.workActive : ''}`} 
          onClick={toggleWorkMode}
          disabled={updatingMode}
          title={isWorkMode ? "Instant Work ON" : "Turn on Instant Work"}
        >
          {isWorkMode ? <Zap size={16} fill="currentColor" /> : <ZapOff size={16} />}
          <span className={styles.workLabel}>{isWorkMode ? 'Active' : 'Offline'}</span>
        </button>

        {/* Profile avatar / menu */}
        <div className={styles.avatarContainer} ref={menuRef}>
          <button
            className={styles.avatarButton}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {userProfile?.photo_url ? (
              <Image
                src={userProfile.photo_url}
                alt={userProfile?.name || ''}
                width={32}
                height={32}
                className={`avatar ${styles.avatar}`}
              />
            ) : (
              <div className={`avatar-placeholder ${styles.avatar}`}
                style={{ width: 32, height: 32, fontSize: 12 }}>
                {initials(userProfile?.name || currentUser?.email)}
              </div>
            )}
            <div className={styles.onlineDot} />
          </button>

          {isMenuOpen && (
            <div className={styles.dropdown}>
              <div className={styles.dropdownHeader}>
                <span className={styles.dropdownName}>{userProfile?.name || 'Profile'}</span>
                {userProfile?.username && (
                  <span className={styles.dropdownUsername}>@{userProfile.username}</span>
                )}
              </div>
              <div className={styles.dropdownDivider} />
              <Link
                href="/profile"
                className={styles.menuItem}
                onClick={() => setIsMenuOpen(false)}
              >
                <User size={15} />
                <span>Edit Profile</span>
              </Link>
              <button
                className={`${styles.menuItem} ${styles.menuItemLogout}`}
                onClick={handleLogout}
              >
                <LogOut size={15} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
