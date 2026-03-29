'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';
import {
  MessageCircle, Search, Users, Bell, User, Settings, LogOut, Zap
} from 'lucide-react';
import styles from './Sidebar.module.css';

const NAV = [
  { href: '/chat',          icon: MessageCircle, label: 'Chats' },
  { href: '/discover',      icon: Search,        label: 'Discover' },
  { href: '/community',     icon: Users,         label: 'Community' },
  { href: '/notifications', icon: Bell,          label: 'Alerts' },
  { href: '/profile',       icon: User,          label: 'Profile' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, userProfile, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.push('/auth');
  };

  const initials = (name) =>
    name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <aside className="sidebar">
      {/* Top bar */}
      <div className={styles.top}>
        <div className={styles.brand}>
          <div className={styles.brandIcon}><Zap size={18} fill="#00a884" color="#00a884" /></div>
          <span className={styles.brandName}>SkillConnect</span>
        </div>
        <div className={styles.topActions}>
          <button className="wa-icon-btn" onClick={handleLogout} title="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Nav tabs */}
      <div className={styles.tabs}>
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href);
          return (
            <Link key={href} href={href} className={`${styles.tab}${active ? ` ${styles.tabActive}` : ''}`}>
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>

      {/* User info strip */}
      <div className={styles.userStrip}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          {userProfile?.photoURL ? (
            <Image src={userProfile.photoURL} alt="" width={36} height={36} className="avatar" />
          ) : (
            <div className="avatar-placeholder" style={{ width: 36, height: 36, fontSize: 13 }}>
              {initials(userProfile?.name || currentUser?.email)}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--wa-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {userProfile?.name || 'Loading...'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--wa-text-muted)' }}>
              {userProfile?.skills?.length ? userProfile.skills.slice(0,2).join(' · ') : 'Add your skills'}
            </div>
          </div>
        </div>
        <Link href="/profile" className="wa-icon-btn" title="Settings">
          <Settings size={16} />
        </Link>
      </div>
    </aside>
  );
}
