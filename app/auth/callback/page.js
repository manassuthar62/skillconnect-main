'use client';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser, loading, isConfigured } = useAuth();

  useEffect(() => {
    if (!isConfigured || loading) return;
    const mode = searchParams.get('mode');
    if (!currentUser) router.replace('/auth');
    else router.replace(mode === 'signup' ? '/onboarding' : '/chat');
  }, [currentUser, loading, isConfigured, router, searchParams]);

  return (
    <div className="loading-screen">
      <div style={{ fontSize: 36 }}>⚡</div>
      <div className="spinner" />
      <span style={{ fontSize: 13 }}>Signing you in...</span>
    </div>
  );
}
