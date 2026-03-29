'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getSupabase } from '@/lib/supabase';
import { MessageCircle, Search, Users, Bell, User } from 'lucide-react';

export default function BottomNav() {
  const pathname = usePathname();
  const { currentUser } = useAuth();
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [unreadMsgs,   setUnreadMsgs]   = useState(0);

  useEffect(() => {
    if (!currentUser) return;
    const sb = getSupabase();

    sb.from('notifications').select('id', { count: 'exact' })
      .eq('user_id', currentUser.id).eq('read', false)
      .then(({ count }) => setUnreadNotifs(count || 0));

    const ch = sb.channel('bottom-nav-counts')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${currentUser.id}`,
      }, () => setUnreadNotifs(p => p + 1))
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${currentUser.id}`,
      }, () => {
        sb.from('notifications').select('id', { count: 'exact' })
          .eq('user_id', currentUser.id).eq('read', false)
          .then(({ count }) => setUnreadNotifs(count || 0));
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
      }, (payload) => {
        if (payload.new.sender_id !== currentUser.id) setUnreadMsgs(p => p + 1);
      })
      .subscribe();

    return () => sb.removeChannel(ch);
  }, [currentUser]);

  useEffect(() => {
    if (pathname === '/notifications') setUnreadNotifs(0);
    if (pathname.startsWith('/chat'))  setUnreadMsgs(0);
  }, [pathname]);

  const NAV = [
    { href: '/chat',          Icon: MessageCircle, badge: unreadMsgs },
    { href: '/discover',      Icon: Search,        badge: 0 },
    { href: '/community',     Icon: Users,         badge: 0 },
    { href: '/notifications', Icon: Bell,          badge: unreadNotifs },
    { href: '/profile',       Icon: User,          badge: 0 },
  ];

  return (
    <nav style={{
      background: 'var(--glass)',
      borderTop: '1px solid var(--b1)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-around',
      paddingTop: 8,
      height: 'calc(64px + env(safe-area-inset-bottom, 0px))',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      flexShrink: 0,
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      backdropFilter: 'blur(18px)',
      WebkitBackdropFilter: 'blur(18px)',
    }}>
      {NAV.map(({ href, Icon, badge }) => {
        const active = pathname.startsWith(href);
        return (
          <Link key={href} href={href} style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 52,
            height: 48,
            borderRadius: 16,
            position: 'relative',
            background: active ? 'rgba(47,125,50,0.12)' : 'transparent',
            transition: 'background 0.2s, transform 0.2s',
            transform: active ? 'translateY(-1px)' : 'none',
          }}>
            <Icon
              size={22}
              color={active ? 'var(--accent)' : 'var(--t3)'}
              strokeWidth={active ? 2.5 : 1.8}
              fill={active ? 'rgba(47,125,50,0.12)' : 'none'}
              style={{ transition: 'color 0.2s' }}
            />
            {badge > 0 && (
              <span style={{
                position: 'absolute',
                top: 7,
                right: 7,
                background: '#ef4444',
                color: '#fff',
                fontSize: 9,
                fontWeight: 800,
                borderRadius: 999,
                minWidth: 15,
                height: 15,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 3px',
                lineHeight: 1,
                boxShadow: '0 0 0 2px var(--surface)',
              }}>
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
