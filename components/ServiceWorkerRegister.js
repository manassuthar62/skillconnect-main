'use client';
import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { registerPushNotifications } from '@/lib/pushClient';

export default function ServiceWorkerRegister() {
  const { currentUser } = useAuth();

  useEffect(() => {
    if (!currentUser) return;
    // Register SW + subscribe to push after user logs in
    registerPushNotifications(currentUser.id);
  }, [currentUser]);

  return null;
}
