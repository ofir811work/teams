import { getStore } from '@netlify/blobs';

// מצב מלא של האפליקציה (לאדמין). דורש סיסמה (APP_PASSWORD).
// נשמר כ-blob יחיד: { players, publish, updatedAt }
// players = מאגר מלא כולל דירוגים. publish = מה שהדף הציבורי מציג.
const STORE = 'team-balancer';
const KEY = 'state';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type,x-app-password',
    },
  });

export default async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true });

  const expected = process.env.APP_PASSWORD;
  if (!expected) return json({ error: 'השרת לא הוגדר: חסר APP_PASSWORD' }, 500);
  if ((req.headers.get('x-app-password') || '') !== expected) return json({ error: 'סיסמה שגויה' }, 401);

  const store = getStore(STORE);

  if (req.method === 'GET') {
    const data = (await store.get(KEY, { type: 'json' })) || { players: [], publish: null, updatedAt: null };
    return json(data);
  }

  if (req.method === 'POST') {
    let incoming;
    try {
      incoming = await req.json();
    } catch {
      return json({ error: 'גוף הבקשה אינו JSON תקין' }, 400);
    }
    const players = Array.isArray(incoming?.players) ? incoming.players : [];
    const clean = players
      .filter((p) => p && typeof p.name === 'string' && Number.isFinite(+p.rating))
      .map((p) => ({
        id: String(p.id || ''),
        name: p.name.trim(),
        rating: +p.rating,
        fitness: ['low', 'mid', 'high'].includes(p.fitness) ? p.fitness : 'mid',
      }));
    // publish — אובייקט חופשי שהדף הציבורי מציג (שמות בלבד, ללא דירוגים)
    const publish = incoming?.publish && typeof incoming.publish === 'object' ? incoming.publish : null;
    const record = { players: clean, publish, updatedAt: new Date().toISOString() };
    await store.setJSON(KEY, record);
    return json({ ok: true, count: clean.length, updatedAt: record.updatedAt });
  }

  return json({ error: 'method not allowed' }, 405);
};
