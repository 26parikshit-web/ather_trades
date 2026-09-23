// Temporary end-to-end smoke test (delete after verification)
import 'dotenv/config';
const BASE = 'http://localhost:3000';

interface Res<T> { status: number; body: T }

async function call<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<Res<T>> {
  const r = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const text = await r.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: r.status, body: body as T };
}

const log = (label: string, ok: boolean, detail: unknown): void => {
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${label} | ${JSON.stringify(detail).slice(0, 220)}`);
};

async function main(): Promise<void> {
  const email = `aether.test.${Date.now()}@gmail.com`;
  const password = 'TestPass123!';

  // 1. Signup
  const su = await call<{ data?: { token: string } }>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, name: 'AETHER Tester' }),
  });
  log('signup', su.status === 200, su.body);
  const token = su.body?.data?.token || '';
  if (!token) {
    console.log('ABORT: no token from signup');
    return;
  }

  const auth = { Authorization: `Bearer ${token}` };

  // 2. Login
  const li = await call('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  log('login', li.status === 200, li.body);

  // 3. Me
  const me = await call('/api/auth/me', { headers: auth });
  log('me', me.status === 200, me.body);

  // 4. Health / index (NSE live — may be blocked outside market hours)
  const idx = await call('/api/stocks/index', { headers: auth });
  log('index', idx.status === 200, idx.body);

  // 5. Quote
  const q = await call('/api/stocks/quote/RELIANCE', { headers: auth });
  log('quote RELIANCE', q.status === 200, q.body);

  // 6. Fundamentals
  const f = await call('/api/stocks/fundamentals/RELIANCE', { headers: auth });
  log('fundamentals RELIANCE', f.status === 200, f.body);

  // 7. News feed (DB read)
  const n = await call('/api/news?limit=3', { headers: auth });
  log('news feed', n.status === 200, n.body);

  // 8. Admin stats (must 403 for BASIC tier)
  const s = await call('/api/admin/stats', { headers: auth });
  log('admin gate (expect 403)', s.status === 403, s.body);

  // 9. Oracle signal (must 403 for BASIC tier)
  const o = await call('/api/stocks/signal/TCS', { headers: auth });
  log('oracle gate (expect 403)', o.status === 403, o.body);

  // 10. Tier upgrade to ELITE, then Oracle + news analyze for real
  const { createClient } = require('@supabase/supabase-js');
  const admin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const userId = su.body?.data?.user_id;
  await admin.from('profiles').update({ subscription_tier: 'ELITE' }).eq('id', userId);
  console.log('upgraded test user to ELITE');

  const o2 = await call('/api/stocks/signal/TCS', { headers: auth });
  log('oracle signal (ELITE, real Gemini)', o2.status === 200, o2.body);

  const na = await call('/api/news/analyze', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      headline: 'RBI holds repo rate steady at 6.5%, signals accommodative stance for growth',
      source: 'SmokeTest',
    }),
  });
  log('news analyze (real Gemini)', na.status === 200, na.body);

  const rev = await call('/api/portfolio/ai-review', { headers: auth });
  log('portfolio AI review', rev.status === 200, rev.body);

  const st = await call('/api/admin/stats', { headers: auth });
  log('admin stats (ELITE)', st.status === 200, st.body);

  // 11. Portfolio add + list + remove
  const add = await call('/api/portfolio', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ ticker: 'INFY', quantity: 10, avg_buy_price: 1500 }),
  });
  log('portfolio add', add.status === 200, add.body);

  const list = await call('/api/portfolio', { headers: auth });
  log('portfolio list', list.status === 200, list.body);

  const del = await call('/api/portfolio/holding/INFY', { method: 'DELETE', headers: auth });
  log('portfolio remove', del.status === 200, del.body);

  // 12. Broadcast (free mode — captions only)
  const bc = await call('/api/broadcast/signal', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      ticker: 'TCS', signal_type: 'BUY', confidence: 78,
      target: 4400, stop_loss: 3900, pe: 26.5, pb: 12.1,
      rationale: 'Strong IT deal wins and margin expansion',
    }),
  });
  log('broadcast signal (free mode)', bc.status === 200, bc.body);

  const bl = await call('/api/broadcast/logs?limit=2', { headers: auth });
  log('broadcast logs', bl.status === 200, bl.body);

  console.log('SMOKE TEST COMPLETE');
}

main().catch((err) => {
  console.error('SMOKE TEST ERROR:', err?.message || err);
  process.exit(1);
});
