'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import BottomNav from '@/components/BottomNav';
import TopBar from '@/components/TopBar';
import SetupScreen from '@/components/SetupScreen';
import NotificationListener from '@/components/NotificationListener';

export default function MainLayout({ children }) {
  const { currentUser, loading, isConfigured } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isChatRoom = pathname?.startsWith('/chat/');

  useEffect(() => {
    if (!isConfigured) return;
    if (!loading && !currentUser) {
      router.replace('/auth');
    }
  }, [currentUser, loading, isConfigured, router]);

  if (!isConfigured) return <SetupScreen />;

  if (loading || !currentUser) {
    return (
      <div className="loading-screen">
        <div style={{ fontSize: 36 }}>⚡</div>
        <div className="spinner" />
        <span style={{ fontSize: 13 }}>Loading SkillConnect...</span>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {!isChatRoom && <TopBar />}
      <NotificationListener />
      <main className="app-main">
        {children}
      </main>
      {!isChatRoom && <BottomNav />}
    </div>
  );
}
