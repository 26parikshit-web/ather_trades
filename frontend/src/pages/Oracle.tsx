// Oracle Signals page — generate + browse signals (PRO tier for generation).
import { useState, type FormEvent } from 'react';
import SignalCard from '../components/SignalCard';
import { useLive } from '../store/live';
import { useAuth } from '../store/auth';
import { getSignal } from '../lib/api';
import type { OracleSignal } from '../types';

const QUICK = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN'];

export default function Oracle() {
  const { signals, pushToast } = useLive();
  const hasTier = useAuth((s) => s.hasTier);
  const [ticker, setTicker] = useState('');
  const [busy, setBusy] = useState(false);

  const generate = async (e?: FormEvent) => {
    e?.preventDefault();
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    setBusy(true);
    try {
      const sig: OracleSignal = await getSignal(t);
      useLive.setState({ signals: [sig, ...useLive.getState().signals].slice(0, 25) });
      pushToast({
        kind: 'signal',
        title: `ORACLE — ${sig.signal_type} ${sig.ticker}`,
        body: `Conf ${(sig.confidence * 100).toFixed(0)}% · entry ${sig.entry_zone_low}–${sig.entry_zone_high}`,
      });
      setTicker('');
    } catch (err) {
      pushToast({ kind: 'error', title: 'ORACLE ERROR', body: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-extrabold tracking-tight text-hud-text">Oracle Signals</h1>
          <p className="text-[11px] text-hud-faint">AI entry/exit calls · {signals.length} loaded</p>
        </div>
        <span className="chip border-hud-cyan/40 bg-hud-cyan/10 text-hud-cyan">⚡ Engine</span>
      </div>

      {/* generator */}
      <form onSubmit={generate} className="panel flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[200px] flex-1">
          <label className="label">Ticker</label>
          <input
            className="input uppercase"
            placeholder="RELIANCE"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
          />
        </div>
        <button className="btn btn-primary" disabled={busy || !ticker.trim()}>
          {busy ? 'Thinking…' : '⚡ Generate Signal'}
        </button>

        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          {QUICK.map((q) => (
            <button
              key={q}
              type="button"
              className="btn !rounded-full !px-3 !py-1 !text-[11px]"
              onClick={() => setTicker(q)}
            >
              {q}
            </button>
          ))}
        </div>
      </form>

      {!hasTier('PRO') && (
        <div className="rounded-2xl border border-hud-warn/40 bg-hud-warn/10 px-3.5 py-2.5 text-[11px] font-medium text-hud-warn">
          ⚠ You are on BASIC — signal generation requires PRO tier (server enforces this).
        </div>
      )}

      {/* signal grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {signals.map((s) => (
          <SignalCard key={s.id} sig={s} />
        ))}
        {signals.length === 0 && (
          <div className="panel col-span-full p-10 text-center text-xs text-hud-faint">
            The Oracle is silent. Enter a ticker above to summon a signal.
          </div>
        )}
      </div>
    </div>
  );
}