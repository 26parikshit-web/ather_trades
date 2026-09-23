// Pulse Studio (ELITE) — social signal cards + broadcast logs + admin stats.
import { useEffect, useState, type FormEvent } from 'react';
import {
  broadcastSignal,
  getAdminStats,
  getBroadcastLogs,
  runSignalScan,
  type AdminStats,
  type BroadcastLog,
} from '../lib/api';
import { useLive } from '../store/live';
import { timeAgo } from '../lib/format';

const DEFAULT_FORM = {
  ticker: 'RELIANCE',
  signal_type: 'BUY',
  confidence: 80,
  target: 1350,
  stop_loss: 1180,
  pe: 12.5,
  pb: 1.1,
  rationale: 'Strong accumulation with rising volumes and positive sector momentum.',
};

export default function Studio() {
  const { pushToast } = useLive();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [logs, setLogs] = useState<BroadcastLog[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanTickers, setScanTickers] = useState('RELIANCE,TCS,INFY,HDFCBANK,ICICIBANK');

  const load = async () => {
    try {
      setLogs(await getBroadcastLogs(20));
    } catch {
      /* ignore */
    }
    try {
      setStats(await getAdminStats());
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const set = (k: keyof typeof form, v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }));

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await broadcastSignal(form);
      pushToast({
        kind: 'signal',
        title: '📣 BROADCAST QUEUED',
        body: r.note || 'Signal card generated',
      });
      await load();
    } catch (err) {
      pushToast({ kind: 'error', title: 'BROADCAST FAILED', body: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const scan = async () => {
    setBusy(true);
    try {
      const tickers = scanTickers
        .split(',')
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean);
      const sigs = await runSignalScan(tickers);
      pushToast({
        kind: 'signal',
        title: '⌁ SCAN COMPLETE',
        body: `${sigs.length} signals generated`,
      });
      await load();
    } catch (err) {
      pushToast({ kind: 'error', title: 'SCAN FAILED', body: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const numInput = (k: keyof typeof form, label: string, step = '0.01') => (
    <div className="min-w-[90px] flex-1">
      <label className="label">{label}</label>
      <input
        className="input"
        type="number"
        step={step}
        value={String(form[k])}
        onChange={(e) => set(k, Number(e.target.value))}
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-bold uppercase tracking-[0.25em] text-hud-cyan">
          📣 Pulse Studio
        </h1>
        <span className="chip border-hud-warn/50 bg-hud-warn/10 text-hud-warn">ELITE</span>
      </div>

      {/* stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ['WS Clients', String(stats.ws_connected_clients)],
            ['Uptime', `${Math.floor(stats.uptime_seconds / 60)}m`],
            ['Memory', `${stats.memory_mb} MB`],
            ['Posting', stats.free_mode ? 'FREE MODE' : 'SOCIAL'],
          ].map(([k, v]) => (
            <div key={k} className="panel p-3.5">
              <div className="stat">{k}</div>
              <div className="font-num mt-1 text-lg font-bold">{v}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* broadcast form */}
        <form onSubmit={send} className="panel space-y-3 p-4">
          <div className="panel-head !border-b-0 !px-0">
            <span>⌁ Signal Broadcast</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="min-w-[130px] flex-1">
              <label className="label">Ticker</label>
              <input
                className="input uppercase"
                value={form.ticker}
                onChange={(e) => set('ticker', e.target.value.toUpperCase())}
              />
            </div>
            <div className="min-w-[110px] flex-1">
              <label className="label">Signal</label>
              <select
                className="input"
                value={form.signal_type}
                onChange={(e) => set('signal_type', e.target.value)}
              >
                {['BUY', 'SELL', 'WATCH', 'AVOID'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            {numInput('confidence', 'Conf %', '1')}
          </div>
          <div className="flex flex-wrap gap-3">
            {numInput('target', 'Target')}
            {numInput('stop_loss', 'Stop loss')}
            {numInput('pe', 'PE')}
            {numInput('pb', 'PB')}
          </div>
          <div>
            <label className="label">Rationale</label>
            <textarea
              className="input min-h-[70px]"
              value={form.rationale}
              onChange={(e) => set('rationale', e.target.value)}
            />
          </div>
          <button className="btn btn-primary w-full" disabled={busy}>
            {busy ? '⌁ WORKING…' : '📣 BROADCAST SIGNAL'}
          </button>
        </form>

        {/* manual scan */}
        <section className="panel space-y-3 p-4">
          <div className="panel-head !border-b-0 !px-0">
            <span>⌁ Manual Signal Scan</span>
          </div>
          <div>
            <label className="label">Tickers (comma separated)</label>
            <input
              className="input uppercase"
              value={scanTickers}
              onChange={(e) => setScanTickers(e.target.value.toUpperCase())}
            />
          </div>
          <button className="btn btn-primary w-full" onClick={scan} disabled={busy}>
            {busy ? '⌁ SCANNING…' : '⌁ RUN SCAN (Gemini + HF)'}
          </button>
          <p className="text-[11px] leading-relaxed text-hud-faint">
            Generates Oracle signals for each ticker and stores them in Supabase. Uses the
            live Gemini + HuggingFace keys from the backend.
          </p>
        </section>
      </div>

      {/* broadcast logs */}
      <section className="panel overflow-x-auto">
        <div className="panel-head">
          <span>◈ Broadcast Log</span>
          <span className="text-hud-faint">{logs.length} entries</span>
        </div>
        <div className="divide-y divide-hud-border/50">
          {logs.map((l) => (
            <div key={l.id} className="flex items-start justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <div className="text-[12px] font-bold">
                  {l.ticker ?? '—'}{' '}
                  <span className="text-hud-cyan">{l.signal_type ?? ''}</span>
                </div>
                <div className="truncate text-[11px] text-hud-dim">
                  {l.caption || '(no caption)'}
                </div>
              </div>
              <div className="shrink-0 text-right text-[10px] text-hud-faint">
                <div>{timeAgo(l.broadcasted_at)}</div>
                <div>
                  IG {l.instagram_status ?? '—'} · YT {l.youtube_status ?? '—'}
                </div>
              </div>
            </div>
          ))}
          {logs.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-hud-faint">
              Nothing broadcast yet — send the first signal above.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
