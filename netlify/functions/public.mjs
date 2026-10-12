import { getStore } from '@netlify/blobs';

// נקודת קצה ציבורית — ללא סיסמה. מחזירה רק את מה שמיועד לתצוגה ציבורית
// (כותרת, מספר מחזור, תאריך, סגל שמי, כוחות, שעת הגרלה, דגל פורסם) — ללא דירוגים.
const STORE = 'team-balancer';
const KEY = 'state';

export default async () => {
  const store = getStore(STORE);
  const data = (await store.get(KEY, { type: 'json' })) || {};
  const publish = data.publish || null;
  return new Response(JSON.stringify({ publish, updatedAt: data.updatedAt || null }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    },
  });
};
