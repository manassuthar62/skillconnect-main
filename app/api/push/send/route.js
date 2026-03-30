import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

webpush.setVapidDetails(
  'mailto:admin@skillconnect.app',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export async function POST(request) {
  try {
    const { targetUserId, title, body, url, icon } = await request.json();
    if (!targetUserId) return Response.json({ error: 'Missing targetUserId' }, { status: 400 });

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Get all subscriptions for the target user
    const { data: subs } = await sb.from('push_subscriptions')
      .select('*').eq('user_id', targetUserId);

    if (!subs?.length) return Response.json({ ok: true, sent: 0 });

    const payload = JSON.stringify({ title, body, url: url || '/chat', icon: icon || '/icon-192.png' });

    const results = await Promise.allSettled(subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
    ));

    // Remove expired subscriptions
    const expired = subs.filter((_, i) =>
      results[i].status === 'rejected' && results[i].reason?.statusCode === 410
    );
    if (expired.length) {
      await sb.from('push_subscriptions')
        .delete().in('endpoint', expired.map(s => s.endpoint));
    }

    return Response.json({ ok: true, sent: results.filter(r => r.status === 'fulfilled').length });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
