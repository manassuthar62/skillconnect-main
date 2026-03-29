// Client-side push notification helper

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export async function registerPushNotifications(userId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  if (!VAPID_PUBLIC_KEY) { console.warn('VAPID_PUBLIC_KEY not set'); return false; }

  try {
    // Register service worker
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    // Subscribe to push
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    // Save to server
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, subscription: subscription.toJSON() }),
    });

    return true;
  } catch (e) {
    console.error('Push registration failed:', e);
    return false;
  }
}

export async function sendPushNotification({ targetUserId, title, body, url, icon }) {
  try {
    await fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId, title, body, url, icon }),
    });
  } catch (e) {
    console.error('Push send failed:', e);
  }
}
