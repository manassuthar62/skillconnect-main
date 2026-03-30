import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

export async function POST(request) {
  try {

    // ✅ YAHI DALNA HAI (IMPORTANT)
    const publicKey =
      process.env.VAPID_PUBLIC_KEY ||
      "BMdap9TiD7XZPHiTgHmwiUT-6l-RhsNziUpbBa4M6IR2C74ONXtGZ3sB1n1h6wmdbftDo0gg7UKRIbksWZiuDck";

    const privateKey =
      process.env.VAPID_PRIVATE_KEY ||
      "8bWAahauFu9BQ_1lpaIF2_fPEVyipdQrIeaEANCFqKE";

    webpush.setVapidDetails(
      'mailto:admin@skillconnect.app',
      publicKey,
      privateKey
    );

    const { targetUserId, title, body, url, icon } = await request.json();
    if (!targetUserId) return Response.json({ error: 'Missing targetUserId' }, { status: 400 });

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { data: subs } = await sb.from('push_subscriptions')
      .select('*').eq('user_id', targetUserId);

    if (!subs?.length) return Response.json({ ok: true, sent: 0 });

    const payload = JSON.stringify({
      title,
      body,
      url: url || '/chat',
      icon: icon || '/icon-192.png'
    });

    const results = await Promise.allSettled(subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
    ));

    const expired = subs.filter((_, i) =>
      results[i].status === 'rejected' && results[i].reason?.statusCode === 410
    );

    if (expired.length) {
      await sb.from('push_subscriptions')
        .delete().in('endpoint', expired.map(s => s.endpoint));
    }

    return Response.json({
      ok: true,
      sent: results.filter(r => r.status === 'fulfilled').length
    });

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
