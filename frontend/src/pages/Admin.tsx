// Admin console (ELITE) — system stats, scanners, cache, daily recap.
import { useEffect, useState, type FormEvent } from 'react';
import {
  flushCache,
  getAdminStats,
  runNewsScanAdmin,
  runSignalScan,
  triggerDailyRecap,
  type AdminStats,
} from '../lib/api';
import { useLive } from '../store/live';
import { useAuth } from '../store/auth';

function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${sec % 60}s`;
}

export default function Admin() {
  const { pushToast } = useLive();
  const tier = useAuth((s) => s.user?.tier ?? 'BASIC');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsErr, setStatsErr] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [scanTickers, setScanTickers] = useState('RELIANCE,TCS,INFY,HDFCBANK,ICICIBANK');
  const [cachePattern, setCachePattern] = useState('quote:*');

  const load = async () => {
    try {
      setStats(await getAdminStats());
      setStatsErr('');
    } catch (e) {
      setStatsErr((e as Error).message);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const run = async (key: string, fn: () => Promise<void>, failTitle: string) => {
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      pushToast({ kind: 'error', title: failTitle, body: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const signalScan = (e: FormEvent) => {
    e.preventDefault();
    const tickers = scanTickers
      .split(',')
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 20);
    if (tickers.length === 0) return;
    void run(
      'signal',
      async () => {
        const sigs = await runSignalScan(tickers);
        pushToast({
          kind: 'signal',
          title: 'SIGNAL SCAN DONE',
          body: `${sigs.length} signals generated`,
        });
        await load();
      },
      'SIGNAL SCAN FAILED'
    );
  };

  const newsScan = () =>
    void run(
      'news',
      async () => {
        const { processed } = await runNewsScanAdmin();
        pushToast({
          kind: 'news',
          title: 'NEWS SCAN DONE',
          body: `${processed} headlines processed`,
        });
        await load();
      },
      'NEWS SCAN FAILED'
    );

  const recap = () =>
    void run(
      'recap',
      async () => {
        await triggerDailyRecap();
        pushToast({
          kind: 'signal',
          title: 'RECAP TRIGGERED',
          body: 'Daily recap broadcast queued',
        });
        await load();
      },
      'RECAP FAILED'
    );

  const flush = (e: FormEvent) => {
    e.preventDefault();
    if (!cachePattern.trim()) return;
    void run(
      'flush',
      async () => {
        const { flushed } = await flushCache(cachePattern.trim());
        pushToast({ kind: 'whale', title: 'CACHE FLUSHED', body: flushed });
      },
      'FLUSH FAILED'
    );
  };

  const notElite = tier !== 'ELITE';

  return (
    <div className="space-y-4">
      {notElite && (
        <div className="rounded-2xl border border-hud-warn/40 bg-hud-warn/10 px-3.5 py-2.5 text-[11px] font-medium text-hud-warn">
          ⚠ Admin endpoints require ELITE tier — actions below will return 403 on your current
          plan.
        </div>
      )}
      {statsErr && (
        <div className="rounded-2xl border border-hud-bear/40 bg-hud-bear/10 px-3.5 py-2.5 text-[11px] font-medium text-hud-bear">
          {statsErr}
        </div>
      )}

      {/* system stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { k: 'WS Clients', v: stats ? String(stats.ws_connected_clients) : '—' },
          { k: 'Subscriptions', v: stats ? String(stats.ws_subscriptions) : '—' },
          { k: 'Uptime', v: stats ? fmtUptime(stats.uptime_seconds) : '—' },
          { k: 'Memory', v: stats ? `${stats.memory_mb} MB` : '—' },
        ].map((x) => (
          <div key={x.k} className="panel p-4">
            <div className="stat">{x.k}</div>
            <div className="font-num mt-1 text-xl font-extrabold text-hud-text">{x.v}</div>
          </div>
        ))}
      </div>

      {/* stack info */}
      <section className="panel">
        <div className="panel-head">
          <span>Stack</span>
          <span className="text-hud-faint">{stats?.free_mode ? 'free mode' : '—'}</span>
        </div>
        <div className="divide-y divide-hud-border text-[12px]">
          {[
            ['AI provider', stats?.ai_provider],
            ['Embeddings', stats?.embeddings_provider],
            ['Market data', stats?.market_data],
            ['Social posting', stats?.social_posting],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-hud-faint">{k}</span>
              <span className="font-semibold text-hud-text">{v ?? '—'}</span>
            </div>
          ))}
        </div>
      </section>

      {/* actions */}
      <div className="grid gap-4 lg:grid-cols-3">
        <form onSubmit={signalScan} className="panel space-y-3 p-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-hud-dim">
            ⚡ Signal Scan
          </div>
          <p className="text-[11px] text-hud-faint">
            Run the Oracle engine over up to 20 tickers (comma-separated).
          </p>
          <input
            className="input"
            value={scanTickers}
            onChange={(e) => setScanTickers(e.target.value)}
            placeholder="RELIANCE,TCS,INFY"
          />
          <button className="btn btn-primary w-full" disabled={busy === 'signal'}>
            {busy === 'signal' ? 'Scanning…' : 'Run Signal Scan'}
          </button>
        </form>

        <div className="panel space-y-3 p-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-hud-dim">
            📡 News Scan
          </div>
          <p className="text-[11px] text-hud-faint">
            Pull fresh headlines and run Gemini impact analysis now.
          </p>
          <button className="btn w-full" onClick={newsScan} disabled={busy === 'news'}>
            {busy === 'news' ? 'Scanning…' : 'Run News Scan'}
          </button>
          <div className="pt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-hud-dim">
            📬 Daily Recap
          </div>
          <button className="btn w-full" onClick={recap} disabled={busy === 'recap'}>
            {busy === 'recap' ? 'Triggering…' : 'Trigger Daily Recap'}
          </button>
        </div>

        <form onSubmit={flush} className="panel space-y-3 p-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-hud-dim">
            ⌫ Cache Flush
          </div>
          <p className="text-[11px] text-hud-faint">
            Flush Redis keys by glob pattern, e.g. <code>quote:*</code>.
          </p>
          <input
            className="input"
            value={cachePattern}
            onChange={(e) => setCachePattern(e.target.value)}
            placeholder="quote:*"
          />
          <button className="btn w-full !text-hud-bear" disabled={busy === 'flush'}>
            {busy === 'flush' ? 'Flushing…' : 'Flush Pattern'}
          </button>
        </form>
      </div>

      <div className="flex items-center justify-between">
        <button className="btn" onClick={load}>
          ↻ Refresh Stats
        </button>
        <span className="text-[10px] uppercase tracking-widest text-hud-faint">
          /api/admin · ELITE gated
        </span>
      </div>
    </div>
  );
}
