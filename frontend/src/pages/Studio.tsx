// Pulse Studio (ELITE) — social signal cards + broadcast logs.
import { useEffect, useState, type FormEvent } from 'react';
import {
  broadcastSignal,
  getBroadcastLogs,
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
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setLogs(await getBroadcastLogs(20));
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
        title: 'BROADCAST QUEUED',
        body: r.note || 'Signal card generated',
      });
      await load();
    } catch (err) {
      pushToast({ kind: 'error', title: 'BROADCAST FAILED', body: (err as Error).message });
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
        <div>
          <h1 className="text-lg font-extrabold tracking-tight text-hud-text">Pulse Studio</h1>
          <p className="text-[11px] text-hud-faint">
            Social signal cards + broadcast audit trail
          </p>
        </div>
        <span className="chip border-hud-warn/50 bg-hud-warn/10 text-hud-warn">ELITE</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* broadcast form */}
        <form onSubmit={send} className="panel space-y-3 p-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-hud-dim">
            📣 Compose Broadcast
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
            {busy ? 'Working…' : '📣 Broadcast Signal'}
          </button>
          <p className="text-[11px] leading-relaxed text-hud-faint">
            Free mode: caption + signal card are logged. Social auto-posting is disabled.
          </p>
        </form>

        {/* preview */}
        <section className="panel space-y-3 p-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-hud-dim">
            ▣ Card Preview
          </div>
          <div className="hero-card !p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-extrabold">{form.ticker}</span>
              <span className="chip border-white/20 bg-white/10 text-white">
                {form.signal_type}
              </span>
            </div>
            <div className="font-num mt-2 text-3xl font-extrabold">
              ₹{form.target.toFixed(2)}
            </div>
            <div className="mt-1 text-xs text-white/60">
              Stop ₹{form.stop_loss.toFixed(2)} · conf {form.confidence}% · PE {form.pe} · PB{' '}
              {form.pb}
            </div>
            <p className="mt-3 border-t border-white/10 pt-2 text-[11px] leading-relaxed text-white/70">
              {form.rationale}
            </p>
          </div>
          <p className="text-[11px] leading-relaxed text-hud-faint">
            Edit the form to see the generated social card exactly as it will be logged.
          </p>
        </section>
      </div>

      {/* broadcast logs */}
      <section className="panel overflow-x-auto">
        <div className="panel-head">
          <span>Broadcast Log</span>
          <span className="text-hud-faint">{logs.length} entries</span>
        </div>
        <div className="divide-y divide-hud-border">
          {logs.map((l) => (
            <div key={l.id} className="flex items-start justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <div className="text-[12px] font-bold">
                  {l.ticker ?? '—'} <span className="text-hud-cyan">{l.signal_type ?? ''}</span>
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
            <div className="px-4 py-10 text-center text-xs text-hud-faint">
              Nothing broadcast yet — send the first signal above.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
