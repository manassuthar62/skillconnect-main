'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import SetupScreen from '@/components/SetupScreen';

export default function Home() {
  const { currentUser, loading, isConfigured } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isConfigured) return;
    if (!loading) {
      router.replace(currentUser ? '/chat' : '/auth');
    }
  }, [currentUser, loading, isConfigured, router]);

  if (!isConfigured) return <SetupScreen />;

  return (
    <div className="loading-screen">
      <div style={{ fontSize: 40 }}>⚡</div>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  );
}
