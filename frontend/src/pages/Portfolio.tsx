// Portfolio page — holdings with live P&L, add/remove, AI review (Gemini).
import { useEffect, useState, type FormEvent } from 'react';
import {
  addHolding,
  getPortfolio,
  getPortfolioReview,
  removeHolding,
  type PortfolioResponse,
} from '../lib/api';
import { formatINR, formatPct, pnlClass } from '../lib/format';
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


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-bold uppercase tracking-[0.25em] text-hud-cyan">
          📊 Portfolio
        </h1>
        <button className="btn btn-primary" onClick={aiReview} disabled={busy}>
          {busy ? '⌁ THINKING…' : '🧠 AI REVIEW'}
        </button>
      </div>

      {/* summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { k: 'Invested', v: formatINR(s.total_invested), c: '' },
          { k: 'Current', v: formatINR(s.total_value), c: '' },
          { k: 'P&L', v: formatINR(s.total_pnl), c: pnlClass(s.total_pnl) },
          { k: 'P&L %', v: formatPct(s.total_pnl_pct), c: pnlClass(s.total_pnl) },
        ].map((x) => (
          <div key={x.k} className="panel p-3.5">
            <div className="stat">{x.k}</div>
            <div className={`font-num mt-1 text-lg font-bold ${x.c}`}>{x.v}</div>
          </div>
        ))}
      </div>

      {/* add holding */}
      <form onSubmit={add} className="panel flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[130px] flex-1">
          <label className="label">Ticker</label>
          <input
            className="input uppercase"
            placeholder="INFY"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
          />
        </div>
        <div className="min-w-[90px] flex-1">
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
          + ADD
        </button>
      </form>

      {/* holdings table */}
      <section className="panel overflow-x-auto">
        <div className="panel-head">
          <span>◈ Holdings</span>
          <span className="text-hud-faint">{data.holdings.length} positions</span>
        </div>
        <table className="w-full min-w-[680px] text-left text-[12px]">
          <thead>
            <tr className="border-b border-hud-border text-[10px] uppercase tracking-widest text-hud-faint">
              <th className="px-4 py-2">Ticker</th>
              <th className="px-4 py-2 text-right">Qty</th>
              <th className="px-4 py-2 text-right">Avg</th>
              <th className="px-4 py-2 text-right">LTP</th>
              <th className="px-4 py-2 text-right">Value</th>
              <th className="px-4 py-2 text-right">P&L</th>
              <th className="px-4 py-2 text-right">%</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {data.holdings.map((h: HoldingWithPnL) => (
              <tr key={h.id} className="border-b border-hud-border/50 last:border-0">
                <td className="px-4 py-2.5 font-bold">{h.ticker}</td>
                <td className="font-num px-4 py-2.5 text-right">{h.quantity}</td>
                <td className="font-num px-4 py-2.5 text-right">
                  {formatINR(h.avg_buy_price)}
                </td>
                <td className="font-num px-4 py-2.5 text-right">
                  {formatINR(h.current_price)}
                </td>
                <td className="font-num px-4 py-2.5 text-right">
                  {formatINR(h.current_value)}
                </td>
                <td className={`font-num px-4 py-2.5 text-right ${pnlClass(h.pnl)}`}>
                  {formatINR(h.pnl)}
                </td>
                <td className={`font-num px-4 py-2.5 text-right ${pnlClass(h.pnl)}`}>
                  {formatPct(h.pnl_pct)}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    className="text-[11px] text-hud-faint hover:text-hud-bear"
                    onClick={() => remove(h.ticker)}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            {!loading && data.holdings.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-hud-faint">
                  No holdings — add your first position above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* AI review */}
      {review && (
        <section className="panel p-4">
          <div className="panel-head !border-b-0 !px-0">
            <span>🧠 Gemini Portfolio Review</span>
          </div>
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-hud-dim">
            {review}
          </p>
        </section>
      )}
    </div>
  );
}
