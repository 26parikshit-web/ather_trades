// Portfolio page — Neo layout: dark hero value card, holdings list, AI review.
import { useEffect, useState, type FormEvent } from 'react';
import {
  addHolding,
  getPortfolio,
  getPortfolioReview,
  removeHolding,
  type PortfolioResponse,
} from '../lib/api';
import { formatINR, formatPct, pnlClass } from '../lib/format';
import TickerIcon from '../components/TickerIcon';
import type { HoldingWithPnL, PortfolioSummary } from '../types';

const EMPTY: PortfolioResponse = {
  holdings: [],
  summary: { total_invested: 0, total_value: 0, total_pnl: 0, total_pnl_pct: 0 },
};

export default function Portfolio() {
  const [data, setData] = useState<PortfolioResponse>(EMPTY);
  const [ticker, setTicker] = useState('');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setData(await getPortfolio());
    } catch {
      /* offline */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const t = ticker.trim().toUpperCase();
    const q = Number(qty);
    const p = Number(price);
    if (!t || !(q > 0) || !(p > 0)) return;
    setBusy(true);
    try {
      await addHolding(t, q, p);
      setTicker('');
      setQty('');
      setPrice('');
      await load();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (t: string) => {
    try {
      await removeHolding(t);
      await load();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const aiReview = async () => {
    setBusy(true);
    setReview('');
    try {
      const { review: r } = await getPortfolioReview();
      setReview(r);
    } catch (err) {
      setReview(`⚠ ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const s: PortfolioSummary = data.summary;
  const up = s.total_pnl >= 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-extrabold tracking-tight text-hud-text">Portfolio</h1>
          <p className="text-[11px] text-hud-faint">
            {data.holdings.length} positions · live P&amp;L
          </p>
        </div>
        <button className="btn btn-primary" onClick={aiReview} disabled={busy}>
          {busy ? 'Thinking…' : '🧠 AI Review'}
        </button>
      </div>

      {/* hero value card — mirrors the reference design */}
      <div className="hero-card relative overflow-hidden">
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-hud-cyan/20 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">
              Total Value
            </div>
            <div className="font-num mt-1 text-4xl font-extrabold tracking-tight">
              {formatINR(s.total_value)}
            </div>
            <div
              className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                up ? 'bg-[#00E676]/15 text-[#00E676]' : 'bg-hud-bear/20 text-hud-bear'
              }`}
            >
              {up ? '▲' : '▼'} {formatINR(s.total_pnl)} ({formatPct(s.total_pnl_pct)})
            </div>
          </div>
          <button
            className="btn btn-primary !rounded-full !px-5 !py-2.5"
            onClick={aiReview}
            disabled={busy}
          >
            {busy ? 'Thinking…' : '🧠 Rewards · AI Review'}
          </button>
        </div>
        <div className="relative mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { k: 'Invested', v: formatINR(s.total_invested), c: 'text-white' },
            { k: 'Current', v: formatINR(s.total_value), c: 'text-white' },
            { k: 'P&L', v: formatINR(s.total_pnl), c: up ? 'text-[#00E676]' : 'text-hud-bear' },
          ].map((x) => (
            <div key={x.k} className="rounded-2xl bg-white/10 p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                {x.k}
              </div>
              <div className={`font-num mt-0.5 text-base font-bold ${x.c}`}>{x.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* add holding */}
      <form onSubmit={add} className="panel flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[130px] flex-1">
          <label className="label">Ticker</label>
          <input
            className="input uppercase"
            placeholder="RELIANCE"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
          />
        </div>
        <div className="min-w-[100px] flex-1">
          <label className="label">Qty</label>
          <input
            className="input"
            type="number"
            min={1}
            placeholder="10"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </div>
        <div className="min-w-[110px] flex-1">
          <label className="label">Avg price</label>
          <input
            className="input"
            type="number"
            step="0.01"
            min={0.01}
            placeholder="1500.50"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" disabled={busy}>
          + Add
        </button>
      </form>

      {/* holdings list */}
      <section className="panel overflow-x-auto">
        <div className="panel-head">
          <span>Holdings</span>
          <span className="text-hud-faint">{data.holdings.length} positions</span>
        </div>
        <div className="divide-y divide-hud-border">
          {data.holdings.map((h: HoldingWithPnL) => (
            <div
              key={h.id}
              className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-hud-bg"
            >
              <div className="flex min-w-0 items-center gap-3">
                <TickerIcon ticker={h.ticker} />
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-bold">{h.ticker}</div>
                  <div className="text-[10px] text-hud-faint">
                    {h.quantity} @ {formatINR(h.avg_buy_price)} → {formatINR(h.current_price)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="font-num text-[13px] font-bold">
                    {formatINR(h.current_value)}
                  </div>
                  <div className={`font-num text-[11px] font-semibold ${pnlClass(h.pnl)}`}>
                    {formatINR(h.pnl)} ({formatPct(h.pnl_pct)})
                  </div>
                </div>
                <button
                  className="flex h-7 w-7 items-center justify-center rounded-full text-hud-faint transition-colors hover:bg-hud-bear/10 hover:text-hud-bear"
                  onClick={() => remove(h.ticker)}
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
          {!loading && data.holdings.length === 0 && (
            <div className="px-4 py-10 text-center text-xs text-hud-faint">
              No holdings — add your first position above.
            </div>
          )}
        </div>
      </section>

      {/* AI review */}
      {review && (
        <section className="panel p-4">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-hud-dim">
            🧠 Gemini Portfolio Review
          </div>
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-hud-dim">
            {review}
          </p>
        </section>
      )}
    </div>
  );
}
