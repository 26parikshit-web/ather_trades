// Stock detail — live intraday chart (session-accumulated), fundamentals, Oracle.
import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { createChart, type IChartApi, type ISeriesApi, type LineData } from 'lightweight-charts';
import SignalCard from '../components/SignalCard';
import { getFundamentals, getSignal } from '../lib/api';
import { useLive } from '../store/live';
import { socket } from '../lib/ws';
import {
  deltaClass,
  formatCompact,
  formatINR,
  formatNum,
  formatPct,
} from '../lib/format';
import type { LiveQuote, OracleSignal, StockFundamentals } from '../types';

export default function StockDetail() {
  const { ticker = '' } = useParams();
  const chartEl = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const pointsRef = useRef<LineData[]>([]);

  const { upsertQuote, pushToast } = useLive();
  const [fund, setFund] = useState<StockFundamentals | null>(null);
  const [quote, setQuote] = useState<LiveQuote | null>(null);
  const [sig, setSig] = useState<OracleSignal | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // ── load fundamentals + signal
  useEffect(() => {
    let alive = true;
    setFund(null);
    setQuote(null);
    setSig(null);
    setErr('');
    (async () => {
      try {
        const f = await getFundamentals(ticker);
        if (alive) setFund(f);
      } catch (e) {
        if (alive) setErr((e as Error).message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [ticker]);

  // ── chart init
  useEffect(() => {
    if (!chartEl.current) return;
    const chart = createChart(chartEl.current, {
      height: 300,
      layout: {
        background: { color: 'transparent' },
        textColor: '#8899AA',
        fontFamily: '"JetBrains Mono", monospace',
      },
      grid: {
        vertLines: { color: 'rgba(27,42,58,0.5)' },
        horzLines: { color: 'rgba(27,42,58,0.5)' },
      },
      timeScale: { borderColor: '#1B2A3A', timeVisible: true, secondsVisible: false },
      rightPriceScale: { borderColor: '#1B2A3A' },
      crosshair: { mode: 0 },
    });
    const series = chart.addAreaSeries({
      lineColor: '#00BFFF',
      topColor: 'rgba(0,191,255,0.25)',
      bottomColor: 'rgba(0,191,255,0.02)',
      lineWidth: 2,
      priceFormat: { type: 'price', precision: 2, minMove: 0.05 },
    });
    chartRef.current = chart;
    seriesRef.current = series;
    pointsRef.current = [];

    const onResize = () => {
      if (chartEl.current) chart.applyOptions({ width: chartEl.current.clientWidth });
    };
    onResize();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [ticker]);

  // ── live quote subscription → chart append
  useEffect(() => {
    const unsub = socket.subscribe(`quote:${ticker}`, (p) => {
      const q = p as LiveQuote;
      if (!q?.ticker) return;
      setQuote(q);
      upsertQuote(q);
      const t = Math.floor(q.timestamp / 1000) as LineData['time'];
      const pts = pointsRef.current;
      if (pts.length && pts[pts.length - 1].time === t) {
        pts[pts.length - 1].value = q.ltp;
      } else {
        pts.push({ time: t, value: q.ltp });
        if (pts.length > 600) pts.shift();
      }
      seriesRef.current?.setData(pts);
      chartRef.current?.timeScale().scrollToRealTime();
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, upsertQuote]);

  const summon = async () => {
    setBusy(true);
    try {
      const s = await getSignal(ticker);
      setSig(s);
      pushToast({
        kind: 'signal',
        title: `⚡ ORACLE — ${s.signal_type} ${s.ticker}`,
        body: `Conf ${(s.confidence * 100).toFixed(0)}%`,
      });
    } catch (e) {
      pushToast({ kind: 'error', title: 'ORACLE ERROR', body: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const ltp = quote?.ltp ?? fund?.live_price ?? null;
  const chg = quote?.change_pct ?? null;

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/" className="text-[11px] text-hud-faint hover:text-hud-cyan">
            ← back to HUD
          </Link>
          <h1 className="text-lg font-black tracking-wider">
            {ticker}
            {fund?.company_name && (
              <span className="ml-2 text-xs font-normal text-hud-faint">
                {fund.company_name}
              </span>
            )}
          </h1>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="font-num text-2xl font-bold">{formatINR(ltp)}</span>
          {chg != null && (
            <span className={`font-num text-sm ${deltaClass(chg)}`}>
              {formatPct(chg)}
            </span>
          )}
        </div>
      </div>

      {err && (
        <div className="rounded border border-hud-bear/40 bg-hud-bear/10 px-3 py-2 text-[11px] text-hud-bear">
          {err}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* chart */}
        <section className="panel lg:col-span-2">
          <div className="panel-head">
            <span>◈ Intraday · Live Session</span>
            <span className="text-hud-faint">{pointsRef.current.length} ticks</span>
          </div>
          <div ref={chartEl} className="h-[300px] w-full p-2" />
        </section>

        {/* fundamentals */}
        <section className="panel">
          <div className="panel-head">
            <span>⌬ Fundamentals</span>
            <span className="chip border-hud-warn/40 text-hud-warn">
              {fund?.market_regime ?? '—'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 p-4 text-[11px]">
            {[
              ['PE', fund ? fund.pe_ratio.toFixed(2) : '—'],
              ['PB', fund ? fund.pb_ratio.toFixed(2) : '—'],
              ['EPS', fund ? fund.eps_ttm.toFixed(2) : '—'],
              ['Div Yld', fund ? `${fund.div_yield.toFixed(2)}%` : '—'],
              ['Mkt Cap', fund ? formatCompact(fund.market_cap) : '—'],
              ['Book Value', fund ? formatNum(fund.book_value) : '—'],
              ['52W High', fund ? formatNum(fund.fifty_two_week_high) : '—'],
              ['52W Low', fund ? formatNum(fund.fifty_two_week_low) : '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-hud-border/50 pb-1.5">
                <span className="text-hud-faint">{k}</span>
                <span className="font-num">{v}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-hud-border p-4">
            <div className="mb-1 flex justify-between text-[10px] uppercase tracking-widest">
              <span className="text-hud-faint">Whale score</span>
              <span className="text-hud-cyan">
                {(fund?.whale_activity_score ?? 0).toFixed(1)}/10
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded bg-hud-border">
              <div
                className="h-full bg-hud-cyan"
                style={{
                  width: `${Math.min(100, (fund?.whale_activity_score ?? 0) * 10)}%`,
                }}
              />
            </div>
            <div className="mb-1 mt-3 flex justify-between text-[10px] uppercase tracking-widest">
              <span className="text-hud-faint">Momentum</span>
              <span className="text-hud-bull">
                {(fund?.momentum_score ?? 0).toFixed(1)}/10
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded bg-hud-border">
              <div
                className="h-full bg-hud-bull"
                style={{ width: `${Math.min(100, (fund?.momentum_score ?? 0) * 10)}%` }}
              />
            </div>
          </div>
        </section>
      </div>

      {/* oracle */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-hud-cyan">
            ⚡ Oracle Signal
          </h2>
          <button className="btn btn-primary" onClick={summon} disabled={busy}>
            {busy ? '⌁ THINKING…' : '⚡ SUMMON SIGNAL'}
          </button>
        </div>
        {sig && <SignalCard sig={sig} />}
        {!sig && (
          <div className="panel p-5 text-center text-[11px] text-hud-faint">
            No signal generated for {ticker} this session.
          </div>
        )}
      </section>
    </div>
  );
}
